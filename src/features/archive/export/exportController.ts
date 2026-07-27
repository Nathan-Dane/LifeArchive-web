import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ArchiveExportResult,
  ClientFailure,
  LifeArchiveClient,
  OperationId,
} from '../../../core/client'
import {
  deliverArchiveDownload,
  type ArchiveDownloadDelivery,
} from '../../../platform/files/archiveTransfer'

export type ExportPhase =
  | 'ready'
  | 'exporting'
  | 'cancelling'
  | 'delivering'
  | 'complete'
  | 'cancelled'
  | 'failed'
  | 'delivery-failed'

export interface ArchiveExportState {
  readonly phase: ExportPhase
  readonly failure: ClientFailure | null
  readonly delivery: ArchiveDownloadDelivery | null
  readonly result: ArchiveExportResult | null
}

export interface ArchiveExportController {
  readonly state: ArchiveExportState
  readonly begin: () => void
  readonly cancel: () => void
  readonly retry: () => void
  readonly retryDelivery: () => void
  readonly reset: () => void
}

const INITIAL_STATE: ArchiveExportState = {
  phase: 'ready',
  failure: null,
  delivery: null,
  result: null,
}

/**
 * Coordinates one core-verified export and one browser download handoff.
 * Package creation and verification stay entirely inside the core.
 */
export function useArchiveExport(
  client: LifeArchiveClient,
  deliver: (file: File) => ArchiveDownloadDelivery = deliverArchiveDownload,
): ArchiveExportController {
  const [state, setState] = useState<ArchiveExportState>(INITIAL_STATE)
  const stateRef = useRef(state)
  const operation = useRef<OperationId | null>(null)
  const running = useRef(false)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const handOff = useCallback(
    (result: ArchiveExportResult) => {
      setState({
        phase: 'delivering',
        failure: null,
        delivery: null,
        result,
      })
      let delivery: ArchiveDownloadDelivery
      try {
        delivery = deliver(result.archive)
      } catch {
        delivery = {
          outcome: 'failed',
          failure: 'download-handoff-failed',
        }
      }
      setState({
        phase:
          delivery.outcome === 'handed-off' ? 'complete' : 'delivery-failed',
        failure: null,
        delivery,
        result,
      })
    },
    [deliver],
  )

  const run = useCallback(async (): Promise<void> => {
    if (running.current) return
    const session = client.archive.session()
    if (session.state !== 'open') return

    running.current = true
    const operationId = client.operations.newOperationId()
    const artifactId = client.operations.newStableId()
    operation.current = operationId
    setState({
      phase: 'exporting',
      failure: null,
      delivery: null,
      result: null,
    })
    try {
      const result = await client.archive.export({
        operationId,
        artifactId,
        sourceStoreId: session.archive.storeId,
        createdAtMs: Date.now(),
      })
      if (result.status === 'ok') {
        handOff(result.value)
      } else {
        setState({
          phase: result.failure.code === 'cancelled' ? 'cancelled' : 'failed',
          failure: result.failure,
          delivery: null,
          result: null,
        })
      }
    } finally {
      operation.current = null
      running.current = false
    }
  }, [client, handOff])

  const cancel = useCallback(() => {
    const operationId = operation.current
    if (!operationId || stateRef.current.phase !== 'exporting') return
    setState((current) => ({ ...current, phase: 'cancelling' }))
    void client.operations.requestCancel(operationId)
  }, [client])

  const retryDelivery = useCallback(() => {
    const result = stateRef.current.result
    if (result && !running.current) handOff(result)
  }, [handOff])

  const reset = useCallback(() => {
    if (!running.current) setState(INITIAL_STATE)
  }, [])

  return {
    state,
    begin: () => void run(),
    cancel,
    retry: () => void run(),
    retryDelivery,
    reset,
  }
}
