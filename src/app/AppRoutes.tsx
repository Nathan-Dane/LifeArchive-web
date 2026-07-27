import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { RecordPage } from '../features/record/RecordPage'
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
 */
const MAIN_ROUTES = [
  { path: '/record', label: 'app.navigation.record' },
  { path: '/timeline', label: 'app.navigation.timeline' },
  { path: '/settings', label: 'app.navigation.settings' },
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
 * The workspace is given no flanking regions yet: time navigation and object
 * details belong to Record, which supplies them when those panels exist. Until
 * then the primary surface is the whole workspace and the shell offers no
 * drawer to open.
 */
export function AppRoutes({
  client,
  inert = false,
}: {
  readonly client: LifeArchiveClient
  readonly inert?: boolean
}) {
  return (
    <WorkspaceLayout inert={inert}>
      <Routes>
        <Route path="/" element={<Navigate to="/record" replace />} />
        <Route path="/record" element={routeElement(<RecordPage />)} />
        <Route path="/timeline" element={routeElement(<TimelinePage />)} />
        <Route
          path="/settings"
          element={routeElement(<SettingsPage client={client} />)}
        />
        <Route
          path="/settings/archive"
          element={routeElement(<ArchiveManagementPage client={client} />)}
        />
        <Route path="*" element={<Navigate to="/record" replace />} />
      </Routes>
    </WorkspaceLayout>
  )
}
