import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { RecordPage } from '../features/record/RecordPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { TimelinePage } from '../features/timeline/TimelinePage'
import { RouteErrorBoundary } from './RouteErrorBoundary'

export function MainNavigation({
  inert = false,
}: {
  readonly inert?: boolean
}) {
  return (
    <nav aria-label="Main" aria-disabled={inert || undefined}>
      <ul>
        {(['record', 'timeline', 'settings'] as const).map((route) => (
          <li key={route}>
            {inert ? (
              <span>{route[0].toUpperCase() + route.slice(1)}</span>
            ) : (
              <Link to={`/${route}`}>
                {route[0].toUpperCase() + route.slice(1)}
              </Link>
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
