import { DevelopmentModeNotice } from '../core/bootstrap'
import { useTranslate } from '../i18n'
import { AppRoutes, MainNavigation } from './AppRoutes'
import { useAppState } from './providers'

function reloadApplication(): void {
  globalThis.location.reload()
}

export function AppShell() {
  const t = useTranslate()
  const { state, retry } = useAppState()

  switch (state.state) {
    case 'booting':
      return <StatusScreen title={t('app.status.booting.title')} busy />
    case 'runtime-unavailable':
      return (
        <StatusScreen
          title={t('app.status.runtimeUnavailable.title')}
          detail={t('app.status.runtimeUnavailable.detail')}
          action={{ label: t('app.action.retry'), run: retry }}
        />
      )
    case 'fatal-incompatibility':
      return (
        <StatusScreen
          title={t('app.status.incompatible.title')}
          detail={t('app.status.incompatible.detail')}
          action={{ label: t('app.action.retry'), run: retry }}
          secondaryAction={{
            label: t('app.action.reload'),
            run: reloadApplication,
          }}
        />
      )
    case 'no-archive':
      return (
        <>
          {state.developmentMock ? <DevelopmentModeNotice /> : null}
          <StatusScreen
            title={t('app.status.noArchive.title')}
            detail={t('app.status.noArchive.detail')}
          />
        </>
      )
    case 'opening':
      return (
        <>
          {state.developmentMock ? <DevelopmentModeNotice /> : null}
          <StatusScreen title={t('app.status.opening.title')} busy />
        </>
      )
    case 'locked':
      return (
        <>
          {state.developmentMock ? <DevelopmentModeNotice /> : null}
          <StatusScreen
            title={t('app.status.locked.title')}
            detail={t('app.status.locked.detail')}
            action={{ label: t('app.action.retry'), run: retry }}
          />
        </>
      )
    case 'recoverable-failure':
      if (state.previousOpen) {
        return (
          <>
            {state.developmentMock ? <DevelopmentModeNotice /> : null}
            <aside className="app-state-notice" role="alert">
              <strong>{t('app.notice.recoverable.title')}</strong>{' '}
              {t('app.notice.recoverable.detail')}
              <button type="button" onClick={retry}>
                {t('app.action.retry')}
              </button>
              <button type="button" onClick={reloadApplication}>
                {t('app.action.reload')}
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
            title={t('app.status.recoverable.title')}
            detail={t('app.status.recoverable.detail')}
            action={{ label: t('app.action.retry'), run: retry }}
            secondaryAction={{
              label: t('app.action.reload'),
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

/**
 * Every string reaching this component is already localised: it takes copy,
 * not keys, so no phrase can be assembled here out of translated fragments.
 */
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
