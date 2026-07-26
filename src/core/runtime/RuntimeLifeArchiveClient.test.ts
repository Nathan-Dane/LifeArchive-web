import { describe, expect, it } from 'vitest'
import { revision, stableId } from '../client'
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
})
