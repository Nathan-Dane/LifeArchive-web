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
      readonly purpose: 'open' | 'recovery'
      readonly previousOpen: OpenArchive | null
    }
  | {
      readonly state: 'open'
      readonly client: LifeArchiveClient
      readonly archive: OpenArchive
      readonly developmentMock: boolean
      readonly transition?: 'erased'
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
      readonly state: 'closing' | 'closed'
      readonly client: LifeArchiveClient
      readonly developmentMock: boolean
    }
  | {
      readonly state: 'fatal-incompatibility'
      readonly reason: RuntimeIncompatibleReason | 'archive-incompatible'
    }

interface AppStateValue {
  readonly state: AppState
  readonly retry: () => void
  readonly dismissArchiveTransition: () => void
  readonly createFirstArchive: (
    client: LifeArchiveClient,
  ) => ReturnType<LifeArchiveClient['archive']['create']>
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
  private clientEpoch = 0
  private developmentMock = false
  private lastOpen: OpenArchive | null = null
  private openPurpose: 'open' | 'recovery' = 'open'
  private replacementRequired = false
  private firstRunCreateActive = false

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
      this.state.state === 'fatal-incompatibility' ||
      this.state.state === 'closed' ||
      (this.state.state === 'recoverable-failure' && this.replacementRequired)
    ) {
      this.replaceClient()
      return
    }
    if (
      this.client &&
      (this.state.state === 'locked' ||
        this.state.state === 'recoverable-failure')
    ) {
      this.openExisting(this.client, this.state.state === 'recoverable-failure')
    }
  }

  dismissArchiveTransition = (): void => {
    if (this.state.state !== 'open' || !this.state.transition) return
    this.setState({
      state: 'open',
      client: this.state.client,
      archive: this.state.archive,
      developmentMock: this.state.developmentMock,
    })
  }

  createFirstArchive = (
    client: LifeArchiveClient,
  ): ReturnType<LifeArchiveClient['archive']['create']> => {
    /*
     * Runtime clients publish `opening` synchronously from create(). Register
     * the operation before that notification so the first-run controller stays
     * mounted and its retry remains a create, not the shell's open-existing
     * recovery action.
     */
    if (client === this.client) this.firstRunCreateActive = true
    return client.archive.create()
  }

  private runBootstrap(): void {
    if (this.bootstrapPromise) return
    let bootstrap: Promise<AppBootstrapResult>
    try {
      bootstrap = this.bootstrap()
    } catch (error) {
      bootstrap = Promise.reject(error)
    }
    const completion = bootstrap.then(
      (result) => {
        if (this.bootstrapPromise !== completion) return
        this.bootstrapPromise = null
        this.applyBootstrapResult(result)
      },
      () => {
        if (this.bootstrapPromise !== completion) return
        this.bootstrapPromise = null
        this.setState({
          state: 'runtime-unavailable',
          reason: 'load-failed',
        })
      },
    )
    this.bootstrapPromise = completion
  }

  private replaceClient(): void {
    this.client = null
    this.clientEpoch += 1
    this.openPromise = null
    this.openPurpose = 'open'
    this.lastOpen = null
    this.replacementRequired = false
    this.firstRunCreateActive = false
    this.bootstrapPromise = null
    this.clearSubscriptions()
    this.setState({ state: 'booting' })
    this.runBootstrap()
  }

  private applyBootstrapResult(result: AppBootstrapResult): void {
    if (result.state === 'client') {
      this.attachClient(result.client, result.developmentMock)
      return
    }
    this.applyRuntimeLoadState(result.runtime)
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
    this.clientEpoch += 1
    this.developmentMock = developmentMock
    this.replacementRequired = false
    this.firstRunCreateActive = false
    if (this.started) this.observeClient(client)
    const runtimeStatus = client.runtime.status()
    this.applyRuntimeStatus(runtimeStatus)
    if (runtimeStatus.state !== 'available') return
    const session = client.archive.session()
    if (!developmentMock && session.state === 'no-archive') {
      this.openExisting(client)
      return
    }
    this.applySession(session)
  }

  private observeClient(client: LifeArchiveClient): void {
    this.clearSubscriptions()
    const epoch = this.clientEpoch
    this.subscriptions = [
      client.runtime.observeStatus((status) => {
        if (this.client === client && this.clientEpoch === epoch) {
          this.applyRuntimeStatus(status)
        }
      }),
      client.archive.observeSession((session) => {
        if (this.client === client && this.clientEpoch === epoch) {
          this.applySession(session)
        }
      }),
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
    if (status.reason === 'worker-lost') {
      this.replacementRequired = true
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
    /*
     * A create attempt owns the first-run surface until an open archive is
     * confirmed. Failed create operations commonly publish opening followed
     * by closed/no-archive/locked before their result settles; rendering those
     * shell states would discard the operation intent and its actionable
     * failure UI.
     */
    if (this.firstRunCreateActive && session.state !== 'open') return

    switch (session.state) {
      case 'no-archive':
        this.lastOpen = null
        this.setState({ state: 'no-archive', ...common })
        return
      case 'opening':
        this.setState({
          state: 'opening',
          purpose: this.openPurpose,
          previousOpen: this.lastOpen,
          ...common,
        })
        return
      case 'closing':
        this.setState({ state: 'closing', ...common })
        return
      case 'closed':
        this.lastOpen = null
        this.setState({ state: 'closed', ...common })
        return
      case 'open':
        this.firstRunCreateActive = false
        this.lastOpen = session.archive
        this.setState({
          state: 'open',
          archive: session.archive,
          ...(session.transition ? { transition: session.transition } : {}),
          ...common,
        })
        return
      case 'open-in-another-tab':
        this.setState({ state: 'locked', ...common })
        return
      case 'needs-recovery':
        if (session.previousArchiveInvalid) {
          /*
           * Erase committed, but adopting the fresh archive overview failed.
           * The prior generation is definitively gone, so no route carrying
           * its identifiers or buffers may remain mounted during recovery.
           */
          this.lastOpen = null
        }
        this.setRecoverable(null)
        return
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

  private openExisting(client: LifeArchiveClient, recovering = false): void {
    if (this.openPromise) return
    const epoch = this.clientEpoch
    this.openPurpose = recovering ? 'recovery' : 'open'
    this.setState({
      state: 'opening',
      purpose: this.openPurpose,
      previousOpen: this.lastOpen,
      client,
      developmentMock: this.developmentMock,
    })
    this.openPromise = client.archive
      .open()
      .then((result) => {
        if (this.client !== client || this.clientEpoch !== epoch) return
        const currentSession = client.archive.session()
        if (currentSession.state === 'open') {
          this.applySession(currentSession)
          return
        }
        if (result.status === 'ok') {
          this.applySession({ state: 'open', archive: result.value })
          return
        }
        if (result.status === 'failed') {
          if (currentSession.state === 'open-in-another-tab') return
          if (
            result.failure.code === 'archiveNotFound' &&
            currentSession.state === 'no-archive'
          ) {
            this.applySession(currentSession)
            return
          }
          this.setRecoverable(result.failure)
        }
      })
      .catch(() => {
        if (this.client === client && this.clientEpoch === epoch) {
          this.setRecoverable(null)
        }
      })
      .finally(() => {
        if (this.client === client && this.clientEpoch === epoch) {
          this.openPromise = null
          this.openPurpose = 'open'
        }
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
      value={{
        state: controller.snapshot(),
        retry: controller.retry,
        dismissArchiveTransition: controller.dismissArchiveTransition,
        createFirstArchive: controller.createFirstArchive,
      }}
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
