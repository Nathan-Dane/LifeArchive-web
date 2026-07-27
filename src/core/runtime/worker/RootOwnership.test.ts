import { describe, expect, it } from 'vitest'
import { BROWSER_ARCHIVE_LOCK, RootOwnership } from './RootOwnership'

class FixedLocks {
  readonly requests: {
    readonly name: string
    readonly options: { readonly mode: 'exclusive'; readonly ifAvailable: true }
  }[] = []

  private readonly available: boolean

  constructor(available: boolean) {
    this.available = available
  }

  async request<T>(
    name: string,
    options: { readonly mode: 'exclusive'; readonly ifAvailable: true },
    callback: (lock: { readonly name: string } | null) => Promise<T>,
  ): Promise<T> {
    this.requests.push({ name, options })
    return callback(this.available ? { name } : null)
  }
}

describe('RootOwnership', () => {
  it('acquires immediately and holds the canonical exclusive lock until release', async () => {
    const locks = new FixedLocks(true)
    const ownership = new RootOwnership(locks)

    await expect(ownership.acquire()).resolves.toBe(true)
    expect(locks.requests).toEqual([
      {
        name: BROWSER_ARCHIVE_LOCK,
        options: { mode: 'exclusive', ifAvailable: true },
      },
    ])

    await ownership.release()
  })

  it('reports an unavailable second-tab lock without waiting or taking ownership', async () => {
    const locks = new FixedLocks(false)
    const ownership = new RootOwnership(locks)

    await expect(ownership.acquire()).resolves.toBe(false)
    await ownership.release()
  })
})
