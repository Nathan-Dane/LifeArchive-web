import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ArchiveImportResult,
  ClientFailure,
  LifeArchiveClient,
  OperationId,
} from '../../../core/client'
import {
  selectArchiveTransport,
  type ArchiveTransportFailure,
} from '../../../platform/files/archiveTransfer'

export type ImportPhase =
  'selecting' | 'ready' | 'importing' | 'cancelling' | 'complete' | 'failed'

export interface ArchiveImportState {
  readonly phase: ImportPhase
  readonly file: File | null
  readonly selectionFailure: ArchiveTransportFailure | null
  readonly failure: ClientFailure | null
  readonly result: ArchiveImportResult | null
}

export interface ArchiveImportController {
  readonly state: ArchiveImportState
  readonly select: (file: File | null) => void
  readonly begin: () => void
  readonly cancel: () => void
  readonly retry: () => void
  readonly reset: () => void
}

const INITIAL_STATE: ArchiveImportState = {
  phase: 'selecting',
  file: null,
  selectionFailure: null,
  failure: null,
  result: null,
}

/**
 * Coordinates one opaque package handoff. Verification, record decisions,
 * staging, rollback, and application remain one Rust-owned operation.
 */
export function useArchiveImport(
  client: LifeArchiveClient,
): ArchiveImportController {
  const [state, setState] = useState<ArchiveImportState>(INITIAL_STATE)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  const operation = useRef<OperationId | null>(null)
  const running = useRef(false)

  const select = useCallback((file: File | null) => {
    if (running.current) return
    if (!file) {
      setState(INITIAL_STATE)
      return
    }
    const selected = selectArchiveTransport(file)
    if (selected.outcome === 'rejected') {
      setState({
        ...INITIAL_STATE,
        selectionFailure: selected.failure,
      })
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

  const run = useCallback(
    async (file: File): Promise<void> => {
      if (running.current) return
      running.current = true
      const operationId = client.operations.newOperationId()
      operation.current = operationId
      setState({
        phase: 'importing',
        file,
        selectionFailure: null,
        failure: null,
        result: null,
      })
      try {
        const result = await client.archive.import({
          operationId,
          archive: file,
        })
        if (result.status === 'ok') {
          setState({
            phase: 'complete',
            file,
            selectionFailure: null,
            failure: null,
            result: result.value,
          })
        } else {
          setState({
            phase: 'failed',
            file,
            selectionFailure: null,
            failure: result.failure,
            result: null,
          })
        }
      } finally {
        operation.current = null
        running.current = false
      }
    },
    [client],
  )

  const begin = useCallback(() => {
    const file = stateRef.current.file
    if (file) void run(file)
  }, [run])

  const cancel = useCallback(() => {
    const operationId = operation.current
    if (!operationId || stateRef.current.phase !== 'importing') return
    setState((current) => ({ ...current, phase: 'cancelling' }))
    void client.operations.requestCancel(operationId)
  }, [client])

  const reset = useCallback(() => {
    if (!running.current) setState(INITIAL_STATE)
  }, [])

  return {
    state,
    select,
    begin,
    cancel,
    retry: begin,
    reset,
  }
}
