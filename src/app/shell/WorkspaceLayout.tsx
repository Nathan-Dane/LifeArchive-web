import { useEffect, useRef, type ReactNode } from 'react'
import { useFocusTrap, useMediaQuery } from '../../accessibility'
import { useTranslate } from '../../i18n'
import { ShellIcon } from './ShellIcon'
import { useWorkspacePanels, type WorkspacePanel } from './workspacePanels'

const REGION_LABELS = {
  navigation: 'app.panel.navigation',
  details: 'app.panel.details',
} as const

export interface WorkspaceLayoutProps {
  readonly children: ReactNode
  /** Keeps the mounted route visible but non-interactive during recovery. */
  readonly inert?: boolean
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
  inert,
  navigation,
  details,
}: WorkspaceLayoutProps) {
  const { open, close, declareAvailable } = useWorkspacePanels()
  const hasNavigation = navigation !== undefined
  const hasDetails = details !== undefined
  const navigationIsDrawer = useMediaQuery('(max-width: 820px)')
  const detailsIsDrawer = useMediaQuery('(max-width: 1120px)')

  useEffect(() => {
    const panels: WorkspacePanel[] = []
    if (hasNavigation) panels.push('navigation')
    if (hasDetails) panels.push('details')
    declareAvailable(panels)
    return () => declareAvailable([])
  }, [hasNavigation, hasDetails, declareAvailable])

  useEffect(() => {
    if (
      (open === 'navigation' && !navigationIsDrawer) ||
      (open === 'details' && !detailsIsDrawer)
    ) {
      close()
    }
  }, [close, detailsIsDrawer, navigationIsDrawer, open])

  return (
    <div
      className="workspace"
      data-navigation={hasNavigation ? 'available' : 'none'}
      data-details={hasDetails ? 'available' : 'none'}
      data-open={open ?? 'none'}
      inert={inert || undefined}
      aria-disabled={inert || undefined}
    >
      {hasNavigation ? (
        <WorkspaceRegion
          panel="navigation"
          drawer={navigationIsDrawer}
          open={open === 'navigation'}
        >
          {navigation}
        </WorkspaceRegion>
      ) : null}
      <main id="main-content" className="workspace__content" tabIndex={-1}>
        {children}
      </main>
      {hasDetails ? (
        <WorkspaceRegion
          panel="details"
          drawer={detailsIsDrawer}
          open={open === 'details'}
        >
          {details}
        </WorkspaceRegion>
      ) : null}
      {hasNavigation || hasDetails ? (
        <button
          type="button"
          className="workspace__backdrop"
          tabIndex={-1}
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
  drawer,
  open,
  children,
}: {
  readonly panel: WorkspacePanel
  readonly drawer: boolean
  readonly open: boolean
  readonly children: ReactNode
}) {
  const t = useTranslate()
  const { close } = useWorkspacePanels()
  const label = t(REGION_LABELS[panel])
  const region = useRef<HTMLElement>(null)
  useFocusTrap(region, { active: drawer && open, onEscape: close })

  return (
    <aside
      ref={region}
      id={`workspace-${panel}`}
      className={`workspace__${panel}`}
      aria-label={label}
      role={drawer ? 'dialog' : undefined}
      aria-modal={drawer && open ? 'true' : undefined}
      aria-hidden={drawer && !open ? 'true' : undefined}
      inert={drawer && !open ? true : undefined}
      tabIndex={-1}
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
