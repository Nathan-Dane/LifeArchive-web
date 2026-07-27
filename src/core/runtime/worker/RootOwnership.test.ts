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

class ContendedLocks {
  private owner: symbol | null = null

  async request<T>(
    _name: string,
    _options: { readonly mode: 'exclusive'; readonly ifAvailable: true },
    callback: (lock: { readonly name: string } | null) => Promise<T>,
  ): Promise<T> {
    if (this.owner) return callback(null)
    const owner = Symbol('lock-owner')
    this.owner = owner
    try {
      return await callback({ name: BROWSER_ARCHIVE_LOCK })
    } finally {
      if (this.owner === owner) this.owner = null
    }
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

  it('lets a second tab acquire only after the first tab releases cleanly', async () => {
    const locks = new ContendedLocks()
    const firstTab = new RootOwnership(locks)
    const secondTab = new RootOwnership(locks)

    await expect(firstTab.acquire()).resolves.toBe(true)
    await expect(secondTab.acquire()).resolves.toBe(false)
    await firstTab.release()
    await expect(secondTab.acquire()).resolves.toBe(true)
    await secondTab.release()
  })
})
