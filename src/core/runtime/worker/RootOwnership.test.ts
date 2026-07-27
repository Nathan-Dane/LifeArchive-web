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
  private rejectNext = false

  rejectNextRequest(): void {
    this.rejectNext = true
  }

  async request<T>(
    _name: string,
    _options: { readonly mode: 'exclusive'; readonly ifAvailable: true },
    callback: (lock: { readonly name: string } | null) => Promise<T>,
  ): Promise<T> {
    if (this.rejectNext) {
      this.rejectNext = false
      throw new Error('lock-request-failed')
    }
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

class DelayedLocks {
  requests = 0
  private readonly available: Promise<boolean>

  constructor(available: Promise<boolean>) {
    this.available = available
  }

  async request<T>(
    name: string,
    _options: { readonly mode: 'exclusive'; readonly ifAvailable: true },
    callback: (lock: { readonly name: string } | null) => Promise<T>,
  ): Promise<T> {
    this.requests += 1
    return callback((await this.available) ? { name } : null)
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

  it('shares an in-flight unavailable result instead of claiming ownership early', async () => {
    let reportAvailability: (available: boolean) => void = () => undefined
    const available = new Promise<boolean>((resolve) => {
      reportAvailability = resolve
    })
    const locks = new DelayedLocks(available)
    const ownership = new RootOwnership(locks)

    const first = ownership.acquire()
    const simultaneous = ownership.acquire()
    await Promise.resolve()
    expect(locks.requests).toBe(1)

    reportAvailability(false)
    await expect(Promise.all([first, simultaneous])).resolves.toEqual([
      false,
      false,
    ])
  })

  it('retries a rejected request without claiming a root held by another tab', async () => {
    const locks = new ContendedLocks()
    const retryingTab = new RootOwnership(locks)
    const otherTab = new RootOwnership(locks)
    locks.rejectNextRequest()

    await expect(retryingTab.acquire()).rejects.toThrow('lock-request-failed')
    await expect(otherTab.acquire()).resolves.toBe(true)
    await expect(retryingTab.acquire()).resolves.toBe(false)

    await otherTab.release()
    await expect(retryingTab.acquire()).resolves.toBe(true)
    await retryingTab.release()
  })
})
