import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ClientFailure,
  LifeArchiveClient,
  OrdinaryTarget,
  StructuredSummary,
  TimeWindow,
} from '../../../core/client'

export type EditorDocumentStatus =
  'unavailable' | 'loading' | 'ready' | 'failed'

export type EditorSaveStatus =
  | 'unavailable'
  | 'mock'
  | 'ready'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'failed'
  | 'conflicted'

export interface EditorDocument {
  readonly key: string | null
  readonly markdown: string
  readonly status: EditorDocumentStatus
  readonly failure: ClientFailure | null
}

interface CachedDocument {
  markdown: string
  loaded: boolean
  target: OrdinaryTarget | null
  ordinary: boolean
  savedMarkdown: string
  saveConfirmed: boolean
}

const UNAVAILABLE: EditorDocument = {
  key: null,
  markdown: '',
  status: 'unavailable',
  failure: null,
}

/**
 * Loads one selected document and then treats the local Markdown buffer as
 * authoritative. Cached buffers are keyed by the exact destination, so
 * switching objects and returning cannot discard writing. Only an ordinary
 * real-runtime document exposes the deliberately small Step 38 save path.
 */
export function useEditorDocument(
  client: LifeArchiveClient,
  window: TimeWindow | null,
  selected: StructuredSummary | null,
  developmentMock: boolean,
) {
  const key = selected
    ? `object:${selected.id}`
    : window
      ? `ordinary:${window.id}`
      : null
  const cache = useRef(new Map<string, CachedDocument>())
  const generation = useRef(0)
  const retryRequested = useRef(false)
  const [retryGeneration, setRetryGeneration] = useState(0)
  const [document, setDocument] = useState<EditorDocument>(UNAVAILABLE)
  const [saveStatus, setSaveStatus] = useState<EditorSaveStatus>('unavailable')
  const [saveFailure, setSaveFailure] = useState<ClientFailure | null>(null)

  useEffect(() => {
    const request = (generation.current += 1)
    if (!key || !window) {
      return
    }

    const cached = cache.current.get(key)
    const force = retryRequested.current
    retryRequested.current = false
    void Promise.resolve().then(async () => {
      if (request !== generation.current) return
      if (cached?.loaded && !force) {
        setDocument({
          key,
          markdown: cached.markdown,
          status: 'ready',
          failure: null,
        })
        setSaveStatus(
          developmentMock || !cached.ordinary
            ? 'mock'
            : cached.markdown !== cached.savedMarkdown
              ? 'dirty'
              : cached.saveConfirmed
                ? 'saved'
                : 'ready',
        )
        setSaveFailure(null)
        return
      }

      setDocument((current) => ({
        key,
        markdown:
          cached?.markdown ?? (current.key === key ? current.markdown : ''),
        status: 'loading',
        failure: null,
      }))

      const loaded = await (selected
        ? client.structured.load({ id: selected.id, includeDeleted: false })
        : client.record.load(window))
      if (request !== generation.current) return
      if (loaded.status === 'failed') {
        setDocument((current) => ({
          key,
          markdown:
            cache.current.get(key)?.markdown ??
            (current.key === key ? current.markdown : ''),
          status: 'failed',
          failure: loaded.failure,
        }))
        return
      }

      const value = loaded.value
      const markdown =
        value.presence !== 'present'
          ? ''
          : 'object' in value
            ? value.object.markdown
            : value.entry.markdown
      const existing = cache.current.get(key)
      /*
       * A retry may finish after the reader has typed into the preserved
       * buffer. Only the first successful load supplies source bytes.
       */
      const authoritative = existing?.loaded ? existing.markdown : markdown
      const target: OrdinaryTarget | null = selected
        ? null
        : value.presence === 'present' && 'entry' in value
          ? {
              expectation: 'existing',
              entryId: value.entry.id,
              expectedRevision: value.entry.revision,
            }
          : null
      cache.current.set(key, {
        markdown: authoritative,
        loaded: true,
        target,
        ordinary: selected === null,
        savedMarkdown: existing?.savedMarkdown ?? markdown,
        saveConfirmed: existing?.saveConfirmed ?? false,
      })
      setDocument({
        key,
        markdown: authoritative,
        status: 'ready',
        failure: null,
      })
      setSaveStatus(developmentMock || selected ? 'mock' : 'ready')
      setSaveFailure(null)
    })
  }, [client, developmentMock, key, retryGeneration, selected, window])

  const update = useCallback(
    (markdown: string) => {
      setDocument((current) => {
        if (!current.key) return current
        const cached = cache.current.get(current.key)
        cache.current.set(current.key, {
          markdown,
          loaded: true,
          target: cached?.target ?? null,
          ordinary: cached?.ordinary ?? selected === null,
          savedMarkdown: cached?.savedMarkdown ?? '',
          saveConfirmed: cached?.saveConfirmed ?? false,
        })
        if (!developmentMock && (cached?.ordinary ?? selected === null)) {
          setSaveStatus((status) =>
            status === 'saving'
              ? status
              : markdown === cached?.savedMarkdown
                ? cached.saveConfirmed
                  ? 'saved'
                  : 'ready'
                : 'dirty',
          )
          setSaveFailure(null)
        }
        return { ...current, markdown }
      })
    },
    [developmentMock, selected],
  )

  const save = useCallback(async () => {
    if (!key || !window || selected || developmentMock) return
    const cached = cache.current.get(key)
    if (!cached?.loaded || !cached.ordinary || saveStatus === 'saving') return

    const markdown = cached.markdown
    const target =
      cached.target ??
      ({
        expectation: 'absent',
        newEntryId: client.operations.newStableId(),
      } satisfies OrdinaryTarget)
    cache.current.set(key, { ...cached, target })
    setSaveStatus('saving')
    setSaveFailure(null)

    const result = await client.record.save({
      window,
      markdown,
      nowMs: Date.now(),
      target,
    })
    const current = cache.current.get(key)
    if (!current) return
    if (result.status === 'failed') {
      setSaveFailure(result.failure)
      setSaveStatus('failed')
      return
    }
    if (result.value.outcome === 'conflict') {
      setSaveStatus('conflicted')
      return
    }

    const nextTarget: OrdinaryTarget | null =
      result.value.outcome === 'created' ||
      result.value.outcome === 'updated' ||
      result.value.outcome === 'unchanged'
        ? {
            expectation: 'existing',
            entryId: result.value.entry.id,
            expectedRevision: result.value.entry.revision,
          }
        : null
    cache.current.set(key, {
      ...current,
      target: nextTarget,
      savedMarkdown: markdown,
      saveConfirmed: true,
    })
    setSaveStatus(current.markdown === markdown ? 'saved' : 'dirty')
  }, [client, developmentMock, key, saveStatus, selected, window])

  const retry = useCallback(() => {
    retryRequested.current = true
    setRetryGeneration((value) => value + 1)
  }, [])

  return {
    document:
      key === null
        ? UNAVAILABLE
        : document.key === key
          ? document
          : {
              key,
              markdown: '',
              status: 'loading' as const,
              failure: null,
            },
    update,
    retry,
    save,
    saveStatus,
    saveFailure,
  }
}
