import { useEffect, type ReactNode } from 'react'
import {
  matchPath,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import {
  RecordDestinationProvider,
  RecordDetailsRegion,
  RecordNavigationRegion,
  RecordPage,
} from '../features/record'
import { SettingsNavigationRegion, SettingsPage } from '../features/settings'
import { ArchiveOverviewProvider } from '../features/settings/archive'
import { useBrowserPreferences } from '../features/settings/preferences'
import { TimelinePage } from '../features/timeline/TimelinePage'
import type { LifeArchiveClient } from '../core/client'
import { useTranslate } from '../i18n'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { WorkspaceLayout } from './shell'
import { ShellIcon, type ShellIconName } from './shell/ShellIcon'

/** The flanking regions a route offers, if it offers any. */
interface WorkspaceRegions {
  readonly navigation?: ReactNode
  readonly details?: ReactNode
}

/**
 * The routes, paired with the catalog key that names them. The path is an
 * identifier and the label is copy; deriving one from the other by capitalising
 * a URL segment is how a navigation item ends up untranslatable.
 *
 * A route may also declare the workspace regions it offers, and a `surround`
 * that wraps every region it occupies. Which regions exist belongs to the
 * view, not to the shell, and a view whose regions describe one state needs
 * that state above all of them — Record's flanking regions and its primary
 * region are three views of one destination.
 */
const MAIN_ROUTES = [
  {
    path: '/record',
    navigationPath: '/record',
    label: 'app.navigation.record',
    icon: 'record',
    element: () => <RecordPage />,
    regions: (): WorkspaceRegions => ({
      navigation: <RecordNavigationRegion />,
      details: <RecordDetailsRegion />,
    }),
    surround: (
      client: LifeArchiveClient,
      workspace: ReactNode,
      developmentMock: boolean,
    ) => (
      <RecordWorkspaceProvider
        client={client}
        developmentMock={developmentMock}
      >
        {workspace}
      </RecordWorkspaceProvider>
    ),
  },
  {
    path: '/timeline',
    navigationPath: '/timeline',
    label: 'app.navigation.timeline',
    icon: 'timeline',
    element: () => <TimelinePage />,
  },
  {
    path: '/settings/*',
    navigationPath: '/settings',
    label: 'app.navigation.settings',
    icon: 'settings',
    element: (client: LifeArchiveClient) => <SettingsPage client={client} />,
    regions: (client: LifeArchiveClient): WorkspaceRegions => ({
      navigation: <SettingsNavigationRegion client={client} />,
    }),
    surround: (client: LifeArchiveClient, workspace: ReactNode) => (
      <ArchiveOverviewProvider client={client}>
        {workspace}
      </ArchiveOverviewProvider>
    ),
  },
] as const satisfies readonly {
  readonly path: string
  readonly navigationPath: string
  readonly label: string
  readonly icon: ShellIconName
  readonly element: (client: LifeArchiveClient) => ReactNode
  readonly regions?: (client: LifeArchiveClient) => WorkspaceRegions
  readonly surround?: (
    client: LifeArchiveClient,
    workspace: ReactNode,
    developmentMock: boolean,
  ) => ReactNode
}[]

/**
 * `NavLink` marks the current section with `aria-current`, which is what the
 * stylesheet styles. The state is therefore announced and weighted, not
 * signalled by the accent colour alone.
 */
export function MainNavigation({
  inert = false,
}: {
  readonly inert?: boolean
}) {
  const t = useTranslate()
  return (
    <nav
      className="shell-nav"
      aria-label={t('app.navigation.main')}
      aria-disabled={inert || undefined}
    >
      <ul className="shell-nav__list ui-text">
        {MAIN_ROUTES.map((route) => (
          <li key={route.navigationPath}>
            {inert ? (
              <span className="shell-nav__link">{t(route.label)}</span>
            ) : (
              <NavLink to={route.navigationPath} className="shell-nav__link">
                <ShellIcon name={route.icon} />
                {t(route.label)}
              </NavLink>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}

function routeElement(element: React.ReactNode) {
  return <RouteErrorBoundary>{element}</RouteErrorBoundary>
}

function RecordWorkspaceProvider({
  client,
  developmentMock,
  children,
}: {
  readonly client: LifeArchiveClient
  readonly developmentMock: boolean
  readonly children: ReactNode
}) {
  const { preferences } = useBrowserPreferences()
  const remembered = preferences.recordInitialScale === 'last'
  return (
    <RecordDestinationProvider
      client={client}
      developmentMock={developmentMock}
      cursorOptions={{
        initialScale: remembered ? 'day' : preferences.recordInitialScale,
        restoreScale: remembered,
      }}
    >
      {children}
    </RecordDestinationProvider>
  )
}

function StartupRedirect() {
  const { preferences } = useBrowserPreferences()
  const destination =
    preferences.openAppTo === 'last'
      ? preferences.lastOpenedPage
      : preferences.openAppTo
  return <Navigate to={`/${destination}`} replace />
}

function RememberMainDestination({ pathname }: { readonly pathname: string }) {
  const { preferences, setPreference } = useBrowserPreferences()
  useEffect(() => {
    const destination =
      pathname === '/record'
        ? 'record'
        : pathname === '/timeline'
          ? 'timeline'
          : null
    if (destination && preferences.lastOpenedPage !== destination) {
      setPreference('lastOpenedPage', destination)
    }
  }, [pathname, preferences.lastOpenedPage, setPreference])
  return null
}

/**
 * The feature routes, inside the workspace.
 *
 * Time navigation and object details belong to Record rather than the route
 * composition, so the workspace is given whatever regions the matched route
 * declares and knows nothing about what is inside them.
 */
export function AppRoutes({
  client,
  inert = false,
  developmentMock = false,
}: {
  readonly client: LifeArchiveClient
  readonly inert?: boolean
  readonly developmentMock?: boolean
}) {
  const { pathname } = useLocation()
  const matched = MAIN_ROUTES.find((route) => matchPath(route.path, pathname))
  const regions: WorkspaceRegions =
    matched && 'regions' in matched ? matched.regions(client) : {}

  const workspace = (
    <WorkspaceLayout
      inert={inert}
      navigation={regions.navigation}
      details={regions.details}
    >
      <RememberMainDestination pathname={pathname} />
      <Routes>
        <Route path="/" element={<StartupRedirect />} />
        {MAIN_ROUTES.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={routeElement(route.element(client))}
          />
        ))}
        <Route path="*" element={<Navigate to="/record" replace />} />
      </Routes>
    </WorkspaceLayout>
  )

  return matched && 'surround' in matched
    ? matched.surround(client, workspace, developmentMock)
    : workspace
}
