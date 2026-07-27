import { describe, expect, it, vi } from 'vitest'
import {
  createStoragePersistence,
  type StorageManagerLike,
} from './persistence'

function manager(parts: StorageManagerLike): StorageManagerLike {
  return parts
}

describe('the current grant', () => {
  it('reports unsupported when the browser cannot be asked', async () => {
    const persistence = createStoragePersistence(manager({}))
    expect(await persistence.current()).toBe('unsupported')
  })

  it('separates a granted origin from one nobody has granted yet', async () => {
    const granted = createStoragePersistence(
      manager({ persisted: () => Promise.resolve(true) }),
    )
    const notYet = createStoragePersistence(
      manager({ persisted: () => Promise.resolve(false) }),
    )

    expect(await granted.current()).toBe('granted')
    /* Not granted is not a refusal: nobody has asked. */
    expect(await notYet.current()).toBe('unknown')
  })

  it('reports unknown when the query itself fails', async () => {
    const persistence = createStoragePersistence(
      manager({ persisted: () => Promise.reject(new Error('blocked')) }),
    )
    expect(await persistence.current()).toBe('unknown')
  })
})

describe('requesting persistence', () => {
  it('reports unsupported without inventing a refusal', async () => {
    const persistence = createStoragePersistence(manager({}))
    expect(await persistence.request()).toBe('unsupported')
  })

  it('reports the browser s answer', async () => {
    const agreed = vi.fn(() => Promise.resolve(true))
    const refused = vi.fn(() => Promise.resolve(false))

    expect(
      await createStoragePersistence(manager({ persist: agreed })).request(),
    ).toBe('granted')
    expect(
      await createStoragePersistence(manager({ persist: refused })).request(),
    ).toBe('denied')
    expect(agreed).toHaveBeenCalledTimes(1)
    expect(refused).toHaveBeenCalledTimes(1)
  })

  it('reports unknown when the request throws', async () => {
    const persistence = createStoragePersistence(
      manager({ persist: () => Promise.reject(new Error('denied by policy')) }),
    )
    expect(await persistence.request()).toBe('unknown')
  })
})

describe('the space estimate', () => {
  it('is null when the browser offers none', async () => {
    expect(await createStoragePersistence(manager({})).estimate()).toBeNull()
  })

  it('is null rather than zero when a figure is missing or unusable', async () => {
    const partial = createStoragePersistence(
      manager({ estimate: () => Promise.resolve({ usage: 12 }) }),
    )
    const nonsense = createStoragePersistence(
      manager({
        estimate: () => Promise.resolve({ usage: Number.NaN, quota: 10 }),
      }),
    )
    const failing = createStoragePersistence(
      manager({ estimate: () => Promise.reject(new Error('unavailable')) }),
    )

    expect(await partial.estimate()).toBeNull()
    expect(await nonsense.estimate()).toBeNull()
    expect(await failing.estimate()).toBeNull()
  })

  it('passes the browser s figures through, marked approximate', async () => {
    const persistence = createStoragePersistence(
      manager({
        estimate: () => Promise.resolve({ usage: 2048, quota: 5_000_000 }),
      }),
    )
    expect(await persistence.estimate()).toEqual({
      usedBytes: 2048,
      quotaBytes: 5_000_000,
      approximate: true,
    })
  })
})
