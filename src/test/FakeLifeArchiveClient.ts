import {
  clientFailure,
  failed,
  type ArchiveSession,
  type ClientResult,
  type LifeArchiveClient,
  type RuntimeStatus,
  type Unsubscribe,
} from '../core/client'

const unsupported = <Value>(): Promise<ClientResult<Value>> =>
  Promise.resolve(
    failed(
      clientFailure({
        area: 'request',
        code: 'testUnsupported',
        phase: 'transport',
        retryable: false,
      }),
    ),
  )

export class FakeLifeArchiveClient {
  private runtimeState: RuntimeStatus
  private sessionState: ArchiveSession
  private readonly runtimeListeners = new Set<(value: RuntimeStatus) => void>()
  private readonly sessionListeners = new Set<(value: ArchiveSession) => void>()
  private runtimeSubscriptionCount = 0
  private sessionSubscriptionCount = 0

  constructor(
    session: ArchiveSession,
    runtime: RuntimeStatus = {
      state: 'available',
      runtime: {
        mode: 'development-mock',
        runtimeVersion: 'test',
        buildId: 'test',
        productContract: 'test',
        browserAbi: 'test',
        backend: 'test',
        durability: 'unproven',
      },
    },
  ) {
    this.sessionState = session
    this.runtimeState = runtime
  }

  readonly client = {
    runtime: {
      status: () => this.runtimeState,
      observeStatus: (listener: (value: RuntimeStatus) => void) => {
        this.runtimeSubscriptionCount += 1
        return subscribe(this.runtimeListeners, listener)
      },
      storage: unsupported,
    },
    archive: {
      session: () => this.sessionState,
      observeSession: (listener: (value: ArchiveSession) => void) => {
        this.sessionSubscriptionCount += 1
        return subscribe(this.sessionListeners, listener)
      },
      create: unsupported,
      open: unsupported,
      close: unsupported,
      overview: unsupported,
      verify: unsupported,
      import: unsupported,
      export: unsupported,
      erase: unsupported,
    },
  } as unknown as LifeArchiveClient

  emitRuntime(status: RuntimeStatus): void {
    this.runtimeState = status
    for (const listener of [...this.runtimeListeners]) listener(status)
  }

  emitSession(session: ArchiveSession): void {
    this.sessionState = session
    for (const listener of [...this.sessionListeners]) listener(session)
  }

  subscriptionCounts(): { readonly runtime: number; readonly session: number } {
    return {
      runtime: this.runtimeSubscriptionCount,
      session: this.sessionSubscriptionCount,
    }
  }
}

function subscribe<Value>(
  listeners: Set<(value: Value) => void>,
  listener: (value: Value) => void,
): Unsubscribe {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
