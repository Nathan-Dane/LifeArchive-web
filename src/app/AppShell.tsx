import { DevelopmentModeNotice } from '../core/bootstrap'
import { AppRoutes, MainNavigation } from './AppRoutes'
import { useAppState } from './providers'

function reloadApplication(): void {
  globalThis.location.reload()
}

export function AppShell() {
  const { state, retry } = useAppState()

  switch (state.state) {
    case 'booting':
      return <StatusScreen title="Starting LifeArchive" busy />
    case 'runtime-unavailable':
      return (
        <StatusScreen
          title="LifeArchive cannot start"
          detail="The required runtime is unavailable. No archive has been opened."
          action={{ label: 'Try again', run: retry }}
        />
      )
    case 'fatal-incompatibility':
      return (
        <StatusScreen
          title="LifeArchive is incompatible"
          detail="This application cannot safely open the archive with the available runtime."
          action={{ label: 'Try again', run: retry }}
          secondaryAction={{
            label: 'Reload application',
            run: reloadApplication,
          }}
        />
      )
    case 'no-archive':
      return (
        <>
          {state.developmentMock ? <DevelopmentModeNotice /> : null}
          <StatusScreen
            title="No local archive found"
            detail="Record, Timeline, and Settings remain unavailable until an archive is opened."
          />
        </>
      )
    case 'opening':
      return (
        <>
          {state.developmentMock ? <DevelopmentModeNotice /> : null}
          <StatusScreen title="Opening archive" busy />
        </>
      )
    case 'locked':
      return (
        <>
          {state.developmentMock ? <DevelopmentModeNotice /> : null}
          <StatusScreen
            title="Archive in use"
            detail="Another tab owns this archive. Nothing was replaced."
            action={{ label: 'Try again', run: retry }}
          />
        </>
      )
    case 'recoverable-failure':
      if (state.previousOpen) {
        return (
          <>
            {state.developmentMock ? <DevelopmentModeNotice /> : null}
            <aside className="app-state-notice" role="alert">
              <strong>Archive connection needs attention.</strong> The last
              confirmed view remains visible. Retry before making further
              changes.
              <button type="button" onClick={retry}>
                Try again
              </button>
              <button type="button" onClick={reloadApplication}>
                Reload application
              </button>
            </aside>
            <MainNavigation inert />
            <AppRoutes />
          </>
        )
      }
      return (
        <>
          {state.developmentMock ? <DevelopmentModeNotice /> : null}
          <StatusScreen
            title="Archive needs attention"
            detail="The previous operation did not replace or erase the archive."
            action={{ label: 'Try again', run: retry }}
            secondaryAction={{
              label: 'Reload application',
              run: reloadApplication,
            }}
          />
        </>
      )
    case 'open':
      return (
        <>
          {state.developmentMock ? <DevelopmentModeNotice /> : null}
          <MainNavigation />
          <AppRoutes />
        </>
      )
  }
}

interface StatusAction {
  readonly label: string
  readonly run: () => void
}

function StatusScreen({
  title,
  detail,
  busy = false,
  action,
  secondaryAction,
}: {
  readonly title: string
  readonly detail?: string
  readonly busy?: boolean
  readonly action?: StatusAction
  readonly secondaryAction?: StatusAction
}) {
  return (
    <main>
      <section
        className="app-state-screen"
        aria-labelledby="app-state-title"
        aria-busy={busy || undefined}
      >
        <h1 id="app-state-title">{title}</h1>
        {detail ? <p>{detail}</p> : null}
        {action ? (
          <button type="button" onClick={action.run}>
            {action.label}
          </button>
        ) : null}
        {secondaryAction ? (
          <button type="button" onClick={secondaryAction.run}>
            {secondaryAction.label}
          </button>
        ) : null}
      </section>
    </main>
  )
}
