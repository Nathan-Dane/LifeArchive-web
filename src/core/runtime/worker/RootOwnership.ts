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
  private acquisition: Promise<boolean> | null = null
  private heldRequest: Promise<void> | null = null
  private releaseHeld: (() => void) | null = null
  private releaseRequest: Promise<void> | null = null
  private ownsRoot = false

  constructor(locks: LockManager = navigator.locks) {
    this.locks = locks
  }

  async acquire(): Promise<boolean> {
    if (this.releaseRequest) await this.releaseRequest
    if (this.ownsRoot) return true
    if (this.acquisition) return this.acquisition

    const acquisition = this.requestOwnership()
    this.acquisition = acquisition
    try {
      return await acquisition
    } finally {
      if (this.acquisition === acquisition) this.acquisition = null
    }
  }

  private async requestOwnership(): Promise<boolean> {
    let report: (acquired: boolean) => void = () => undefined
    let reportFailure: (error: unknown) => void = () => undefined
    const acquired = new Promise<boolean>((resolve, reject) => {
      report = resolve
      reportFailure = reject
    })
    const held = new Promise<void>((resolve) => {
      this.releaseHeld = resolve
    })

    const heldRequest = Promise.resolve()
      .then(() =>
        this.locks.request(
          BROWSER_ARCHIVE_LOCK,
          { mode: 'exclusive', ifAvailable: true },
          async (lock) => {
            if (!lock) {
              report(false)
              return
            }
            this.ownsRoot = true
            report(true)
            try {
              await held
            } finally {
              this.ownsRoot = false
            }
          },
        ),
      )
      .catch((error: unknown) => {
        reportFailure(error)
        throw error
      })
    this.heldRequest = heldRequest

    try {
      if (!(await acquired)) {
        await heldRequest
        return false
      }
      return true
    } catch (error) {
      await heldRequest.catch(() => undefined)
      throw error
    } finally {
      if (!this.ownsRoot && this.heldRequest === heldRequest) {
        this.heldRequest = null
        this.releaseHeld = null
      }
    }
  }

  async release(): Promise<void> {
    if (this.releaseRequest) return this.releaseRequest

    const releaseRequest = this.finishRelease()
    this.releaseRequest = releaseRequest
    try {
      await releaseRequest
    } finally {
      if (this.releaseRequest === releaseRequest) this.releaseRequest = null
    }
  }

  private async finishRelease(): Promise<void> {
    try {
      await this.acquisition
    } catch {
      // A failed acquisition owns nothing, so release has no failure to add.
    }

    const heldRequest = this.heldRequest
    if (!heldRequest) return
    this.releaseHeld?.()
    try {
      await heldRequest
    } finally {
      if (this.heldRequest === heldRequest) {
        this.heldRequest = null
        this.releaseHeld = null
      }
    }
  }
}
