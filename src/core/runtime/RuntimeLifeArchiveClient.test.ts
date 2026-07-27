import { describe, expect, it, vi } from 'vitest'
import { operationId, revision, stableId } from '../client'
import { RuntimeLifeArchiveClient } from './RuntimeLifeArchiveClient'
import { WorkerTransportError } from './worker/WorkerTransport'

const runtime = {
  mode: 'runtime',
  runtimeVersion: '0.1.0',
  buildId: 'fixed',
  productContract: '5',
  browserAbi: '1',
  backend: 'opfs-sqlite',
  durability: 'durable',
} as const

describe('RuntimeLifeArchiveClient', () => {
  it('cancels one active import out of band and publishes its invalidation', async () => {
    const importOperationId = operationId(
      'A1000000-0000-4000-8000-000000000010',
    )
    const storeId = stableId('A1000000-0000-4000-8000-000000000011')
    const invalidation = {
      storeInstanceId: 'after-import',
      revision: revision('2'),
    }
    let importSignal: AbortSignal | undefined
    let finishImport: ((value: unknown) => void) | undefined
    let requestCount = 0
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: (request) => {
          requestCount += 1
          if (request.operation === 'store.open') {
            return Promise.resolve({
              outcome: 'success',
              result: {
                storeId,
                productContract: '5',
                storeSchemaVersion: '1',
                rootLayoutVersion: '1',
                invalidation: {
                  storeInstanceId: 'before-import',
                  revision: revision('1'),
                },
              },
            })
          }
          importSignal = request.signal
          return new Promise((resolve) => {
            finishImport = resolve
          })
        },
        close: () => Promise.resolve(),
      },
    })
    await client.archive.open()
    const changes: unknown[] = []
    client.operations.observeChanges((change) => changes.push(change))

    const archive = new File([Uint8Array.from([1])], 'Selected.lifearchive.tar')
    const arrayBuffer = vi
      .spyOn(archive, 'arrayBuffer')
      .mockRejectedValue(new Error('whole-file buffering is forbidden'))
    const imported = client.archive.import({
      operationId: importOperationId,
      archive,
    })
    await vi.waitFor(() => expect(importSignal).toBeDefined())
    expect(await client.operations.requestCancel(importOperationId)).toEqual({
      status: 'ok',
      value: { operationId: importOperationId, outcome: 'requested' },
    })
    expect(importSignal?.aborted).toBe(true)
    // The runtime's own application vocabulary, which the client renames.
    finishImport?.({
      outcome: 'success',
      result: {
        outcome: 'applied',
        importedEntries: 1,
        importedAttachments: 1,
        importedTracks: 0,
        skippedEntries: 0,
        skippedAttachments: 0,
        skippedTracks: 0,
        skippedEntryIds: [],
        skippedAttachmentIds: [],
        skippedTrackIds: [],
        issues: [],
        identityOutcome: 'legacyPreserved',
        identityConflicts: [],
        identityFilledFields: [],
        token: invalidation,
      },
    })
    const result = await imported
    expect(result).toMatchObject({
      status: 'ok',
      value: {
        importedEntries: 1,
        importedMedia: 1,
        skippedMedia: 0,
        identity: { outcome: 'preserved' },
        invalidation,
      },
    })
    expect(arrayBuffer).not.toHaveBeenCalled()
    expect(changes).toEqual([{ storeId, invalidation }])
    expect(requestCount).toBe(2)
    expect(await client.operations.requestCancel(importOperationId)).toEqual({
      status: 'ok',
      value: { operationId: importOperationId, outcome: 'not-active' },
    })
  })

  it('keeps the open archive selected after a runtime import failure', async () => {
    const storeId = stableId('A1000000-0000-4000-8000-000000000012')
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: (request) => {
          if (request.operation === 'store.open') {
            return Promise.resolve({
              outcome: 'success',
              result: {
                storeId,
                productContract: '5',
                storeSchemaVersion: '1',
                rootLayoutVersion: '1',
                invalidation: {
                  storeInstanceId: 'before-failure',
                  revision: revision('1'),
                },
              },
            })
          }
          return Promise.resolve({
            outcome: 'failure',
            failure: {
              code: 'archiveTransportFailure',
              details: {
                area: 'archive',
                phase: 'mutation',
                retryable: true,
                durableOutcome: 'known',
              },
            },
          })
        },
        close: () => Promise.resolve(),
      },
    })
    const opened = await client.archive.open()
    expect(opened.status).toBe('ok')
    const sessionBefore = client.archive.session()

    const imported = await client.archive.import({
      operationId: operationId('A1000000-0000-4000-8000-000000000013'),
      archive: new File([Uint8Array.from([1])], 'Failed.lifearchive.tar'),
    })

    expect(imported).toMatchObject({
      status: 'failed',
      failure: { code: 'archiveTransportFailure' },
    })
    expect(client.archive.session()).toEqual(sessionBefore)
    expect(client.archive.session().state).toBe('open')
  })

  it('maps one fixed runtime result without changing exact values or order', async () => {
    const exactRevision = revision('18446744073709551615')
    const exactId = stableId('A1000000-0000-4000-8000-000000000002')
    const resultValue = {
      outcome: 'deleted',
      deletedEntryId: exactId,
      deletedRevision: exactRevision,
      invalidation: {
        storeInstanceId: 'fixed',
        revision: exactRevision,
      },
      orderedUnknownSemanticIds: ['future.tag', 'other.tag'],
    }
    const calls: { operation: string; payload: unknown }[] = []
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: (request) => {
          calls.push({
            operation: request.operation,
            payload: request.payload,
          })
          return Promise.resolve({
            outcome: 'success',
            result: resultValue,
          })
        },
        close: () => Promise.resolve(),
      },
    })

    const result = await client.record.delete({
      entryId: exactId,
      expectedRevision: exactRevision,
      nowMs: 1,
    })
    expect(result).toEqual({ status: 'ok', value: resultValue })
    expect(result.status === 'ok' && Object.isFrozen(result.value)).toBe(true)
    expect(
      result.status === 'ok' &&
        (result.value as typeof resultValue).orderedUnknownSemanticIds,
    ).toEqual(['future.tag', 'other.tag'])
    expect(calls[0]?.operation).toBe('record.deleteEntry')
  })

  it('maps stable wire failures once and does not expose diagnostics', async () => {
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: () =>
          Promise.resolve({
            outcome: 'failure',
            failure: {
              code: 'futureStableCode',
              details: {
                area: 'record',
                phase: 'mutation',
                retryable: true,
                privateDiagnostic: 'must not escape',
              },
            },
          }),
        close: () => Promise.resolve(),
      },
    })
    const result = await client.record.load({} as never)
    expect(result).toEqual({
      status: 'failed',
      failure: expect.objectContaining({
        area: 'record',
        code: 'futureStableCode',
        phase: 'mutation',
        retryable: true,
      }),
    })
    expect(JSON.stringify(result)).not.toContain('privateDiagnostic')
  })

  it('moves media bytes through transfer payloads and maps returned bytes', async () => {
    const mediaId = stableId('A1000000-0000-4000-8000-000000000004')
    const parentId = stableId('A1000000-0000-4000-8000-000000000005')
    const source = new Uint8Array([0, 255, 13, 10]).buffer
    const seenTransfers: ArrayBuffer[] = []
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: (request) => {
          seenTransfers.push(...(request.transfer ?? []))
          if (request.operation === 'media.import') {
            return Promise.resolve({
              outcome: 'success',
              result: { outcome: 'imported' },
            })
          }
          return Promise.resolve({
            envelope: {
              outcome: 'success',
              result: {
                mediaId,
                byteSize: 4,
                sha256: null,
              },
            },
            transfers: [new Uint8Array([0, 255, 13, 10]).buffer],
          })
        },
        close: () => Promise.resolve(),
      },
    })

    await client.media.import({
      newMediaId: mediaId,
      parentEntryId: parentId,
      expectedParentRevision: revision('1'),
      fileName: 'exact.bin',
      bytes: source,
      createdAtMs: 1,
      mimeTypeHint: null,
      kindHint: null,
    })
    expect(seenTransfers).toEqual([source])

    const content = await client.media.content({ mediaId })
    expect(content.status === 'ok' ? [...content.value.bytes] : null).toEqual([
      0, 255, 13, 10,
    ])
  })

  it('turns worker loss into explicit runtime and archive loss states', async () => {
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: () =>
          Promise.reject(new WorkerTransportError('worker-lost', 'unknown')),
        close: () => Promise.resolve(),
      },
    })
    await client.archive.open()
    expect(client.runtime.status()).toEqual({
      state: 'unavailable',
      reason: 'worker-lost',
    })
    expect(client.archive.session()).toEqual({
      state: 'lost',
      durableOutcome: 'unknown',
    })
  })

  it('distinguishes an absent existing root from creation without substituting an archive', async () => {
    const dispositions: unknown[] = []
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: (request) => {
          const payload = request.payload as {
            readonly request: { readonly disposition?: unknown }
          }
          dispositions.push(payload.request.disposition)
          return Promise.resolve({
            outcome: 'failure',
            failure: {
              code: 'archiveNotFound',
              details: {
                area: 'lifecycle',
                phase: 'rootValidation',
                retryable: false,
                durableOutcome: 'not-started',
              },
            },
          })
        },
        close: () => Promise.resolve(),
      },
    })

    const result = await client.archive.open()

    expect(result).toMatchObject({
      status: 'failed',
      failure: { code: 'archiveNotFound' },
    })
    expect(dispositions).toEqual(['existing'])
    expect(client.archive.session()).toEqual({ state: 'no-archive' })
  })
})
