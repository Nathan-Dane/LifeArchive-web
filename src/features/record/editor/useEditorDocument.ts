import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ClientFailure,
  LifeArchiveClient,
  StructuredSummary,
  TimeWindow,
} from '../../../core/client'

export type EditorDocumentStatus =
  'unavailable' | 'loading' | 'ready' | 'failed'

export interface EditorDocument {
  readonly key: string | null
  readonly markdown: string
  readonly status: EditorDocumentStatus
  readonly failure: ClientFailure | null
}

interface CachedDocument {
  markdown: string
  loaded: boolean
}

const UNAVAILABLE: EditorDocument = {
  key: null,
  markdown: '',
  status: 'unavailable',
  failure: null,
}

/**
 * Loads the selected mock document once and then treats the local Markdown
 * buffer as authoritative. Cached buffers are keyed by the exact destination,
 * so switching objects and returning cannot discard writing.
 */
export function useEditorDocument(
  client: LifeArchiveClient,
  window: TimeWindow | null,
  selected: StructuredSummary | null,
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
      cache.current.set(key, { markdown: authoritative, loaded: true })
      setDocument({
        key,
        markdown: authoritative,
        status: 'ready',
        failure: null,
      })
    })
  }, [client, key, retryGeneration, selected, window])

  const update = useCallback((markdown: string) => {
    setDocument((current) => {
      if (!current.key) return current
      cache.current.set(current.key, { markdown, loaded: true })
      return { ...current, markdown }
    })
  }, [])

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
  }
}
