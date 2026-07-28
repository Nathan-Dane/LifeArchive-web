import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ClientFailure,
  LifeArchiveClient,
  OrdinaryConflictState,
  OrdinaryTarget,
  StructuredSummary,
  TimeWindow,
} from '../../../core/client'
import { useRecordDraftSession } from '../recordDraftSession'

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
  | 'offlineRuntime'

export interface EditorDocument {
  readonly key: string | null
  readonly markdown: string
  readonly status: EditorDocumentStatus
  readonly failure: ClientFailure | null
}

interface EditorConflict {
  readonly current: OrdinaryConflictState
  readonly target: OrdinaryTarget
}

interface CachedDocument {
  markdown: string
  loaded: boolean
  target: OrdinaryTarget | null
  ordinary: boolean
  window: TimeWindow
  savedMarkdown: string
  saveConfirmed: boolean
  saveStatus: EditorSaveStatus
  saveFailure: ClientFailure | null
  conflict: EditorConflict | null
  saveGeneration: number
  activeSave: Promise<void> | null
}

interface SaveView {
  readonly key: string | null
  readonly status: EditorSaveStatus
  readonly failure: ClientFailure | null
  readonly conflict: OrdinaryConflictState | null
}

const AUTOSAVE_DELAY_MS = 500
const UNAVAILABLE: EditorDocument = {
  key: null,
  markdown: '',
  status: 'unavailable',
  failure: null,
}

function targetForCurrent(
  client: LifeArchiveClient,
  current: OrdinaryConflictState,
): OrdinaryTarget {
  return current.presence === 'present'
    ? {
        expectation: 'existing',
        entryId: current.entry.id,
        expectedRevision: current.entry.revision,
      }
    : {
        expectation: 'absent',
        newEntryId: client.operations.newStableId(),
      }
}

function currentMarkdown(current: OrdinaryConflictState): string {
  return current.presence === 'present' ? current.entry.markdown : ''
}

/**
 * One in-memory editing session. Each exact destination owns its own buffer,
 * revision, save generation, and outcome so a late response for a destination
 * being left cannot repaint or replace the destination now on screen.
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
  const loadGeneration = useRef(0)
  const retryRequested = useRef(false)
  const mounted = useRef(true)
  const replayingRouteClick = useRef(false)
  const [retryGeneration, setRetryGeneration] = useState(0)
  const [document, setDocument] = useState<EditorDocument>(UNAVAILABLE)
  const [saveView, setSaveView] = useState<SaveView>({
    key: null,
    status: 'unavailable',
    failure: null,
    conflict: null,
  })
  const { register } = useRecordDraftSession()

  const refresh = useCallback((changedKey: string) => {
    if (!mounted.current) return
    const cached = cache.current.get(changedKey)
    if (!cached) return
    setSaveView({
      key: changedKey,
      status: cached.saveStatus,
      failure: cached.saveFailure,
      conflict: cached.conflict?.current ?? null,
    })
  }, [])

  const saveDocument = useCallback(
    async (
      documentKey: string,
      drain: boolean,
      force = false,
    ): Promise<void> => {
      let forceAttempt = force
      while (true) {
        const cached = cache.current.get(documentKey)
        if (
          !cached?.loaded ||
          !cached.ordinary ||
          cached.conflict ||
          developmentMock
        ) {
          return
        }
        if (cached.activeSave) {
          await cached.activeSave
          forceAttempt = false
          continue
        }
        if (cached.markdown === cached.savedMarkdown && !forceAttempt) return
        if (client.runtime.status().state !== 'available') {
          cached.saveStatus = 'offlineRuntime'
          refresh(documentKey)
          return
        }

        const markdown = cached.markdown
        const target =
          cached.target ??
          ({
            expectation: 'absent',
            newEntryId: client.operations.newStableId(),
          } satisfies OrdinaryTarget)
        cached.target = target
        cached.saveStatus = 'saving'
        cached.saveFailure = null
        const request = (cached.saveGeneration += 1)
        refresh(documentKey)

        const operation = client.record
          .save({
            window: cached.window,
            markdown,
            nowMs: Date.now(),
            target,
          })
          .then((result) => {
            const current = cache.current.get(documentKey)
            if (!current || request !== current.saveGeneration) return
            if (result.status === 'failed') {
              current.saveFailure = result.failure
              current.saveStatus =
                client.runtime.status().state === 'available'
                  ? 'failed'
                  : 'offlineRuntime'
              return
            }
            if (result.value.outcome === 'conflict') {
              current.conflict = {
                current: result.value.conflict.current,
                target: targetForCurrent(client, result.value.conflict.current),
              }
              current.saveStatus = 'conflicted'
              return
            }

            current.target =
              result.value.outcome === 'created' ||
              result.value.outcome === 'updated' ||
              result.value.outcome === 'unchanged'
                ? {
                    expectation: 'existing',
                    entryId: result.value.entry.id,
                    expectedRevision: result.value.entry.revision,
                  }
                : null
            current.savedMarkdown = markdown
            current.saveConfirmed = true
            current.saveStatus =
              current.markdown === markdown ? 'saved' : 'dirty'
          })
          .finally(() => {
            const current = cache.current.get(documentKey)
            if (current?.activeSave === operation) current.activeSave = null
            refresh(documentKey)
          })
        cached.activeSave = operation
        await operation
        forceAttempt = false

        const latest = cache.current.get(documentKey)
        if (
          !drain ||
          !latest ||
          latest.conflict ||
          latest.saveFailure ||
          latest.markdown === latest.savedMarkdown
        ) {
          return
        }
      }
    },
    [client, developmentMock, refresh],
  )

  const hasPendingWriting = useCallback(
    () =>
      [...cache.current.values()].some(
        (cached) =>
          cached.ordinary &&
          (cached.markdown !== cached.savedMarkdown ||
            cached.activeSave !== null ||
            cached.conflict !== null),
      ),
    [],
  )

  const flush = useCallback(async () => {
    await Promise.all(
      [...cache.current.entries()].map(([documentKey, cached]) =>
        cached.ordinary ? saveDocument(documentKey, true) : Promise.resolve(),
      ),
    )
  }, [saveDocument])

  useEffect(
    () => register({ hasPendingWriting, flush }),
    [flush, hasPendingWriting, register],
  )

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingWriting()) return
      event.preventDefault()
      event.returnValue = ''
    }
    const flushOnPageHide = () => void flush()
    const flushWhenHidden = () => {
      if (globalThis.document.visibilityState === 'hidden') void flush()
    }
    const flushBeforeRouteClick = (event: MouseEvent) => {
      if (
        replayingRouteClick.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !hasPendingWriting()
      ) {
        return
      }
      const origin =
        event.target instanceof Element ? event.target.closest('a[href]') : null
      if (
        !(origin instanceof HTMLAnchorElement) ||
        origin.target === '_blank' ||
        origin.hasAttribute('download')
      ) {
        return
      }
      const destination = new URL(origin.href, globalThis.window.location.href)
      if (
        destination.origin !== globalThis.window.location.origin ||
        destination.href === globalThis.window.location.href
      ) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      void flush().then(() => {
        /*
         * A failed or conflicted flush deliberately keeps Record mounted so
         * its exact in-memory buffer and actions remain available.
         */
        if (hasPendingWriting()) return
        replayingRouteClick.current = true
        origin.click()
        replayingRouteClick.current = false
      })
    }
    globalThis.window.addEventListener('beforeunload', warnBeforeUnload)
    globalThis.window.addEventListener('pagehide', flushOnPageHide)
    globalThis.document.addEventListener('visibilitychange', flushWhenHidden)
    globalThis.document.addEventListener('click', flushBeforeRouteClick, true)
    return () => {
      globalThis.window.removeEventListener('beforeunload', warnBeforeUnload)
      globalThis.window.removeEventListener('pagehide', flushOnPageHide)
      globalThis.document.removeEventListener(
        'visibilitychange',
        flushWhenHidden,
      )
      globalThis.document.removeEventListener(
        'click',
        flushBeforeRouteClick,
        true,
      )
    }
  }, [flush, hasPendingWriting])

  useEffect(() => {
    const request = (loadGeneration.current += 1)
    if (!key || !window) return

    const cached = cache.current.get(key)
    const force = retryRequested.current
    retryRequested.current = false
    void Promise.resolve().then(async () => {
      if (request !== loadGeneration.current) return
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
      if (request !== loadGeneration.current) return
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
        window,
        savedMarkdown: existing?.savedMarkdown ?? markdown,
        saveConfirmed: existing?.saveConfirmed ?? false,
        saveStatus:
          developmentMock || selected
            ? 'mock'
            : authoritative === (existing?.savedMarkdown ?? markdown)
              ? existing?.saveConfirmed
                ? 'saved'
                : 'ready'
              : 'dirty',
        saveFailure: existing?.saveFailure ?? null,
        conflict: existing?.conflict ?? null,
        saveGeneration: existing?.saveGeneration ?? 0,
        activeSave: existing?.activeSave ?? null,
      })
      setDocument({
        key,
        markdown: authoritative,
        status: 'ready',
        failure: null,
      })
      refresh(key)
    })
  }, [client, developmentMock, key, refresh, retryGeneration, selected, window])

  const saveStatus: EditorSaveStatus =
    (saveView.key === key ? saveView.status : null) ??
    (key === null
      ? 'unavailable'
      : developmentMock || selected
        ? 'mock'
        : 'ready')

  useEffect(() => {
    if (!key || saveStatus !== 'dirty') return
    const timer = globalThis.window.setTimeout(
      () => void saveDocument(key, false),
      AUTOSAVE_DELAY_MS,
    )
    return () => globalThis.window.clearTimeout(timer)
  }, [key, saveStatus, saveDocument, document.markdown])

  const update = useCallback(
    (markdown: string) => {
      if (!key) return
      const cached = cache.current.get(key)
      if (!cached) {
        if (window) {
          cache.current.set(key, {
            markdown,
            loaded: true,
            target: null,
            ordinary: selected === null,
            window,
            savedMarkdown: '',
            saveConfirmed: false,
            saveStatus:
              developmentMock || selected
                ? 'mock'
                : client.runtime.status().state === 'available'
                  ? 'dirty'
                  : 'offlineRuntime',
            saveFailure: null,
            conflict: null,
            saveGeneration: 0,
            activeSave: null,
          })
        }
      } else {
        cached.markdown = markdown
        cached.saveFailure = null
        if (!developmentMock && cached.ordinary && !cached.conflict) {
          cached.saveStatus =
            markdown === cached.savedMarkdown
              ? cached.saveConfirmed
                ? 'saved'
                : 'ready'
              : cached.activeSave
                ? 'saving'
                : client.runtime.status().state === 'available'
                  ? 'dirty'
                  : 'offlineRuntime'
        }
      }
      setDocument((current) =>
        current.key === key ? { ...current, markdown } : current,
      )
      refresh(key)
    },
    [client, developmentMock, key, refresh, selected, window],
  )

  const retryLoad = useCallback(() => {
    retryRequested.current = true
    setRetryGeneration((value) => value + 1)
  }, [])

  const retrySave = useCallback(() => {
    if (!key) return
    const cached = cache.current.get(key)
    if (!cached) return
    cached.saveFailure = null
    cached.saveStatus = 'dirty'
    refresh(key)
    void saveDocument(key, true)
  }, [key, refresh, saveDocument])

  const saveMine = useCallback(() => {
    if (!key) return
    const cached = cache.current.get(key)
    if (!cached?.conflict) return
    cached.target = cached.conflict.target
    cached.conflict = null
    cached.saveStatus = 'dirty'
    cached.saveGeneration += 1
    refresh(key)
    void saveDocument(key, true)
  }, [key, refresh, saveDocument])

  const useArchiveVersion = useCallback(() => {
    if (!key) return
    const cached = cache.current.get(key)
    if (!cached?.conflict) return
    const markdown = currentMarkdown(cached.conflict.current)
    cached.markdown = markdown
    cached.savedMarkdown = markdown
    cached.target = cached.conflict.target
    cached.conflict = null
    cached.saveFailure = null
    cached.saveConfirmed = false
    cached.saveStatus = 'ready'
    cached.saveGeneration += 1
    setDocument((current) =>
      current.key === key ? { ...current, markdown } : current,
    )
    refresh(key)
  }, [key, refresh])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      void flush()
    }
  }, [flush])

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
    retryLoad,
    retrySave,
    saveMine,
    useArchiveVersion,
    saveStatus,
    saveFailure: saveView.key === key ? saveView.failure : null,
    conflict: saveView.key === key ? saveView.conflict : null,
  }
}
