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
  it('maps the runtime archive overview vocabulary into ergonomic facts', async () => {
    const storeId = stableId('A1000000-0000-4000-8000-000000000030')
    let runtimeRequest: unknown
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: (request) => {
          runtimeRequest = request.payload
          return Promise.resolve({
            outcome: 'success',
            result: {
              contractVersion: '5',
              outcome: 'overview',
              storeId,
              schemaVersion: 7,
              storeContractVersion: 5,
              token: {
                storeInstanceId: 'overview-wire-test',
                revision: '9',
              },
              visibleEntryCount: 12,
              entryCounts: {
                moment: 1,
                day: 2,
                week: 3,
                month: 4,
                year: 1,
                custom: 1,
              },
              structuredCounts: { events: 5, spans: 6 },
              trackCounts: {
                active: 2,
                archived: 1,
                ongoingMembers: 3,
              },
              attachmentCount: 8,
              attachmentByteTotal: 4096,
              health: {
                storeReadable: true,
                schemaCompatible: true,
                recoveryState: 'clean',
                databaseIntegrity: 'ok',
                foreignKeyViolationCount: 0,
                status: 'healthy',
              },
            },
          })
        },
        close: () => Promise.resolve(),
      },
    })

    expect(runtimeRequest).toBeUndefined()
    expect(await client.archive.overview()).toEqual({
      status: 'ok',
      value: {
        storeId,
        storeSchemaVersion: '7',
        storeContract: '5',
        visibleEntryCount: 12,
        entryCounts: {
          moment: 1,
          day: 2,
          week: 3,
          month: 4,
          year: 1,
          custom: 1,
        },
        structuredCounts: { events: 5, spans: 6 },
        trackCounts: {
          active: 2,
          archived: 1,
          ongoingMembers: 3,
        },
        mediaCount: 8,
        mediaByteTotal: 4096,
        health: {
          readable: true,
          schemaCompatible: true,
          recovery: 'clean',
          integrity: 'verified',
          referenceViolationCount: 0,
          overall: 'healthy',
        },
        invalidation: {
          storeInstanceId: 'overview-wire-test',
          revision: revision('9'),
        },
      },
    })
    expect(runtimeRequest).toEqual({ request: {}, transfers: [] })
  })

  it('maps ergonomic export input and the verified browser transport result', async () => {
    const exportOperationId = operationId(
      'A1000000-0000-4000-8000-000000000031',
    )
    const archiveId = stableId('A1000000-0000-4000-8000-000000000032')
    let runtimeRequest: unknown
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: (request) => {
          runtimeRequest = request.payload
          return Promise.resolve({
            envelope: {
              outcome: 'success',
              result: {
                contractVersion: '5',
                outcome: 'exported',
                token: {
                  storeInstanceId: 'export-wire-test',
                  revision: '10',
                },
                archiveId,
                createdAt: '2026-07-27T12:00:00Z',
                counts: {
                  entries: 4,
                  attachments: 2,
                  summaries: 0,
                  tracks: 1,
                },
                dateRange: {
                  start: '2026-01-01T00:00:00Z',
                  end: '2026-07-27T23:59:59Z',
                },
                filesWritten: 11,
                checkedFiles: 11,
                checksumAlgorithm: 'sha256',
                browserTransport: {
                  transferId: 'export-transfer',
                  fileName: 'LifeArchive.lifearchive.tar',
                  mimeType: 'application/x-tar',
                  byteLength: '4',
                },
              },
            },
            transfers: [Uint8Array.from([0, 1, 2, 255]).buffer],
          })
        },
        close: () => Promise.resolve(),
      },
    })

    const result = await client.archive.export({
      operationId: exportOperationId,
      archiveId,
      createdAtMs: 1_785_153_600_000,
      application: { name: 'LifeArchive Web', version: '0.1.0' },
    })

    expect(runtimeRequest).toEqual({
      request: {
        operationId: exportOperationId,
        contractVersion: '5',
        archiveId,
        createdAtMs: 1_785_153_600_000,
        createdBy: {
          appName: 'LifeArchive Web',
          appVersion: '0.1.0',
        },
        archiveName: 'LifeArchive.lifearchive',
      },
      transfers: [],
    })
    expect(result).toMatchObject({
      status: 'ok',
      value: {
        archiveId,
        createdAt: '2026-07-27T12:00:00Z',
        counts: { entries: 4, media: 2, summaries: 0 },
        dateRange: {
          start: '2026-01-01T00:00:00Z',
          end: '2026-07-27T23:59:59Z',
        },
        filesWritten: 11,
        checkedFiles: 11,
        checksumAlgorithm: 'sha256',
        invalidation: {
          storeInstanceId: 'export-wire-test',
          revision: revision('10'),
        },
      },
    })
    if (result.status !== 'ok') throw new Error('expected export result')
    expect(result.value.archive).toMatchObject({
      name: 'LifeArchive.lifearchive.tar',
      type: 'application/x-tar',
      size: 4,
    })
  })

  it.each([
    ['corruptStore', 'needs-recovery'],
    ['recoveryIncomplete', 'needs-recovery'],
    ['unsupportedSchema', 'incompatible'],
    ['unsupportedLayout', 'incompatible'],
  ] as const)('maps failed open %s to session %s', async (code, state) => {
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: () =>
          Promise.resolve({
            outcome: 'failure',
            failure: {
              code,
              details: {
                area: 'storage',
                phase: 'open',
                retryable: false,
                durableOutcome: 'not-started',
              },
            },
          }),
        close: () => Promise.resolve(),
      },
    })

    expect((await client.archive.open()).status).toBe('failed')
    expect(client.archive.session().state).toBe(state)
  })

  it('closes definitively and restores the open session when close is rejected', async () => {
    let closeShouldFail = true
    const closeTransport = vi.fn(() => Promise.resolve())
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: (request) => {
          if (request.operation === 'store.open') {
            return Promise.resolve({
              outcome: 'success',
              result: {
                storeId: stableId('A1000000-0000-4000-8000-000000000020'),
                productContract: '5',
                storeSchemaVersion: '1',
                rootLayoutVersion: '1',
                invalidation: {
                  storeInstanceId: 'close-test',
                  revision: revision('1'),
                },
              },
            })
          }
          if (closeShouldFail) {
            return Promise.resolve({
              outcome: 'failure',
              failure: {
                code: 'ioFailure',
                details: {
                  area: 'storage',
                  phase: 'close',
                  retryable: true,
                  durableOutcome: 'known',
                },
              },
            })
          }
          return Promise.resolve({
            outcome: 'success',
            result: { outcome: 'closed' },
          })
        },
        close: closeTransport,
      },
    })
    await client.archive.open()
    const openSession = client.archive.session()

    expect((await client.archive.close()).status).toBe('failed')
    expect(client.archive.session()).toEqual(openSession)
    expect(closeTransport).not.toHaveBeenCalled()

    closeShouldFail = false
    expect(await client.archive.close()).toEqual({
      status: 'ok',
      value: { outcome: 'closed' },
    })
    expect(client.archive.session()).toEqual({ state: 'closed' })
    expect(closeTransport).toHaveBeenCalledOnce()
  })

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

  it('cancels one active export out of band and waits for its definitive result', async () => {
    const exportOperationId = operationId(
      'A1000000-0000-4000-8000-000000000014',
    )
    let exportSignal: AbortSignal | undefined
    let finishExport: ((value: unknown) => void) | undefined
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: (request) => {
          exportSignal = request.signal
          return new Promise((resolve) => {
            finishExport = resolve
          })
        },
        close: () => Promise.resolve(),
      },
    })

    const exported = client.archive.export({
      operationId: exportOperationId,
      archiveId: stableId('A1000000-0000-4000-8000-000000000015'),
      createdAtMs: 1,
      application: { name: 'test', version: '1' },
    })
    await vi.waitFor(() => expect(exportSignal).toBeDefined())

    expect(await client.operations.requestCancel(exportOperationId)).toEqual({
      status: 'ok',
      value: { operationId: exportOperationId, outcome: 'requested' },
    })
    expect(exportSignal?.aborted).toBe(true)

    finishExport?.({
      outcome: 'failure',
      failure: {
        code: 'cancelled',
        details: {
          area: 'cancelled',
          phase: 'cancellation',
          retryable: false,
          durableOutcome: 'known',
        },
      },
    })
    expect(await exported).toMatchObject({
      status: 'failed',
      failure: { code: 'cancelled', durableOutcome: 'known' },
    })
    expect(await client.operations.requestCancel(exportOperationId)).toEqual({
      status: 'ok',
      value: { operationId: exportOperationId, outcome: 'not-active' },
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
