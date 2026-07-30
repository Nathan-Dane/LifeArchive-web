import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type UIEvent as ReactUIEvent,
} from 'react'
import { useFocusTrap, useMediaQuery } from '../../accessibility'
import { useTranslate } from '../../i18n'
import { ShellIcon } from './ShellIcon'
import { useWorkspacePanels, type WorkspacePanel } from './workspacePanels'

const REGION_LABELS = {
  navigation: 'app.panel.navigation',
  details: 'app.panel.details',
} as const

const TRANSIENT_SCROLLBARS = [
  {
    key: 'navigation',
    selector: '.record-objects__groups',
  },
  {
    key: 'content',
    selector: '.workspace__content',
  },
  {
    key: 'details',
    selector: '.record-details',
  },
] as const
type TransientScrollbarKey = (typeof TRANSIENT_SCROLLBARS)[number]['key']
interface ScrollbarDrag {
  readonly pointerId: number
  readonly startScrollTop: number
  readonly startY: number
  readonly target: HTMLElement
}

const SCROLLBAR_HIDE_DELAY_MS = 300
const SCROLLBAR_EDGE_INSET_PX = 2
const SCROLLBAR_MIN_THUMB_HEIGHT_PX = 24

function positionScrollbarOverlay(
  workspace: HTMLElement,
  target: HTMLElement,
  overlay: HTMLElement,
) {
  const workspaceBox = workspace.getBoundingClientRect()
  const targetBox = target.getBoundingClientRect()
  const trackHeight = Math.max(
    0,
    targetBox.height - SCROLLBAR_EDGE_INSET_PX * 2,
  )
  const thumbHeight = Math.min(
    trackHeight,
    Math.max(
      SCROLLBAR_MIN_THUMB_HEIGHT_PX,
      trackHeight * (target.clientHeight / target.scrollHeight),
    ),
  )
  const scrollRange = target.scrollHeight - target.clientHeight
  const thumbRange = trackHeight - thumbHeight
  const thumbOffset =
    scrollRange > 0 ? (target.scrollTop / scrollRange) * thumbRange : 0

  overlay.style.left = `${targetBox.right - workspaceBox.left - SCROLLBAR_EDGE_INSET_PX - overlay.offsetWidth}px`
  overlay.style.top = `${targetBox.top - workspaceBox.top + SCROLLBAR_EDGE_INSET_PX + thumbOffset}px`
  overlay.style.height = `${thumbHeight}px`
  overlay.dataset.visible = scrollRange > 0 ? 'true' : 'false'
}

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
  const workspace = useRef<HTMLDivElement>(null)
  const scrollbarOverlays = useRef(
    new Map<TransientScrollbarKey, HTMLSpanElement>(),
  )
  const scrollbarTargets = useRef(new Map<TransientScrollbarKey, HTMLElement>())
  const scrollbarDrag = useRef<ScrollbarDrag>(null)
  const scrollbarTimers = useRef(
    new Map<HTMLElement, ReturnType<typeof globalThis.setTimeout>>(),
  )

  const hideScrollbarSoon = useCallback(
    (target: HTMLElement, overlay: HTMLElement) => {
      const pending = scrollbarTimers.current.get(target)
      if (pending !== undefined) globalThis.clearTimeout(pending)
      const timer = globalThis.setTimeout(() => {
        delete target.dataset.scrollbarVisible
        overlay.dataset.visible = 'false'
        scrollbarTimers.current.delete(target)
      }, SCROLLBAR_HIDE_DELAY_MS)
      scrollbarTimers.current.set(target, timer)
    },
    [],
  )

  const revealActiveScrollbar = useCallback(
    (event: ReactUIEvent<HTMLElement>) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return

      const scrollbar = TRANSIENT_SCROLLBARS.find(({ selector }) =>
        target.matches(selector),
      )
      const overlay = scrollbar
        ? scrollbarOverlays.current.get(scrollbar.key)
        : undefined
      if (!scrollbar || !overlay || !workspace.current) return

      scrollbarTargets.current.set(scrollbar.key, target)
      target.dataset.scrollbarVisible = 'true'
      positionScrollbarOverlay(workspace.current, target, overlay)
      hideScrollbarSoon(target, overlay)
    },
    [hideScrollbarSoon],
  )

  const startScrollbarDrag = useCallback(
    (key: TransientScrollbarKey, event: ReactPointerEvent<HTMLSpanElement>) => {
      const target = scrollbarTargets.current.get(key)
      if (!target) return

      const pending = scrollbarTimers.current.get(target)
      if (pending !== undefined) globalThis.clearTimeout(pending)
      event.currentTarget.setPointerCapture(event.pointerId)
      scrollbarDrag.current = {
        pointerId: event.pointerId,
        startScrollTop: target.scrollTop,
        startY: event.clientY,
        target,
      }
      event.preventDefault()
    },
    [],
  )

  const moveScrollbarDrag = useCallback(
    (event: ReactPointerEvent<HTMLSpanElement>) => {
      const drag = scrollbarDrag.current
      if (!drag || drag.pointerId !== event.pointerId) return

      const trackHeight = Math.max(
        0,
        drag.target.getBoundingClientRect().height -
          SCROLLBAR_EDGE_INSET_PX * 2,
      )
      const thumbRange = trackHeight - event.currentTarget.offsetHeight
      const scrollRange = drag.target.scrollHeight - drag.target.clientHeight
      if (thumbRange <= 0 || scrollRange <= 0) return

      drag.target.scrollTop =
        drag.startScrollTop +
        ((event.clientY - drag.startY) / thumbRange) * scrollRange
    },
    [],
  )

  const finishScrollbarDrag = useCallback(
    (event: ReactPointerEvent<HTMLSpanElement>) => {
      const drag = scrollbarDrag.current
      if (!drag || drag.pointerId !== event.pointerId) return

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      scrollbarDrag.current = null
      hideScrollbarSoon(drag.target, event.currentTarget)
    },
    [hideScrollbarSoon],
  )

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

  useEffect(
    () => () => {
      for (const timer of scrollbarTimers.current.values()) {
        globalThis.clearTimeout(timer)
      }
      scrollbarTimers.current.clear()
    },
    [],
  )

  return (
    <div
      ref={workspace}
      className="workspace"
      data-navigation={hasNavigation ? 'available' : 'none'}
      data-details={hasDetails ? 'available' : 'none'}
      data-open={open ?? 'none'}
      inert={inert || undefined}
      aria-disabled={inert || undefined}
      onScrollCapture={revealActiveScrollbar}
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
      {TRANSIENT_SCROLLBARS.map(({ key }) => (
        <span
          key={key}
          ref={(overlay) => {
            if (overlay) scrollbarOverlays.current.set(key, overlay)
            else scrollbarOverlays.current.delete(key)
          }}
          className="workspace__scrollbar-overlay"
          data-scrollbar-for={key}
          data-visible="false"
          aria-hidden="true"
          onPointerDown={(event) => startScrollbarDrag(key, event)}
          onPointerMove={moveScrollbarDrag}
          onPointerUp={finishScrollbarDrag}
          onPointerCancel={finishScrollbarDrag}
        />
      ))}
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
