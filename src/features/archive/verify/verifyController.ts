import { useCallback, useRef, useState } from 'react'
import type {
  ArchiveVerification,
  ClientFailure,
  LifeArchiveClient,
} from '../../../core/client'
import {
  selectArchiveTransport,
  type ArchiveTransportFailure,
} from '../../../platform/files/archiveTransfer'

export type VerifyPhase =
  'selecting' | 'ready' | 'verifying' | 'complete' | 'failed'

export interface ArchiveVerifyState {
  readonly phase: VerifyPhase
  readonly file: File | null
  readonly selectionFailure: ArchiveTransportFailure | null
  readonly failure: ClientFailure | null
  readonly result: ArchiveVerification | null
}

const INITIAL_STATE: ArchiveVerifyState = {
  phase: 'selecting',
  file: null,
  selectionFailure: null,
  failure: null,
  result: null,
}

export function useArchiveVerify(client: LifeArchiveClient) {
  const [state, setState] = useState<ArchiveVerifyState>(INITIAL_STATE)
  const running = useRef(false)

  const select = useCallback((file: File | null) => {
    if (running.current) return
    if (!file) {
      setState(INITIAL_STATE)
      return
    }
    const selected = selectArchiveTransport(file)
    if (selected.outcome === 'rejected') {
      setState({ ...INITIAL_STATE, selectionFailure: selected.failure })
      return
    }
    setState({
      phase: 'ready',
      file: selected.file,
      selectionFailure: null,
      failure: null,
      result: null,
    })
  }, [])

  const verify = useCallback(
    async (file: File): Promise<void> => {
      if (running.current) return
      running.current = true
      setState({
        phase: 'verifying',
        file,
        selectionFailure: null,
        failure: null,
        result: null,
      })
      try {
        const result = await client.archive.verify({ archive: file })
        setState(
          result.status === 'ok'
            ? {
                phase: 'complete',
                file,
                selectionFailure: null,
                failure: null,
                result: result.value,
              }
            : {
                phase: 'failed',
                file,
                selectionFailure: null,
                failure: result.failure,
                result: null,
              },
        )
      } finally {
        running.current = false
      }
    },
    [client],
  )

  const begin = useCallback(() => {
    if (state.file) void verify(state.file)
  }, [state.file, verify])

  const reset = useCallback(() => {
    if (!running.current) setState(INITIAL_STATE)
  }, [])

  return {
    state,
    select,
    begin,
    retry: begin,
    reset,
  }
}
