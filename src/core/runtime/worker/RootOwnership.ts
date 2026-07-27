export const BROWSER_ARCHIVE_LOCK =
  'lifearchive:archive-lock:v1:primary' as const

interface Lock {
  readonly name: string
}

interface LockManager {
  request<T>(
    name: string,
    options: { readonly mode: 'exclusive'; readonly ifAvailable: true },
    callback: (lock: Lock | null) => Promise<T>,
  ): Promise<T>
}

/**
 * Holds the canonical origin lock for exactly the lifetime of an open runtime.
 * `ifAvailable` keeps the second-tab outcome immediate: this class never
 * queues behind another owner and never steals its root.
 */
export class RootOwnership {
  private readonly locks: LockManager
  private heldRequest: Promise<void> | null = null
  private releaseHeld: (() => void) | null = null

  constructor(locks: LockManager = navigator.locks) {
    this.locks = locks
  }

  async acquire(): Promise<boolean> {
    if (this.heldRequest) return true

    let report: (acquired: boolean) => void = () => undefined
    let reportFailure: (error: unknown) => void = () => undefined
    const acquired = new Promise<boolean>((resolve, reject) => {
      report = resolve
      reportFailure = reject
    })
    const held = new Promise<void>((resolve) => {
      this.releaseHeld = resolve
    })

    this.heldRequest = this.locks
      .request(
        BROWSER_ARCHIVE_LOCK,
        { mode: 'exclusive', ifAvailable: true },
        async (lock) => {
          report(lock !== null)
          if (lock) await held
        },
      )
      .catch((error: unknown) => {
        reportFailure(error)
        throw error
      })

    if (!(await acquired)) {
      await this.heldRequest
      this.heldRequest = null
      this.releaseHeld = null
      return false
    }
    return true
  }

  async release(): Promise<void> {
    const heldRequest = this.heldRequest
    if (!heldRequest) return
    this.releaseHeld?.()
    try {
      await heldRequest
    } finally {
      this.heldRequest = null
      this.releaseHeld = null
    }
  }
}
