import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { RecordPage } from '../features/record/RecordPage'
import { RecordNavigationPanel } from '../features/record/navigation'
import { SettingsPage } from '../features/settings/SettingsPage'
import { ArchiveManagementPage } from '../features/settings/archive'
import { TimelinePage } from '../features/timeline/TimelinePage'
import type { LifeArchiveClient } from '../core/client'
import { useTranslate } from '../i18n'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { WorkspaceLayout } from './shell'

/**
 * The routes, paired with the catalog key that names them. The path is an
 * identifier and the label is copy; deriving one from the other by capitalising
 * a URL segment is how a navigation item ends up untranslatable.
 *
 * A route may also declare the workspace regions it offers. Which regions
 * exist belongs to the view, not to the shell, so the shell asks the route
 * rather than deciding for it.
 */
const MAIN_ROUTES = [
  {
    path: '/record',
    label: 'app.navigation.record',
    element: () => <RecordPage />,
    navigation: (client: LifeArchiveClient) => (
      <RecordNavigationPanel client={client} />
    ),
  },
  {
    path: '/timeline',
    label: 'app.navigation.timeline',
    element: () => <TimelinePage />,
  },
  {
    path: '/settings',
    label: 'app.navigation.settings',
    element: (client: LifeArchiveClient) => <SettingsPage client={client} />,
  },
] as const

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
          <li key={route.path}>
            {inert ? (
              <span className="shell-nav__link">{t(route.label)}</span>
            ) : (
              <NavLink to={route.path} className="shell-nav__link">
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
}: {
  readonly client: LifeArchiveClient
  readonly inert?: boolean
}) {
  const { pathname } = useLocation()
  const matched = MAIN_ROUTES.find((route) => route.path === pathname)
  const navigation =
    matched && 'navigation' in matched ? matched.navigation(client) : undefined

  return (
    <WorkspaceLayout inert={inert} navigation={navigation}>
      <Routes>
        <Route path="/" element={<Navigate to="/record" replace />} />
        {MAIN_ROUTES.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={routeElement(route.element(client))}
          />
        ))}
        <Route
          path="/settings/archive"
          element={routeElement(<ArchiveManagementPage client={client} />)}
        />
        <Route path="*" element={<Navigate to="/record" replace />} />
      </Routes>
    </WorkspaceLayout>
  )
}
