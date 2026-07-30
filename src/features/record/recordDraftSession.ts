import { createContext, useCallback, useContext, useRef } from 'react'

export interface RecordDraftRegistration {
  readonly hasPendingWriting: () => boolean
  readonly flush: () => Promise<void>
}

interface RecordDraftSession {
  readonly register: (draft: RecordDraftRegistration) => () => void
}

const EMPTY_SESSION: RecordDraftSession = {
  register: () => () => undefined,
}

export const RecordDraftSessionContext =
  createContext<RecordDraftSession>(EMPTY_SESSION)

export function useRecordDraftSession(): RecordDraftSession {
  return useContext(RecordDraftSessionContext)
}

/**
 * Keeps navigation ignorant of editor implementation details while still
 * giving every active draft one chance to commit before the destination moves.
 */
export function useRecordDraftSessionGuard() {
  const drafts = useRef(new Set<RecordDraftRegistration>())
  const transition = useRef(0)

  const register = useCallback((draft: RecordDraftRegistration) => {
    drafts.current.add(draft)
    return () => {
      drafts.current.delete(draft)
    }
  }, [])

  const hasPendingWriting = useCallback(
    () => [...drafts.current].some((draft) => draft.hasPendingWriting()),
    [],
  )

  const flush = useCallback(
    () => Promise.all([...drafts.current].map((draft) => draft.flush())).then(),
    [],
  )

  const flushBefore = useCallback(
    (action: () => void) => {
      const requested = (transition.current += 1)
      void flush().finally(() => {
        if (requested === transition.current) action()
      })
    },
    [flush],
  )

  return { register, hasPendingWriting, flush, flushBefore }
}
