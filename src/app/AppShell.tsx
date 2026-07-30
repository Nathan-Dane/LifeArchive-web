import type { ReactNode } from 'react'
import { DevelopmentModeNotice } from '../core/bootstrap'
import type {
  ClientFailure,
  LifeArchiveClient,
  OpenArchive,
  RuntimeIncompatibleReason,
} from '../core/client'
import { FirstRunPage } from '../features/archive/firstRun'
import { failureMessage, useLocalisation, useTranslate } from '../i18n'
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
  const localisation = useLocalisation()
  const t = useTranslate()
  const { state, retry, dismissArchiveTransition, createFirstArchive } =
    useAppState()

  if (state.state === 'open') {
    return (
      <ArchiveWorkspace
        client={state.client}
        archive={state.archive}
        developmentMock={state.developmentMock}
        transition={state.transition}
        dismissTransition={dismissArchiveTransition}
      />
    )
  }

  if (state.state === 'recoverable-failure' && state.previousOpen) {
    return (
      <ArchiveWorkspace
        client={state.client}
        archive={state.previousOpen}
        developmentMock={state.developmentMock}
        recovery={{
          state: 'failed',
          failure: state.failure,
          retry,
        }}
      />
    )
  }

  if (
    state.state === 'opening' &&
    state.purpose === 'recovery' &&
    state.previousOpen
  ) {
    return (
      <ArchiveWorkspace
        client={state.client}
        archive={state.previousOpen}
        developmentMock={state.developmentMock}
        recovery={{ state: 'retrying' }}
      />
    )
  }

  switch (state.state) {
    case 'booting':
      return (
        <Frame>
          <StatusScreen title={t('app.status.booting.title')} busy />
        </Frame>
      )
    case 'runtime-unavailable': {
      const unsupportedBrowser =
        state.reason === 'worker-unsupported' ||
        state.reason === 'insecure-context'
      return (
        <Frame>
          <StatusScreen
            title={t(
              unsupportedBrowser
                ? 'app.status.browserUnsupported.title'
                : 'app.status.runtimeUnavailable.title',
            )}
            detail={t(
              unsupportedBrowser
                ? 'app.status.browserUnsupported.detail'
                : 'app.status.runtimeUnavailable.detail',
            )}
            action={{ label: t('app.action.retry'), run: retry }}
          />
        </Frame>
      )
    }
    case 'fatal-incompatibility': {
      const unsupportedDetail = browserRejectionDetail(state.reason, t)
      const unsupportedBrowser = unsupportedDetail !== null
      return (
        <Frame>
          <StatusScreen
            title={t(
              unsupportedBrowser
                ? 'app.status.browserUnsupported.title'
                : 'app.status.incompatible.title',
            )}
            detail={unsupportedDetail ?? t('app.status.incompatible.detail')}
            action={{ label: t('app.action.retry'), run: retry }}
            secondaryAction={{
              label: t('app.action.reload'),
              run: reloadApplication,
            }}
          />
        </Frame>
      )
    }
    /*
     * No archive is the first run. It is the one unavailable-looking state
     * that has something to offer, so it gets the feature rather than a status
     * screen — but still no navigation, because there is nothing to navigate
     * to until the runtime confirms an archive.
     */
    case 'no-archive':
      return (
        <Frame developmentMock={state.developmentMock}>
          <FirstRunPage
            client={state.client}
            createArchive={() => createFirstArchive(state.client)}
          />
        </Frame>
      )
    case 'opening':
      return (
        <Frame developmentMock={state.developmentMock}>
          <StatusScreen
            title={t(
              state.purpose === 'recovery'
                ? 'app.status.recovering.title'
                : 'app.status.opening.title',
            )}
            detail={
              state.purpose === 'recovery'
                ? t('app.status.recovering.detail')
                : undefined
            }
            busy
          />
        </Frame>
      )
    case 'closing':
      return (
        <Frame developmentMock={state.developmentMock}>
          <StatusScreen title={t('app.status.closing.title')} busy />
        </Frame>
      )
    case 'closed':
      return (
        <Frame developmentMock={state.developmentMock}>
          <StatusScreen
            title={t('app.status.closed.title')}
            detail={t('app.status.closed.detail')}
            action={{ label: t('app.action.openArchive'), run: retry }}
          />
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
    case 'recoverable-failure': {
      const failureTitle = recoveryTitle(state.failure?.code, t)
      const failureDetail = state.failure
        ? failureMessage(localisation, state.failure)
        : t('app.status.recoverable.detail')
      return (
        <Frame developmentMock={state.developmentMock}>
          <StatusScreen
            title={failureTitle}
            detail={failureDetail}
            action={{ label: t('app.action.retry'), run: retry }}
            secondaryAction={{
              label: t('app.action.reload'),
              run: reloadApplication,
            }}
          />
        </Frame>
      )
    }
  }
}

function browserRejectionDetail(
  reason: RuntimeIncompatibleReason | 'archive-incompatible',
  t: ReturnType<typeof useTranslate>,
): string | null {
  switch (reason) {
    case 'browser-engine-unsupported':
      return t('app.status.browserUnsupported.engine')
    case 'browser-version-unsupported':
      return t('app.status.browserUnsupported.version')
    case 'browser-device-unsupported':
      return t('app.status.browserUnsupported.device')
    case 'browser-storage-unsupported':
      return t('app.status.browserUnsupported.storage')
    case 'environment-unsupported':
      return t('app.status.browserUnsupported.detail')
    default:
      return null
  }
}

function ArchiveWorkspace({
  client,
  archive,
  developmentMock,
  recovery,
  transition,
  dismissTransition,
}: {
  readonly client: LifeArchiveClient
  readonly archive: OpenArchive
  readonly developmentMock: boolean
  readonly transition?: 'erased'
  readonly dismissTransition?: () => void
  readonly recovery?:
    | {
        readonly state: 'failed'
        readonly failure: ClientFailure | null
        readonly retry: () => void
      }
    | { readonly state: 'retrying' }
}) {
  const localisation = useLocalisation()
  const t = useTranslate()
  const recovering = recovery !== undefined
  const generation = `${archive.storeId}:${archive.invalidation.storeInstanceId}`
  const failureDetail =
    recovery?.state === 'failed' && recovery.failure
      ? failureMessage(localisation, recovery.failure)
      : t('app.status.recoverable.detail')

  return (
    <Frame
      developmentMock={developmentMock}
      navigation={<MainNavigation inert={recovering} />}
    >
      {transition === 'erased' ? (
        <aside className="app-notice" role="status">
          <strong>{t('archive.erase.complete.title')}</strong>{' '}
          {t('archive.erase.complete.announcement')}
          <button type="button" className="button" onClick={dismissTransition}>
            {t('archive.erase.action.dismiss')}
          </button>
        </aside>
      ) : null}
      {recovering ? (
        <aside
          className="app-notice"
          role={recovery.state === 'failed' ? 'alert' : 'status'}
        >
          <strong>
            {t(
              recovery.state === 'failed'
                ? 'app.notice.recoverable.title'
                : 'app.status.recovering.title',
            )}
          </strong>{' '}
          {recovery.state === 'failed' ? (
            <>
              {failureDetail} {t('app.notice.recoverable.detail')}
            </>
          ) : (
            t('app.status.recovering.detail')
          )}
          {recovery.state === 'failed' ? (
            <>
              <button type="button" className="button" onClick={recovery.retry}>
                {t('app.action.retry')}
              </button>
              <button
                type="button"
                className="button"
                onClick={reloadApplication}
              >
                {t('app.action.reload')}
              </button>
            </>
          ) : null}
        </aside>
      ) : null}
      <AppRoutes
        key={generation}
        client={client}
        developmentMock={developmentMock}
        inert={recovering || undefined}
      />
    </Frame>
  )
}

function recoveryTitle(
  code: string | undefined,
  t: ReturnType<typeof useTranslate>,
): string {
  switch (code) {
    case 'unsupportedSchema':
    case 'unsupportedLayout':
      return t('app.status.newerArchive.title')
    case 'corruptStore':
      return t('app.status.corruptArchive.title')
    case 'recoveryIncomplete':
      return t('app.status.recoveryIncomplete.title')
    case 'ioFailure':
    case 'quotaExceeded':
    case 'storageQuotaExceeded':
      return t('app.status.storageFailure.title')
    default:
      return t('app.status.recoverable.title')
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
