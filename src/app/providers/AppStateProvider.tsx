/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'
import {
  bootstrapAppClient,
  type AppBootstrap,
  type AppBootstrapResult,
} from '../../core/bootstrap'
import type {
  ArchiveSession,
  ClientFailure,
  LifeArchiveClient,
  OpenArchive,
  RuntimeIncompatibleReason,
  RuntimeUnavailableReason,
  Unsubscribe,
} from '../../core/client'

export type AppState =
  | { readonly state: 'booting' }
  | {
      readonly state: 'runtime-unavailable'
      readonly reason:
        RuntimeUnavailableReason | 'missing' | 'worker-instantiate-failed'
    }
  | {
      readonly state: 'no-archive'
      readonly client: LifeArchiveClient
      readonly developmentMock: boolean
    }
  | {
      readonly state: 'opening'
      readonly client: LifeArchiveClient
      readonly developmentMock: boolean
    }
  | {
      readonly state: 'open'
      readonly client: LifeArchiveClient
      readonly archive: OpenArchive
      readonly developmentMock: boolean
    }
  | {
      readonly state: 'locked'
      readonly client: LifeArchiveClient
      readonly developmentMock: boolean
    }
  | {
      readonly state: 'recoverable-failure'
      readonly client: LifeArchiveClient
      readonly developmentMock: boolean
      readonly previousOpen: OpenArchive | null
      readonly failure: ClientFailure | null
    }
  | {
      readonly state: 'fatal-incompatibility'
      readonly reason: RuntimeIncompatibleReason | 'archive-incompatible'
    }

interface AppStateValue {
  readonly state: AppState
  readonly retry: () => void
}

const AppStateContext = createContext<AppStateValue | null>(null)

class AppStateController {
  private state: AppState = { state: 'booting' }
  private readonly listeners = new Set<() => void>()
  private readonly bootstrap: AppBootstrap
  private subscriptions: Unsubscribe[] = []
  private started = false
  private bootstrapPromise: Promise<void> | null = null
  private openPromise: Promise<void> | null = null
  private client: LifeArchiveClient | null = null
  private developmentMock = false
  private lastOpen: OpenArchive | null = null

  constructor(bootstrap: AppBootstrap) {
    this.bootstrap = bootstrap
  }

  snapshot = (): AppState => this.state

  subscribe = (listener: () => void): Unsubscribe => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): void {
    this.started = true
    if (!this.bootstrapPromise && !this.client) {
      this.runBootstrap()
    } else if (this.client && this.subscriptions.length === 0) {
      this.observeClient(this.client)
    }
  }

  stop(): void {
    this.started = false
    this.clearSubscriptions()
  }

  retry = (): void => {
    if (
      this.state.state === 'runtime-unavailable' ||
      this.state.state === 'fatal-incompatibility'
    ) {
      this.client = null
      this.lastOpen = null
      this.clearSubscriptions()
      this.setState({ state: 'booting' })
      this.runBootstrap()
      return
    }
    if (
      this.client &&
      (this.state.state === 'locked' ||
        this.state.state === 'recoverable-failure')
    ) {
      this.openExisting(this.client)
    }
  }

  private runBootstrap(): void {
    if (this.bootstrapPromise) return
    this.bootstrapPromise = this.bootstrap()
      .then((result) => {
        if (result.state === 'client') {
          this.attachClient(result.client, result.developmentMock)
          return
        }
        this.applyRuntimeLoadState(result.runtime)
      })
      .catch(() => {
        this.setState({
          state: 'runtime-unavailable',
          reason: 'load-failed',
        })
      })
      .finally(() => {
        this.bootstrapPromise = null
      })
  }

  private applyRuntimeLoadState(
    runtime: Extract<AppBootstrapResult, { state: 'runtime' }>['runtime'],
  ): void {
    switch (runtime.state) {
      case 'checking':
        this.setState({ state: 'booting' })
        return
      case 'unavailable':
        this.setState({
          state: 'runtime-unavailable',
          reason: runtime.reason,
        })
        return
      case 'incompatible':
        this.setState({
          state: 'fatal-incompatibility',
          reason: runtime.reason,
        })
        return
      case 'open':
        this.attachClient(runtime.client, false)
    }
  }

  private attachClient(
    client: LifeArchiveClient,
    developmentMock: boolean,
  ): void {
    this.client = client
    this.developmentMock = developmentMock
    if (this.started) this.observeClient(client)
    this.applyRuntimeStatus(client.runtime.status())
    const session = client.archive.session()
    if (!developmentMock && session.state === 'no-archive') {
      this.openExisting(client)
      return
    }
    this.applySession(session)
  }

  private observeClient(client: LifeArchiveClient): void {
    this.clearSubscriptions()
    this.subscriptions = [
      client.runtime.observeStatus((status) => this.applyRuntimeStatus(status)),
      client.archive.observeSession((session) => this.applySession(session)),
    ]
  }

  private applyRuntimeStatus(
    status: ReturnType<LifeArchiveClient['runtime']['status']>,
  ): void {
    if (status.state === 'available') return
    if (status.state === 'checking') {
      if (this.lastOpen && this.client) {
        this.setRecoverable(null)
      } else {
        this.setState({ state: 'booting' })
      }
      return
    }
    if (status.state === 'incompatible') {
      this.setState({ state: 'fatal-incompatibility', reason: status.reason })
      return
    }
    if (this.lastOpen && this.client) {
      this.setRecoverable(null)
    } else {
      this.setState({
        state: 'runtime-unavailable',
        reason: status.reason,
      })
    }
  }

  private applySession(session: ArchiveSession): void {
    if (!this.client) return
    const common = {
      client: this.client,
      developmentMock: this.developmentMock,
    }
    switch (session.state) {
      case 'no-archive':
      case 'closed':
        this.lastOpen = null
        this.setState({ state: 'no-archive', ...common })
        return
      case 'opening':
      case 'closing':
        this.setState({ state: 'opening', ...common })
        return
      case 'open':
        this.lastOpen = session.archive
        this.setState({ state: 'open', archive: session.archive, ...common })
        return
      case 'open-in-another-tab':
        this.setState({ state: 'locked', ...common })
        return
      case 'needs-recovery':
      case 'lost':
        this.setRecoverable(null)
        return
      case 'incompatible':
        this.setState({
          state: 'fatal-incompatibility',
          reason: 'archive-incompatible',
        })
    }
  }

  private openExisting(client: LifeArchiveClient): void {
    if (this.openPromise) return
    this.setState({
      state: 'opening',
      client,
      developmentMock: this.developmentMock,
    })
    this.openPromise = client.archive
      .open()
      .then((result) => {
        if (result.status === 'failed') {
          if (client.archive.session().state === 'open-in-another-tab') return
          if (
            result.failure.code === 'archiveNotFound' &&
            client.archive.session().state === 'no-archive'
          ) {
            this.applySession(client.archive.session())
            return
          }
          this.setRecoverable(result.failure)
        }
      })
      .catch(() => this.setRecoverable(null))
      .finally(() => {
        this.openPromise = null
      })
  }

  private setRecoverable(failure: ClientFailure | null): void {
    if (!this.client) return
    this.setState({
      state: 'recoverable-failure',
      client: this.client,
      developmentMock: this.developmentMock,
      previousOpen: this.lastOpen,
      failure,
    })
  }

  private clearSubscriptions(): void {
    for (const unsubscribe of this.subscriptions) unsubscribe()
    this.subscriptions = []
  }

  private setState(state: AppState): void {
    this.state = state
    if (!this.started) return
    for (const listener of [...this.listeners]) listener()
  }
}

export interface AppStateProviderProps {
  readonly children: ReactNode
  readonly bootstrap?: AppBootstrap
}

export function AppStateProvider({
  children,
  bootstrap = bootstrapAppClient,
}: AppStateProviderProps) {
  const [controller] = useState(() => new AppStateController(bootstrap))
  const [, render] = useState(0)

  useEffect(() => {
    const unsubscribe = controller.subscribe(() => render((value) => value + 1))
    controller.start()
    return () => {
      unsubscribe()
      controller.stop()
    }
  }, [controller])

  return (
    <AppStateContext.Provider
      value={{ state: controller.snapshot(), retry: controller.retry }}
    >
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext)
  if (!value) throw new Error('useAppState requires AppStateProvider')
  return value
}
