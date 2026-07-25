import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { RecordPage } from '../features/record/RecordPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { TimelinePage } from '../features/timeline/TimelinePage'

/**
 * Temporary navigation and route headings only. This shell makes no claim about
 * archives, storage, or any runtime being available.
 */
export function AppRoutes() {
  return (
    <>
      <nav aria-label="Main">
        <ul>
          <li>
            <Link to="/record">Record</Link>
          </li>
          <li>
            <Link to="/timeline">Timeline</Link>
          </li>
          <li>
            <Link to="/settings">Settings</Link>
          </li>
        </ul>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/record" replace />} />
          <Route path="/record" element={<RecordPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </>
  )
}
