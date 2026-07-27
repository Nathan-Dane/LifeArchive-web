import type { ReactNode } from 'react'
import { DevelopmentModeNotice } from '../core/bootstrap'
import { useTranslate } from '../i18n'
import { AppRoutes, MainNavigation } from './AppRoutes'
import { useAppState } from './providers'
import { AppFrame, StatusScreen } from './shell'

function reloadApplication(): void {
  globalThis.location.reload()
}

/**
 * The composed application.
 *
 * Every state renders inside the same frame, so the window, the appearance
 * control, and the page treatment do not appear and disappear as availability
 * changes. Main navigation is passed to the frame only in the states that may
 * reach a feature; runtime absence therefore never puts a route to an editor
 * on screen.
 */
export function AppShell() {
  const t = useTranslate()
  const { state, retry } = useAppState()

  switch (state.state) {
    case 'booting':
      return (
        <Frame>
          <StatusScreen title={t('app.status.booting.title')} busy />
        </Frame>
      )
    case 'runtime-unavailable':
      return (
        <Frame>
          <StatusScreen
            title={t('app.status.runtimeUnavailable.title')}
            detail={t('app.status.runtimeUnavailable.detail')}
            action={{ label: t('app.action.retry'), run: retry }}
          />
        </Frame>
      )
    case 'fatal-incompatibility':
      return (
        <Frame>
          <StatusScreen
            title={t('app.status.incompatible.title')}
            detail={t('app.status.incompatible.detail')}
            action={{ label: t('app.action.retry'), run: retry }}
            secondaryAction={{
              label: t('app.action.reload'),
              run: reloadApplication,
            }}
          />
        </Frame>
      )
    case 'no-archive':
      return (
        <Frame developmentMock={state.developmentMock}>
          <StatusScreen
            title={t('app.status.noArchive.title')}
            detail={t('app.status.noArchive.detail')}
          />
        </Frame>
      )
    case 'opening':
      return (
        <Frame developmentMock={state.developmentMock}>
          <StatusScreen title={t('app.status.opening.title')} busy />
        </Frame>
      )
    case 'locked':
      return (
        <Frame developmentMock={state.developmentMock}>
          <StatusScreen
            title={t('app.status.locked.title')}
            detail={t('app.status.locked.detail')}
            action={{ label: t('app.action.retry'), run: retry }}
          />
        </Frame>
      )
    case 'recoverable-failure':
      if (state.previousOpen) {
        return (
          <Frame
            developmentMock={state.developmentMock}
            navigation={<MainNavigation inert />}
          >
            <aside className="app-notice" role="alert">
              <strong>{t('app.notice.recoverable.title')}</strong>{' '}
              {t('app.notice.recoverable.detail')}
              <button type="button" className="button" onClick={retry}>
                {t('app.action.retry')}
              </button>
              <button
                type="button"
                className="button"
                onClick={reloadApplication}
              >
                {t('app.action.reload')}
              </button>
            </aside>
            <AppRoutes />
          </Frame>
        )
      }
      return (
        <Frame developmentMock={state.developmentMock}>
          <StatusScreen
            title={t('app.status.recoverable.title')}
            detail={t('app.status.recoverable.detail')}
            action={{ label: t('app.action.retry'), run: retry }}
            secondaryAction={{
              label: t('app.action.reload'),
              run: reloadApplication,
            }}
          />
        </Frame>
      )
    case 'open':
      return (
        <Frame
          developmentMock={state.developmentMock}
          navigation={<MainNavigation />}
        >
          <AppRoutes />
        </Frame>
      )
  }
}

function Frame({
  children,
  navigation,
  developmentMock = false,
}: {
  readonly children: ReactNode
  readonly navigation?: ReactNode
  readonly developmentMock?: boolean
}) {
  return (
    <AppFrame navigation={navigation}>
      {developmentMock ? <DevelopmentModeNotice /> : null}
      {children}
    </AppFrame>
  )
}
