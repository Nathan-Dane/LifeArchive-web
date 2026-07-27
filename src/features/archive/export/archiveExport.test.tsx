import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  clientFailure,
  failed,
  ok,
  operationId,
  revision,
  stableId,
  type ArchiveExportRequest,
  type ArchiveExportResult,
  type ClientResult,
  type LifeArchiveClient,
} from '../../../core/client'
import type { ArchiveDownloadDelivery } from '../../../platform/files/archiveTransfer'
import { useArchiveExport } from './exportController'

const STORE_ID = stableId('7f1c0a10-0000-4000-8000-000000000031')
const OPERATION_ID = operationId('7f1c0a10-0000-4000-8000-000000000032')
const ARTIFACT_ID = stableId('7f1c0a10-0000-4000-8000-000000000033')
const SECOND_ARTIFACT_ID = stableId('7f1c0a10-0000-4000-8000-000000000034')
const PACKAGE_BYTES = Uint8Array.from([0, 255, 17, 34, 51])
const PACKAGE = new File([PACKAGE_BYTES], 'Export.lifearchive.tar', {
  type: 'application/octet-stream',
})
const RESULT: ArchiveExportResult = {
  archive: PACKAGE,
  artifactId: ARTIFACT_ID,
  sourceStoreId: STORE_ID,
  createdAt: '2026-07-27T12:00:00Z',
  counts: { entries: 7, media: 2, summaries: 0 },
  dateRange: { start: '2026-01-01', end: '2026-07-27' },
  filesWritten: 14,
  checkedFiles: 14,
  checksumAlgorithm: 'sha256',
  invalidation: {
    storeInstanceId: 'export-test',
    revision: revision('8'),
  },
}

function clientFor(
  exportResult:
    | ClientResult<ArchiveExportResult>
    | Promise<ClientResult<ArchiveExportResult>>,
) {
  const exportArchive = vi.fn((request: ArchiveExportRequest) => {
    void request
    return Promise.resolve(exportResult)
  })
  const requestCancel = vi.fn(() =>
    Promise.resolve(
      ok({ operationId: OPERATION_ID, outcome: 'requested' as const }),
    ),
  )
  const newStableId = vi
    .fn()
    .mockReturnValueOnce(ARTIFACT_ID)
    .mockReturnValue(SECOND_ARTIFACT_ID)
  const client = {
    archive: {
      session: () => ({
        state: 'open',
        archive: {
          storeId: STORE_ID,
          productContract: '5',
          storeSchemaVersion: '7',
          rootLayoutVersion: '1',
          invalidation: RESULT.invalidation,
        },
      }),
      export: exportArchive,
    },
    operations: {
      newOperationId: () => OPERATION_ID,
      newStableId,
      requestCancel,
    },
  } as unknown as LifeArchiveClient
  return { client, exportArchive, newStableId, requestCancel }
}

describe('verified archive export', () => {
  it('hands only a successful core export to browser delivery', async () => {
    const { client, exportArchive } = clientFor(ok(RESULT))
    const deliver = vi.fn((): ArchiveDownloadDelivery => ({
      outcome: 'handed-off',
      filename: PACKAGE.name,
    }))
    const { result } = renderHook(() => useArchiveExport(client, deliver))

    act(() => result.current.begin())
    await waitFor(() => expect(result.current.state.phase).toBe('complete'))

    expect(exportArchive).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: OPERATION_ID,
        artifactId: ARTIFACT_ID,
        sourceStoreId: STORE_ID,
      }),
    )
    expect(ARTIFACT_ID).not.toBe(STORE_ID)
    expect(deliver).toHaveBeenCalledOnce()
    expect(deliver).toHaveBeenCalledWith(PACKAGE)
    expect(result.current.state.result).toBe(RESULT)
  })

  it('mints a fresh artifact identity for every export attempt', async () => {
    const { client, exportArchive, newStableId } = clientFor(ok(RESULT))
    const deliver = vi.fn((): ArchiveDownloadDelivery => ({
      outcome: 'handed-off',
      filename: PACKAGE.name,
    }))
    const { result } = renderHook(() => useArchiveExport(client, deliver))

    act(() => result.current.begin())
    await waitFor(() => expect(result.current.state.phase).toBe('complete'))
    act(() => result.current.reset())
    act(() => result.current.begin())
    await waitFor(() => expect(exportArchive).toHaveBeenCalledTimes(2))

    expect(newStableId).toHaveBeenCalledTimes(2)
    expect(exportArchive.mock.calls[0]?.[0]).toMatchObject({
      artifactId: ARTIFACT_ID,
      sourceStoreId: STORE_ID,
    })
    expect(exportArchive.mock.calls[1]?.[0]).toMatchObject({
      artifactId: SECOND_ARTIFACT_ID,
      sourceStoreId: STORE_ID,
    })
  })

  it('keeps core failure separate and never hands off partial output', async () => {
    const { client } = clientFor(
      failed(
        clientFailure({
          area: 'archive',
          code: 'ioFailure',
          phase: 'snapshot',
          retryable: true,
          durableOutcome: 'known',
        }),
      ),
    )
    const deliver = vi.fn()
    const { result } = renderHook(() => useArchiveExport(client, deliver))

    act(() => result.current.begin())
    await waitFor(() => expect(result.current.state.phase).toBe('failed'))
    expect(deliver).not.toHaveBeenCalled()
    expect(result.current.state.result).toBeNull()
  })

  it('waits for the definitive cancelled result after requesting scoped cancellation', async () => {
    let settle: ((value: ClientResult<ArchiveExportResult>) => void) | undefined
    const pending = new Promise<ClientResult<ArchiveExportResult>>(
      (resolve) => {
        settle = resolve
      },
    )
    const { client, requestCancel } = clientFor(pending)
    const deliver = vi.fn()
    const { result } = renderHook(() => useArchiveExport(client, deliver))

    act(() => result.current.begin())
    await waitFor(() => expect(result.current.state.phase).toBe('exporting'))
    act(() => result.current.cancel())
    expect(result.current.state.phase).toBe('cancelling')
    expect(requestCancel).toHaveBeenCalledWith(OPERATION_ID)

    settle?.(
      failed(
        clientFailure({
          area: 'cancelled',
          code: 'cancelled',
          phase: 'cancellation',
          retryable: false,
          durableOutcome: 'known',
        }),
      ),
    )
    await waitFor(() => expect(result.current.state.phase).toBe('cancelled'))
    expect(deliver).not.toHaveBeenCalled()
  })

  it('reports delivery failure without discarding the verified package and can retry only delivery', async () => {
    const { client, exportArchive } = clientFor(ok(RESULT))
    const deliver = vi
      .fn<(file: File) => ArchiveDownloadDelivery>()
      .mockImplementationOnce(() => {
        throw new Error('browser handoff failed')
      })
      .mockReturnValueOnce({
        outcome: 'handed-off',
        filename: PACKAGE.name,
      })
    const { result } = renderHook(() => useArchiveExport(client, deliver))

    act(() => result.current.begin())
    await waitFor(() =>
      expect(result.current.state.phase).toBe('delivery-failed'),
    )
    expect(result.current.state.result).toBe(RESULT)

    act(() => result.current.retryDelivery())
    expect(result.current.state.phase).toBe('complete')
    expect(exportArchive).toHaveBeenCalledOnce()
    expect(deliver).toHaveBeenCalledTimes(2)
  })
})
