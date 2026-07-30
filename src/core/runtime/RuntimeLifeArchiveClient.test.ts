import { describe, expect, it, vi } from 'vitest'
import {
  civilDate,
  clientFailure,
  coreTimeWindow,
  operationId,
  revision,
  stableId,
} from '../client'
import packageMetadata from '../../../package.json'
import { RuntimeLifeArchiveClient } from './RuntimeLifeArchiveClient'
import {
  WorkerTransport,
  WorkerTransportError,
  type WorkerRequestOptions,
} from './worker/WorkerTransport'
import { FixedWorker } from './worker/fixtures/FixedWorker'

const runtime = {
  mode: 'runtime',
  runtimeVersion: '0.1.0',
  buildId: 'fixed',
  productContract: '5',
  browserAbi: '1',
  backend: 'opfs-sqlite',
  durability: 'durable',
} as const

const testWindow = coreTimeWindow({
  id: 'opaque-test-window',
  scale: 'day',
  startMs: 1,
  endMs: 2,
  startDate: civilDate('2026-07-27'),
  endDate: civilDate('2026-07-27'),
  weekNumber: 31,
  calendarId: 'gregorian',
  timeZoneId: 'Europe/Copenhagen',
})

function runtimeOpenResult(
  storeId: ReturnType<typeof stableId>,
  storeInstanceId: string,
  tokenRevision = '1',
  schemaVersion = '7',
) {
  return {
    outcome: 'opened',
    productContractVersion: '5',
    rootLayoutVersion: '1',
    storeId,
    schemaVersion,
    token: { storeInstanceId, revision: tokenRevision },
    ready: true,
    versions: {},
  }
}

function runtimeOverviewResult(
  storeId: ReturnType<typeof stableId>,
  storeInstanceId: string,
  tokenRevision = '1',
  schemaVersion = 7,
) {
  return {
    contractVersion: '5',
    outcome: 'overview',
    storeId,
    schemaVersion,
    storeContractVersion: 5,
    token: { storeInstanceId, revision: tokenRevision },
    visibleEntryCount: 0,
    entryCounts: {
      day: 0,
      week: 0,
      month: 0,
      year: 0,
      event: 0,
      span: 0,
    },
    structuredCounts: { events: 0, spans: 0 },
    trackCounts: { active: 0, archived: 0, ongoingMembers: 0 },
    attachmentCount: 0,
    attachmentByteTotal: 0,
    health: {
      storeReadable: true,
      schemaCompatible: true,
      recoveryState: 'clean',
      databaseIntegrity: 'ok',
      foreignKeyViolationCount: 0,
      status: 'healthy',
    },
  }
}

function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

async function openClientWithWorker(generation: string) {
  const worker = new FixedWorker()
  const transport = new WorkerTransport({
    createWorker: () => worker.asWorker(),
    generation,
  })
  const client = new RuntimeLifeArchiveClient({ runtime, transport })
  const opening = client.archive.open()
  await vi.waitFor(() => expect(worker.requests()).toHaveLength(1))
  const request = worker.requests()[0]
  worker.respond(generation, request.requestId, {
    envelope: {
      outcome: 'success',
      result: runtimeOpenResult(
        stableId('A1000000-0000-4000-8000-000000000099'),
        'worker-loss-test',
      ),
    },
    transfers: [],
  })
  await opening
  return { client, worker }
}

describe('RuntimeLifeArchiveClient', () => {
  it('maps all three Record time operations through the approved browser ABI', async () => {
    const request = vi.fn(({ operation }: WorkerRequestOptions) =>
      Promise.resolve({
        outcome: 'success',
        result:
          operation === 'time.calendarContext'
            ? {
                focused: testWindow,
                focusedDate: '2026-07-27',
                week: [
                  {
                    date: '2026-07-27',
                    window: testWindow,
                    withinFocusedMonth: true,
                  },
                ],
                month: [
                  {
                    date: '2026-07-27',
                    window: testWindow,
                    withinFocusedMonth: true,
                  },
                ],
              }
            : testWindow,
      }),
    )
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request,
        close: () => Promise.resolve(),
      },
    })
    const weekRules = { firstWeekday: 1, minimumDaysInFirstWeek: 4 }
    const window = coreTimeWindow({
      id: 'opaque-window',
      scale: 'week',
      startMs: 1,
      endMs: 2,
      startDate: civilDate('2026-07-20'),
      endDate: civilDate('2026-07-26'),
      weekNumber: 30,
      calendarId: 'gregorian',
      timeZoneId: 'Europe/Copenhagen',
    })

    await expect(client.runtime.storage()).resolves.toEqual({
      status: 'ok',
      value: {
        backend: 'opfs-sqlite',
        durability: 'durable',
        archiveOpen: false,
        grant: 'unknown',
        estimate: null,
      },
    })
    const resolvedWindow = await client.time.window({
      scale: 'day',
      containing: civilDate('2026-07-27'),
      timeZoneId: 'Europe/Copenhagen',
      weekRules,
    })
    expect(resolvedWindow).toEqual({ status: 'ok', value: testWindow })
    await expect(
      client.time.window({
        scale: 'day',
        containing: civilDate('2026-07-27'),
        timeZoneId: 'Europe/Copenhagen',
        weekRules,
      }),
    ).resolves.toEqual({ status: 'ok', value: testWindow })
    await expect(
      client.time.step({ window, step: 'next', weekRules }),
    ).resolves.toEqual({ status: 'ok', value: testWindow })
    await expect(
      client.time.calendarContext({
        focusedDate: civilDate('2026-07-27'),
        timeZoneId: 'Europe/Copenhagen',
        weekRules,
      }),
    ).resolves.toMatchObject({
      status: 'ok',
      value: {
        focusedDate: '2026-07-27',
        week: [{ date: '2026-07-27' }],
        month: [{ date: '2026-07-27' }],
      },
    })
    expect(request.mock.calls.map(([call]) => call.operation)).toEqual([
      'time.window',
      'time.window',
      'time.step',
      'time.calendarContext',
    ])
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      payload: {
        request: {
          contractVersion: 1,
          scale: 'day',
          anchorDate: '2026-07-27',
          calendarIdentifier: 'gregorian',
          timeZoneIdentifier: 'Europe/Copenhagen',
          firstWeekday: 1,
          minimumDaysInFirstWeek: 4,
        },
      },
    })
  })

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
              visibleEntryCount: 21,
              entryCounts: {
                day: 1,
                week: 2,
                month: 3,
                year: 4,
                event: 5,
                span: 6,
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
        visibleEntryCount: 21,
        entryCounts: {
          day: 1,
          week: 2,
          month: 3,
          year: 4,
          event: 5,
          span: 6,
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
    const artifactId = stableId('A1000000-0000-4000-8000-000000000032')
    const sourceStoreId = stableId('A1000000-0000-4000-8000-000000000033')
    let runtimeRequest: unknown
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: (request) => {
          if (request.operation === 'store.open') {
            return Promise.resolve({
              outcome: 'success',
              result: runtimeOpenResult(sourceStoreId, 'export-open-test'),
            })
          }
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
                archiveId: artifactId,
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

    await expect(client.archive.open()).resolves.toMatchObject({ status: 'ok' })
    const result = await client.archive.export({
      operationId: exportOperationId,
      artifactId,
      sourceStoreId,
      createdAtMs: 1_785_153_600_000,
    })

    expect(runtimeRequest).toEqual({
      request: {
        operationId: exportOperationId,
        contractVersion: '5',
        archiveId: artifactId,
        createdAtMs: 1_785_153_600_000,
        createdBy: {
          appName: 'LifeArchive Web',
          appVersion: packageMetadata.version,
        },
        archiveName: 'LifeArchive.lifearchive',
      },
      transfers: [],
    })
    expect(packageMetadata.version).toBe('0.1.0')
    expect(result).toMatchObject({
      status: 'ok',
      value: {
        artifactId,
        sourceStoreId,
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

  it('rejects a mislabeled export source before runtime dispatch', async () => {
    const openStoreId = stableId('A1000000-0000-4000-8000-000000000034')
    const operations: string[] = []
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: ({ operation }) => {
          operations.push(operation)
          return Promise.resolve({
            outcome: 'success',
            result: runtimeOpenResult(openStoreId, 'export-source-test'),
          })
        },
        close: () => Promise.resolve(),
      },
    })
    await expect(client.archive.open()).resolves.toMatchObject({ status: 'ok' })

    await expect(
      client.archive.export({
        operationId: operationId('A1000000-0000-4000-8000-000000000035'),
        artifactId: stableId('A1000000-0000-4000-8000-000000000036'),
        sourceStoreId: stableId('A1000000-0000-4000-8000-000000000037'),
        createdAtMs: 1,
      }),
    ).resolves.toMatchObject({
      status: 'failed',
      failure: {
        code: 'invalidIdentifier',
        field: 'sourceStoreId',
        durableOutcome: 'not-started',
      },
    })
    expect(operations).toEqual(['store.open'])
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
              result: runtimeOpenResult(
                stableId('A1000000-0000-4000-8000-000000000020'),
                'close-test',
                '1',
                '1',
              ),
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

  it('rejects a simultaneous close without overwriting an active open', async () => {
    const pendingOpen = deferred<unknown>()
    const request = vi.fn((request: { readonly operation: string }) => {
      void request.operation
      return pendingOpen.promise
    })
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request,
        close: () => Promise.resolve(),
      },
    })

    const opening = client.archive.open()
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
    expect(await client.archive.close()).toEqual({
      status: 'failed',
      failure: clientFailure({
        area: 'concurrency',
        code: 'busyRetryable',
        phase: 'lock',
        retryable: true,
        durableOutcome: 'not-started',
      }),
    })
    expect(client.archive.session()).toEqual({ state: 'opening' })
    expect(request.mock.calls.map(([call]) => call.operation)).toEqual([
      'store.open',
    ])

    const wireArchive = runtimeOpenResult(
      stableId('A1000000-0000-4000-8000-000000000021'),
      'simultaneous-open',
      '1',
      '1',
    )
    const archive = {
      storeId: stableId('A1000000-0000-4000-8000-000000000021'),
      productContract: '5',
      storeSchemaVersion: '1',
      rootLayoutVersion: '1',
      invalidation: {
        storeInstanceId: 'simultaneous-open',
        revision: revision('1'),
      },
    }
    pendingOpen.resolve({ outcome: 'success', result: wireArchive })
    expect(await opening).toEqual({ status: 'ok', value: archive })
    expect(client.archive.session()).toEqual({ state: 'open', archive })
  })

  it('admits only one archive operation and never queues stale cross-operation work', async () => {
    const pendingVerify = deferred<unknown>()
    const operations: string[] = []
    const initialStoreId = stableId('A1000000-0000-4000-8000-000000000020')
    const freshStoreId = stableId('A1000000-0000-4000-8000-000000000026')
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: (request) => {
          operations.push(request.operation)
          if (request.operation === 'archive.verify') {
            return pendingVerify.promise
          }
          if (request.operation === 'store.open') {
            return Promise.resolve({
              outcome: 'success',
              result: runtimeOpenResult(
                initialStoreId,
                'before-exclusive-erase',
              ),
            })
          }
          if (request.operation === 'archive.overview') {
            return Promise.resolve({
              outcome: 'success',
              result: runtimeOverviewResult(
                freshStoreId,
                'after-exclusive-erase',
                '2',
              ),
            })
          }
          return Promise.resolve({
            outcome: 'success',
            result: {
              outcome: 'erased',
              token: {
                storeInstanceId: 'after-exclusive-erase',
                revision: revision('2'),
              },
            },
          })
        },
        close: () => Promise.resolve(),
      },
    })
    const archive = new File([Uint8Array.from([1])], 'Selected.lifearchive.tar')
    const verifying = client.archive.verify({ archive })
    await vi.waitFor(() => expect(operations).toEqual(['archive.verify']))

    const rejected = await Promise.all([
      client.archive.import({
        operationId: operationId('A1000000-0000-4000-8000-000000000022'),
        archive,
      }),
      client.archive.export({
        operationId: operationId('A1000000-0000-4000-8000-000000000023'),
        artifactId: stableId('A1000000-0000-4000-8000-000000000024'),
        sourceStoreId: stableId('A1000000-0000-4000-8000-000000000025'),
        createdAtMs: 1_785_153_600_000,
      }),
      client.archive.erase({ confirmation: 'erase-this-archive' }),
      client.archive.open(),
    ])

    for (const result of rejected) {
      expect(result).toMatchObject({
        status: 'failed',
        failure: {
          area: 'concurrency',
          code: 'busyRetryable',
          phase: 'lock',
          retryable: true,
          durableOutcome: 'not-started',
        },
      })
    }
    expect(operations).toEqual(['archive.verify'])

    pendingVerify.resolve({
      outcome: 'success',
      result: { valid: true, issues: [], checkedFiles: 1 },
    })
    expect((await verifying).status).toBe('ok')
    await Promise.resolve()
    expect(operations).toEqual(['archive.verify'])

    await client.archive.open()
    expect(
      await client.archive.erase({ confirmation: 'erase-this-archive' }),
    ).toMatchObject({ status: 'ok', value: { outcome: 'erased' } })
    expect(operations).toEqual([
      'archive.verify',
      'store.open',
      'archive.erase',
      'archive.overview',
    ])
  })

  it('keeps a confirmed product close definitive if transport teardown fails', async () => {
    const teardownLoss = new WorkerTransportError('worker-lost', 'known')
    let reportFatal: ((error: WorkerTransportError) => void) | undefined
    const closeTransport = vi.fn(() => {
      reportFatal?.(teardownLoss)
      return Promise.reject(teardownLoss)
    })
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: (request) =>
          Promise.resolve(
            request.operation === 'store.open'
              ? {
                  outcome: 'success',
                  result: runtimeOpenResult(
                    stableId('A1000000-0000-4000-8000-000000000025'),
                    'close-teardown',
                    '1',
                    '1',
                  ),
                }
              : {
                  outcome: 'success',
                  result: { outcome: 'closed' },
                },
          ),
        close: closeTransport,
        observeFatal: (listener) => {
          reportFatal = listener
          return () => undefined
        },
      },
    })

    await client.archive.open()
    expect(await client.archive.close()).toEqual({
      status: 'ok',
      value: { outcome: 'closed' },
    })
    expect(client.archive.session()).toEqual({ state: 'closed' })
    expect(client.runtime.status()).toEqual({
      state: 'available',
      runtime,
    })
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
              result: runtimeOpenResult(storeId, 'before-import', '1', '1'),
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

  it('reports track-only and recovery-only import mutations as changed', async () => {
    const storeId = stableId('A1000000-0000-4000-8000-000000000087')
    const afterTrack = {
      storeInstanceId: 'track-only-import',
      revision: revision('2'),
    }
    let importCount = 0
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: ({ operation }) => {
          if (operation === 'store.open') {
            return Promise.resolve({
              outcome: 'success',
              result: runtimeOpenResult(storeId, 'track-only-import', '1', '1'),
            })
          }
          importCount += 1
          return Promise.resolve({
            outcome: 'success',
            result: {
              outcome: 'applied',
              importedEntries: 0,
              importedAttachments: 0,
              importedTracks: importCount === 1 ? 1 : 0,
              skippedEntries: 0,
              skippedAttachments: 0,
              skippedTracks: 0,
              skippedEntryIds: [],
              skippedAttachmentIds: [],
              skippedTrackIds: [],
              issues:
                importCount === 1
                  ? []
                  : [
                      {
                        code: 'recoveryPending',
                        field: null,
                        recordKind: null,
                        id: null,
                      },
                    ],
              identityOutcome: 'legacyPreserved',
              identityConflicts: [],
              identityFilledFields: [],
              token: afterTrack,
            },
          })
        },
        close: () => Promise.resolve(),
      },
    })
    await client.archive.open()
    const archive = new File([Uint8Array.from([1])], 'Import.lifearchive.tar')

    const trackOnly = await client.archive.import({
      operationId: operationId('A1000000-0000-4000-8000-000000000088'),
      archive,
    })
    expect(trackOnly).toMatchObject({
      status: 'ok',
      value: {
        changed: true,
        recovery: 'clean',
        importedEntries: 0,
        importedMedia: 0,
        importedTracks: 1,
      },
    })

    const recoveryOnly = await client.archive.import({
      operationId: operationId('A1000000-0000-4000-8000-000000000089'),
      archive,
    })
    expect(recoveryOnly).toMatchObject({
      status: 'ok',
      value: {
        changed: true,
        recovery: 'pending',
        importedEntries: 0,
        importedMedia: 0,
        importedTracks: 0,
      },
    })
  })

  it('cancels one active export out of band and waits for its definitive result', async () => {
    const exportOperationId = operationId(
      'A1000000-0000-4000-8000-000000000014',
    )
    const sourceStoreId = stableId('A1000000-0000-4000-8000-000000000016')
    let exportSignal: AbortSignal | undefined
    let finishExport: ((value: unknown) => void) | undefined
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: (request) => {
          if (request.operation === 'store.open') {
            return Promise.resolve({
              outcome: 'success',
              result: runtimeOpenResult(sourceStoreId, 'export-cancel-test'),
            })
          }
          exportSignal = request.signal
          return new Promise((resolve) => {
            finishExport = resolve
          })
        },
        close: () => Promise.resolve(),
      },
    })

    await expect(client.archive.open()).resolves.toMatchObject({ status: 'ok' })
    const exported = client.archive.export({
      operationId: exportOperationId,
      artifactId: stableId('A1000000-0000-4000-8000-000000000015'),
      sourceStoreId,
      createdAtMs: 1,
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
              result: runtimeOpenResult(storeId, 'before-failure', '1', '1'),
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

  it('publishes successful erase invalidation so stale archive views close, but publishes nothing on failure', async () => {
    const storeId = stableId('A1000000-0000-4000-8000-000000000016')
    const freshStoreId = stableId('A1000000-0000-4000-8000-000000000017')
    const erasedInvalidation = {
      storeInstanceId: 'after-erase',
      revision: revision('1'),
    }
    let eraseShouldFail = false
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: (request) => {
          if (request.operation === 'store.open') {
            return Promise.resolve({
              outcome: 'success',
              result: runtimeOpenResult(storeId, 'before-erase', '9', '1'),
            })
          }
          if (eraseShouldFail) {
            return Promise.resolve({
              outcome: 'failure',
              failure: {
                code: 'ioFailure',
                details: {
                  area: 'archive',
                  phase: 'mutation',
                  retryable: true,
                  durableOutcome: 'known',
                },
              },
            })
          }
          if (request.operation === 'archive.overview') {
            return Promise.resolve({
              outcome: 'success',
              result: runtimeOverviewResult(
                freshStoreId,
                erasedInvalidation.storeInstanceId,
                erasedInvalidation.revision,
                9,
              ),
            })
          }
          return Promise.resolve({
            outcome: 'success',
            result: {
              outcome: 'erased',
              token: erasedInvalidation,
            },
          })
        },
        close: () => Promise.resolve(),
      },
    })
    await client.archive.open()
    const changes: unknown[] = []
    client.operations.observeChanges((change) => changes.push(change))

    expect(
      await client.archive.erase({ confirmation: 'erase-this-archive' }),
    ).toEqual({
      status: 'ok',
      value: { outcome: 'erased', invalidation: erasedInvalidation },
    })
    expect(changes).toEqual([
      { storeId: freshStoreId, invalidation: erasedInvalidation },
    ])
    expect(client.archive.session()).toMatchObject({
      state: 'open',
      transition: 'erased',
      archive: {
        storeId: freshStoreId,
        invalidation: erasedInvalidation,
      },
    })

    eraseShouldFail = true
    expect(
      (await client.archive.erase({ confirmation: 'erase-this-archive' }))
        .status,
    ).toBe('failed')
    expect(changes).toHaveLength(1)
  })

  it('adopts only the fresh erase generation and rejects stale reads and mutations', async () => {
    const oldStoreId = stableId('A1000000-0000-4000-8000-000000000017')
    const freshStoreId = stableId('A1000000-0000-4000-8000-000000000018')
    const identityId = stableId('A1000000-0000-4000-8000-000000000019')
    const subjectId = stableId('A1000000-0000-4000-8000-000000000020')
    const oldInvalidation = {
      storeInstanceId: 'stale-before-erase',
      revision: revision('2'),
    }
    const freshInvalidation = {
      storeInstanceId: 'fresh-after-erase',
      revision: revision('1'),
    }
    const pendingRead = deferred<unknown>()
    const pendingMutation = deferred<unknown>()
    const pendingErase = deferred<unknown>()
    let overviewCalls = 0
    const operations: string[] = []
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: ({ operation }) => {
          operations.push(operation)
          switch (operation) {
            case 'store.open':
              return Promise.resolve({
                outcome: 'success',
                result: runtimeOpenResult(
                  oldStoreId,
                  oldInvalidation.storeInstanceId,
                ),
              })
            case 'archive.identity.save':
              return pendingMutation.promise
            case 'archive.overview':
              overviewCalls += 1
              return overviewCalls === 1
                ? pendingRead.promise
                : Promise.resolve({
                    outcome: 'success',
                    result: runtimeOverviewResult(
                      freshStoreId,
                      freshInvalidation.storeInstanceId,
                      freshInvalidation.revision,
                    ),
                  })
            case 'archive.erase':
              return pendingErase.promise
            default:
              throw new Error(`unexpected operation ${operation}`)
          }
        },
        close: () => Promise.resolve(),
      },
    })
    await client.archive.open()
    const identity = {
      id: identityId,
      title: null,
      subject: {
        id: subjectId,
        displayName: null,
        shortName: null,
        lifeStatus: 'unspecified' as const,
        dateOfBirth: null,
        dateOfDeath: null,
      },
    }
    const staleMutation = client.identity.save(identity)
    const staleRead = client.archive.overview()
    const erase = client.archive.erase({
      confirmation: 'erase-this-archive',
    })
    await vi.waitFor(() =>
      expect(operations).toEqual([
        'store.open',
        'archive.identity.save',
        'archive.overview',
        'archive.erase',
      ]),
    )

    await expect(client.identity.save(identity)).resolves.toMatchObject({
      status: 'failed',
      failure: {
        code: 'staleArchiveGeneration',
        durableOutcome: 'not-started',
      },
    })
    expect(operations).toHaveLength(4)

    pendingRead.resolve({
      outcome: 'success',
      result: runtimeOverviewResult(
        oldStoreId,
        oldInvalidation.storeInstanceId,
        oldInvalidation.revision,
      ),
    })
    await expect(staleRead).resolves.toMatchObject({
      status: 'failed',
      failure: {
        code: 'staleArchiveGeneration',
        durableOutcome: 'known',
      },
    })

    pendingErase.resolve({
      outcome: 'success',
      result: { outcome: 'erased', token: freshInvalidation },
    })
    await expect(erase).resolves.toMatchObject({
      status: 'ok',
      value: { outcome: 'erased', invalidation: freshInvalidation },
    })
    expect(client.archive.session()).toMatchObject({
      state: 'open',
      archive: {
        storeId: freshStoreId,
        invalidation: freshInvalidation,
      },
    })

    pendingMutation.resolve({
      outcome: 'failure',
      failure: {
        code: 'invalidIdentifier',
        details: {
          area: 'archive',
          phase: 'mutation',
          retryable: false,
          durableOutcome: 'known',
          entityKind: 'archive',
          id: oldStoreId,
        },
      },
    })
    const rejectedMutation = await staleMutation
    expect(rejectedMutation).toMatchObject({
      status: 'failed',
      failure: {
        code: 'staleArchiveGeneration',
        durableOutcome: 'known',
      },
    })
    if (rejectedMutation.status === 'failed') {
      expect(rejectedMutation.failure.subject).toBeNull()
    }
  })

  it('marks the prior archive invalid when erase succeeds but fresh identity adoption fails', async () => {
    const oldStoreId = stableId('A1000000-0000-4000-8000-000000000021')
    const freshInvalidation = {
      storeInstanceId: 'unreadable-fresh-archive',
      revision: revision('1'),
    }
    const changes: unknown[] = []
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: ({ operation }) => {
          if (operation === 'store.open') {
            return Promise.resolve({
              outcome: 'success',
              result: runtimeOpenResult(oldStoreId, 'before-unreadable-erase'),
            })
          }
          if (operation === 'archive.erase') {
            return Promise.resolve({
              outcome: 'success',
              result: { outcome: 'erased', token: freshInvalidation },
            })
          }
          return Promise.resolve({
            outcome: 'failure',
            failure: {
              code: 'ioFailure',
              details: {
                area: 'archive',
                phase: 'snapshot',
                retryable: true,
                durableOutcome: 'known',
              },
            },
          })
        },
        close: () => Promise.resolve(),
      },
    })
    await client.archive.open()
    client.operations.observeChanges((change) => changes.push(change))

    await expect(
      client.archive.erase({ confirmation: 'erase-this-archive' }),
    ).resolves.toMatchObject({ status: 'ok' })
    expect(client.archive.session()).toEqual({
      state: 'needs-recovery',
      previousArchiveInvalid: true,
    })
    expect(changes).toEqual([])
  })

  it('publishes all observable mutation invalidations at the shared boundary, but not reads or no-ops', async () => {
    const storeId = stableId('A1000000-0000-4000-8000-000000000026')
    const afterDelete = {
      storeInstanceId: 'shared-invalidation',
      revision: revision('2'),
    }
    const afterIdentity = {
      storeInstanceId: 'shared-invalidation',
      revision: revision('3'),
    }
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: ({ operation }) => {
          switch (operation) {
            case 'store.open':
              return Promise.resolve({
                outcome: 'success',
                result: runtimeOpenResult(
                  storeId,
                  'shared-invalidation',
                  '1',
                  '1',
                ),
              })
            case 'record.deleteEntry':
              return Promise.resolve({
                outcome: 'success',
                result: {
                  outcome: 'softDeleted',
                  deletedEntryId: stableId(
                    'A1000000-0000-4000-8000-000000000027',
                  ),
                  deletedRevision: revision('1'),
                  token: afterDelete,
                },
              })
            case 'archive.identity.save':
              return Promise.resolve({
                outcome: 'success',
                result: {
                  outcome: 'updated',
                  identity: {
                    id: stableId('A1000000-0000-4000-8000-000000000028'),
                    title: null,
                    subject: {
                      id: stableId('A1000000-0000-4000-8000-000000000029'),
                      displayName: null,
                      shortName: null,
                      lifeStatus: 'unspecified',
                      dateOfBirth: null,
                      dateOfDeath: null,
                    },
                  },
                  token: afterIdentity,
                },
              })
            case 'record.saveDraft':
              return Promise.resolve({
                outcome: 'success',
                result: {
                  outcome: 'unchangedAbsent',
                  token: afterIdentity,
                },
              })
            default:
              return Promise.resolve({
                outcome: 'success',
                result: {
                  outcome: 'absent',
                  token: afterIdentity,
                },
              })
          }
        },
        close: () => Promise.resolve(),
      },
    })
    await client.archive.open()
    const changes: unknown[] = []
    client.operations.observeChanges((change) => changes.push(change))

    await client.record.delete({
      window: testWindow,
      entryId: stableId('A1000000-0000-4000-8000-000000000027'),
      expectedRevision: revision('1'),
      nowMs: 1,
    })
    await client.identity.save({
      id: stableId('A1000000-0000-4000-8000-000000000028'),
      title: null,
      subject: {
        id: stableId('A1000000-0000-4000-8000-000000000029'),
        displayName: null,
        shortName: null,
        lifeStatus: 'unspecified',
        dateOfBirth: null,
        dateOfDeath: null,
      },
    })
    await client.record.save({
      window: testWindow,
      markdown: '',
      nowMs: 1,
      target: {
        expectation: 'absent',
        newEntryId: stableId('A1000000-0000-4000-8000-000000000030'),
      },
    })
    await client.record.load(testWindow)

    expect(changes).toEqual([
      { storeId, invalidation: afterDelete },
      { storeId, invalidation: afterIdentity },
    ])
    expect(client.archive.session()).toMatchObject({
      state: 'open',
      archive: { invalidation: afterIdentity },
    })
  })

  it('maps one fixed runtime result without changing exact values or order', async () => {
    const exactRevision = revision('18446744073709551615')
    const exactId = stableId('A1000000-0000-4000-8000-000000000002')
    const resultValue = {
      outcome: 'softDeleted',
      deletedEntryId: exactId,
      deletedRevision: exactRevision,
      token: {
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
      window: testWindow,
      entryId: exactId,
      expectedRevision: exactRevision,
      nowMs: 1,
    })
    expect(result).toEqual({
      status: 'ok',
      value: {
        outcome: 'deleted',
        deletedEntryId: exactId,
        deletedRevision: exactRevision,
        invalidation: {
          storeInstanceId: 'fixed',
          revision: exactRevision,
        },
      },
    })
    expect(result.status === 'ok' && Object.isFrozen(result.value)).toBe(true)
    expect(JSON.stringify(result)).not.toContain('orderedUnknownSemanticIds')
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
    const result = await client.record.load(testWindow)
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
              result: {
                outcome: 'imported',
                attachment: {
                  id: mediaId,
                  entryId: parentId,
                  fileName: 'exact.bin',
                  mediaType: 'other',
                  mimeType: 'application/octet-stream',
                  byteSize: 4,
                  createdAtMs: 1,
                  capturedAtMs: null,
                  durationMs: null,
                  width: null,
                  height: null,
                  caption: null,
                },
                token: {
                  storeInstanceId: 'media-test',
                  revision: '2',
                },
              },
            })
          }
          return Promise.resolve({
            envelope: {
              outcome: 'success',
              result: {
                outcome: 'resolved',
                attachmentId: mediaId,
                byteSize: 4,
                sha256: null,
                contentTransferId: 'media-transfer',
                token: {
                  storeInstanceId: 'media-test',
                  revision: '2',
                },
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

  it('treats a malformed mutation reply without completion evidence as unknown', async () => {
    let opened = false
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: ({ operation }) => {
          if (operation === 'store.open' && !opened) {
            opened = true
            return Promise.resolve({
              outcome: 'success',
              result: runtimeOpenResult(
                stableId('A1000000-0000-4000-8000-000000000096'),
                'before-malformed-erase',
              ),
            })
          }
          return Promise.resolve({ outcome: 'malformed' })
        },
        close: () => Promise.resolve(),
      },
    })

    await client.archive.open()
    await expect(
      client.archive.erase({ confirmation: 'erase-this-archive' }),
    ).resolves.toMatchObject({
      status: 'failed',
      failure: {
        code: 'invalidRuntimeResponse',
        durableOutcome: 'unknown',
      },
    })
  })

  it('surfaces idle worker loss without waiting for another client request', async () => {
    const { client, worker } = await openClientWithWorker(
      'idle-loss-generation',
    )

    worker.crash()

    expect(client.runtime.status()).toEqual({
      state: 'unavailable',
      reason: 'worker-lost',
    })
    expect(client.archive.session()).toEqual({
      state: 'lost',
      durableOutcome: 'unknown',
    })
  })

  it('preserves active unknown outcome when queued work never started', async () => {
    const { client, worker } = await openClientWithWorker(
      'active-loss-generation',
    )
    const active = client.archive.erase({
      confirmation: 'erase-this-archive',
    })
    const queued = client.archive.overview()
    await vi.waitFor(() => expect(worker.requests()).toHaveLength(2))

    worker.crash()
    await expect(active).resolves.toMatchObject({
      status: 'failed',
      failure: { durableOutcome: 'unknown' },
    })
    await expect(queued).resolves.toMatchObject({
      status: 'failed',
      failure: { durableOutcome: 'not-started' },
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

  it('maps a realistic runtime revision conflict into typed current writing', async () => {
    const entryId = stableId('A1000000-0000-4000-8000-000000000081')
    const currentState = {
      entry: {
        id: entryId,
        entryType: 'day',
        startMs: testWindow.startMs,
        endMs: testWindow.endMs,
        calendarIdentifier: testWindow.calendarId,
        timeZoneIdentifier: testWindow.timeZoneId,
        bodyMarkdown: 'current runtime writing',
        plainTextCache: 'current runtime writing',
        createdAtMs: 1,
        updatedAtMs: 2,
        deletedAtMs: null,
        source: 'manual',
        isPinned: false,
        privacyLevel: 'normal',
      },
      mutationRevision: '2',
    }
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: () =>
          Promise.resolve({
            outcome: 'failure',
            failure: {
              category: 'conflict',
              code: 'revisionConflict',
              details: {
                area: 'record',
                phase: 'mutation',
                retryable: false,
                field: 'expectedRevision',
                entityKind: 'entry',
                id: entryId,
                expectedRevision: '1',
                actualRevision: '2',
              },
              currentState,
            },
          }),
        close: () => Promise.resolve(),
      },
    })

    await expect(
      client.record.save({
        window: testWindow,
        markdown: 'unsaved browser buffer',
        nowMs: 3,
        target: {
          expectation: 'existing',
          entryId,
          expectedRevision: revision('1'),
        },
      }),
    ).resolves.toEqual({
      status: 'ok',
      value: {
        outcome: 'conflict',
        conflict: {
          expectedRevision: revision('1'),
          actualRevision: revision('2'),
          current: {
            presence: 'present',
            window: testWindow,
            entry: {
              id: entryId,
              revision: revision('2'),
              window: testWindow,
              markdown: 'current runtime writing',
              plainText: 'current runtime writing',
              createdAtMs: 1,
              updatedAtMs: 2,
              isPinned: false,
              privacy: 'normal',
              source: 'manual',
            },
          },
        },
      },
    })
  })

  it('keeps an unavailable revision failure generic when no conflict state exists', async () => {
    const entryId = stableId('A1000000-0000-4000-8000-000000000086')
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: () =>
          Promise.resolve({
            outcome: 'failure',
            failure: {
              category: 'unavailable',
              code: 'revisionConflict',
              details: {
                area: 'record',
                phase: 'mutation',
                retryable: true,
                entityKind: 'entry',
                id: entryId,
                expectedRevision: '1',
              },
            },
          }),
        close: () => Promise.resolve(),
      },
    })

    await expect(
      client.record.save({
        window: testWindow,
        markdown: 'unsaved browser buffer',
        nowMs: 3,
        target: {
          expectation: 'existing',
          entryId,
          expectedRevision: revision('1'),
        },
      }),
    ).resolves.toMatchObject({
      status: 'failed',
      failure: {
        code: 'revisionConflict',
        expectedRevision: revision('1'),
        actualRevision: null,
      },
    })
  })

  it('keeps generic diagnostics structural and drops raw current state', async () => {
    const entryId = stableId('A1000000-0000-4000-8000-000000000082')
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: () =>
          Promise.resolve({
            outcome: 'failure',
            failure: {
              category: 'io',
              code: 'ioFailure',
              details: {
                area: 'record',
                phase: 'snapshot',
                retryable: true,
                field: 'entryId',
                entityKind: 'entry',
                id: entryId,
                expectedRevision: '8',
                actualRevision: '9',
                cleanupState: 'ownedStagingMayRemain',
                privatePath: '/private/archive.sqlite3',
              },
              currentState: {
                bodyMarkdown: 'private writing must not become diagnostics',
              },
            },
          }),
        close: () => Promise.resolve(),
      },
    })

    const result = await client.record.load(testWindow)
    expect(result).toMatchObject({
      status: 'failed',
      failure: {
        area: 'record',
        code: 'ioFailure',
        field: 'entryId',
        subject: { kind: 'entry', id: entryId },
        expectedRevision: revision('8'),
        actualRevision: revision('9'),
        cleanup: 'temporary-output-may-remain',
      },
    })
    expect(JSON.stringify(result)).not.toContain('private writing')
    expect(JSON.stringify(result)).not.toContain('/private/')
  })

  it('fails explicitly when a runtime-shaped result is missing a required field', async () => {
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: () =>
          Promise.resolve({
            outcome: 'success',
            result: {
              outcome: 'loaded',
              current: {
                entry: {
                  id: stableId('A1000000-0000-4000-8000-000000000083'),
                },
              },
              token: { storeInstanceId: 'missing-field', revision: '1' },
            },
          }),
        close: () => Promise.resolve(),
      },
    })

    await expect(client.record.load(testWindow)).resolves.toMatchObject({
      status: 'failed',
      failure: { code: 'invalidRuntimeResponse', durableOutcome: 'known' },
    })
  })

  it('forwards contract-required opaque and civil evidence without inference', async () => {
    const calls: Array<{ operation: string; request: unknown }> = []
    const client = new RuntimeLifeArchiveClient({
      runtime,
      transport: {
        request: ({ operation, payload }) => {
          const prepared = payload as { readonly request: unknown }
          calls.push({ operation, request: prepared.request })
          return Promise.resolve({
            outcome: 'failure',
            failure: {
              category: 'validation',
              code: 'invalidRequest',
              details: {
                area: 'request',
                phase: 'mutation',
                retryable: false,
              },
            },
          })
        },
        close: () => Promise.resolve(),
      },
    })
    const memberId = stableId('A1000000-0000-4000-8000-000000000084')
    const token = { storeInstanceId: 'opaque-token', revision: revision('4') }

    await client.structured.convertSpanToEvent({
      spanId: memberId,
      expectedRevision: revision('3'),
      requestedStartDate: civilDate('2026-07-01'),
      requestedEndDate: civilDate('2026-07-02'),
      nowMs: 5,
    })
    await client.tracks.detachMember({
      memberId,
      memberKind: 'span',
      expectedMemberRevision: revision('3'),
      expectedInvalidation: token,
      nowMs: 5,
    })
    await client.timeline.focus({
      window: testWindow,
      weekRules: { firstWeekday: 2, minimumDaysInFirstWeek: 3 },
      entry: null,
      expectedInvalidation: token,
    })

    expect(calls).toEqual([
      {
        operation: 'structured.convertSpanToEvent',
        request: {
          contractVersion: 2,
          id: memberId,
          expectedRevision: revision('3'),
          requestedStartDate: civilDate('2026-07-01'),
          requestedEndDate: civilDate('2026-07-02'),
          nowMs: 5,
        },
      },
      {
        operation: 'track.detachMember',
        request: {
          memberId,
          memberKind: 'span',
          expectedMemberRevision: revision('3'),
          expectedToken: token,
          nowMs: 5,
        },
      },
      {
        operation: 'timeline.focusedDetail',
        request: {
          contractVersion: 1,
          span: {
            id: testWindow.id,
            scale: testWindow.scale,
            startMs: testWindow.startMs,
            endMs: testWindow.endMs,
            calendarIdentifier: testWindow.calendarId,
            timeZoneIdentifier: testWindow.timeZoneId,
          },
          firstWeekday: 2,
          minimumDaysInFirstWeek: 3,
          expectedEntry: null,
          expectedToken: token,
        },
      },
    ])
  })
})
