import { useEffect, type ReactNode } from 'react'
import { useTranslate } from '../../i18n'
import { ShellIcon } from './ShellIcon'
import { useWorkspacePanels, type WorkspacePanel } from './workspacePanels'

const REGION_LABELS = {
  navigation: 'app.panel.navigation',
  details: 'app.panel.details',
} as const

export interface WorkspaceLayoutProps {
  readonly children: ReactNode
  /** Time and object navigation, on the leading edge of the wide layout. */
  readonly navigation?: ReactNode
  /** Details of the selected object, on the trailing edge. */
  readonly details?: ReactNode
}

/**
 * The workspace: a primary surface, optionally flanked by navigation and
 * details.
 *
 * Which regions exist is the view's decision, not the shell's, so a view that
 * passes neither simply gets one column and no drawer toggles. The staging —
 * details leaving the wide layout first, navigation second — is entirely in
 * `layout.css`; this component owns only which regions exist, which one is
 * open, and the accessible names and controls that go with them.
 */
export function WorkspaceLayout({
  children,
  navigation,
  details,
}: WorkspaceLayoutProps) {
  const { open, close, declareAvailable } = useWorkspacePanels()
  const hasNavigation = navigation !== undefined
  const hasDetails = details !== undefined

  useEffect(() => {
    const panels: WorkspacePanel[] = []
    if (hasNavigation) panels.push('navigation')
    if (hasDetails) panels.push('details')
    declareAvailable(panels)
    return () => declareAvailable([])
  }, [hasNavigation, hasDetails, declareAvailable])

  return (
    <div
      className="workspace"
      data-navigation={hasNavigation ? 'available' : 'none'}
      data-details={hasDetails ? 'available' : 'none'}
      data-open={open ?? 'none'}
    >
      {hasNavigation ? (
        <WorkspaceRegion panel="navigation">{navigation}</WorkspaceRegion>
      ) : null}
      <main className="workspace__content">{children}</main>
      {hasDetails ? (
        <WorkspaceRegion panel="details">{details}</WorkspaceRegion>
      ) : null}
      {hasNavigation || hasDetails ? (
        <div
          className="workspace__backdrop"
          aria-hidden="true"
          onClick={close}
        />
      ) : null}
    </div>
  )
}

/**
 * One flanking region. Its heading and close control are shown by the
 * stylesheet only while the region is a drawer; in the wide layout the region
 * is a column of the page and needs neither.
 */
function WorkspaceRegion({
  panel,
  children,
}: {
  readonly panel: WorkspacePanel
  readonly children: ReactNode
}) {
  const t = useTranslate()
  const { close } = useWorkspacePanels()
  const label = t(REGION_LABELS[panel])

  return (
    <aside
      id={`workspace-${panel}`}
      className={`workspace__${panel}`}
      aria-label={label}
    >
      <div className="workspace__panel-head">
        <span className="eyebrow">{label}</span>
        <button
          type="button"
          className="workspace__panel-close"
          onClick={close}
          aria-label={t('app.action.closePanel', { panel: label })}
        >
          <ShellIcon name="close" />
        </button>
      </div>
      {children}
    </aside>
  )
}
