import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { RecordPage } from '../features/record/RecordPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { TimelinePage } from '../features/timeline/TimelinePage'
import { useTranslate } from '../i18n'
import { RouteErrorBoundary } from './RouteErrorBoundary'

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

export function MainNavigation({
  inert = false,
}: {
  readonly inert?: boolean
}) {
  const t = useTranslate()
  return (
    <nav
      aria-label={t('app.navigation.main')}
      aria-disabled={inert || undefined}
    >
      <ul>
        {MAIN_ROUTES.map((route) => (
          <li key={route.path}>
            {inert ? (
              <span>{t(route.label)}</span>
            ) : (
              <Link to={route.path}>{t(route.label)}</Link>
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

export function AppRoutes() {
  return (
    <main>
      <Routes>
        <Route path="/" element={<Navigate to="/record" replace />} />
        <Route path="/record" element={routeElement(<RecordPage />)} />
        <Route path="/timeline" element={routeElement(<TimelinePage />)} />
        <Route path="/settings" element={routeElement(<SettingsPage />)} />
        <Route path="*" element={<Navigate to="/record" replace />} />
      </Routes>
    </main>
  )
}
