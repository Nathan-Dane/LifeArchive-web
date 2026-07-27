import { describe, expect, it, vi } from 'vitest'
import {
  ok,
  type LifeArchiveClient,
  type StorageFacts,
} from '../../../core/client'
import type { StoragePersistence } from '../../../platform/storage'
import { readArchiveStorageFacts } from './storageFactsAdapter'

const RUNTIME_FACTS: StorageFacts = {
  backend: 'runtime-owned',
  durability: 'best-effort',
  archiveOpen: true,
  grant: 'denied',
  estimate: {
    usedBytes: 1,
    quotaBytes: 2,
    approximate: true,
  },
}

describe('archive storage facts adapter', () => {
  it('keeps runtime facts separate from browser permission and estimates', async () => {
    const runtimeStorage = vi.fn(() => Promise.resolve(ok(RUNTIME_FACTS)))
    const current = vi.fn(() => Promise.resolve('granted' as const))
    const estimate = vi.fn(() =>
      Promise.resolve({
        usedBytes: 4000,
        quotaBytes: 9000,
        approximate: true as const,
      }),
    )
    const client = {
      runtime: { storage: runtimeStorage },
    } as unknown as LifeArchiveClient
    const persistence = {
      current,
      request: vi.fn(),
      estimate,
    } satisfies StoragePersistence

    await expect(readArchiveStorageFacts(client, persistence)).resolves.toEqual(
      {
        runtime: RUNTIME_FACTS,
        grant: 'granted',
        estimate: {
          usedBytes: 4000,
          quotaBytes: 9000,
          approximate: true,
        },
      },
    )
    expect(runtimeStorage).toHaveBeenCalledOnce()
    expect(current).toHaveBeenCalledOnce()
    expect(estimate).toHaveBeenCalledOnce()
  })

  it('keeps browser facts available when runtime storage facts fail', async () => {
    const client = {
      runtime: {
        storage: () => Promise.reject(new Error('worker unavailable')),
      },
    } as unknown as LifeArchiveClient
    const persistence = {
      current: () => Promise.resolve('unknown' as const),
      request: vi.fn(),
      estimate: () => Promise.resolve(null),
    } satisfies StoragePersistence

    await expect(readArchiveStorageFacts(client, persistence)).resolves.toEqual(
      {
        runtime: null,
        grant: 'unknown',
        estimate: null,
      },
    )
  })
})
