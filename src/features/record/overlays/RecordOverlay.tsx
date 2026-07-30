import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../../../accessibility'

const DEFAULT_VIEWPORT_GUTTER = 20
const EXIT_FALLBACK_MS = 320

type OverlayPhase = 'opening' | 'open' | 'closing'

function prefersReducedMotion(): boolean {
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

interface AnchoredPosition {
  readonly left: number
  readonly top: number
  readonly maxWidth: number
  readonly maxHeight: number
  readonly anchorWidth: number
  readonly ready: boolean
}

const INITIAL_POSITION: AnchoredPosition = {
  left: 0,
  top: 0,
  maxWidth: 0,
  maxHeight: 0,
  anchorWidth: 0,
  ready: false,
}

export interface RecordOverlayProps {
  readonly id?: string
  readonly open: boolean
  readonly kind: 'menu' | 'anchored' | 'modal'
  readonly labelledBy: string
  readonly onClose: () => void
  readonly onClosed?: () => void
  readonly children: ReactNode
  readonly anchorRef?: RefObject<HTMLElement | null>
  readonly widthRef?: RefObject<HTMLElement | null>
  readonly initialFocusRef?: RefObject<HTMLElement | null>
  readonly className?: string
  readonly surfaceRole?: 'dialog' | 'menu'
  readonly anchorPlacement?: 'responsive' | 'above'
  readonly modalPlacement?: 'responsive' | 'center'
}

/**
 * One blocking layer for Record popups and task modals.
 *
 * Anchored surfaces begin centred over their activating control, then clamp
 * inward to the tokenised viewport gutter. The same layer owns dismissal,
 * focus trapping, focus restoration, viewport collision, and the stronger
 * backdrop so individual pickers cannot drift into separate behaviours.
 * Footer actions can request an above-anchor placement while retaining the
 * shell's shared collision and fixed-after-opening behaviour.
 */
export function RecordOverlay({
  id,
  open,
  kind,
  labelledBy,
  onClose,
  onClosed,
  children,
  anchorRef,
  widthRef,
  initialFocusRef,
  className,
  surfaceRole,
  anchorPlacement = 'responsive',
  modalPlacement = 'responsive',
}: RecordOverlayProps) {
  const surfaceRef = useRef<HTMLElement>(null)
  const exitTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(
    null,
  )
  const [mounted, setMounted] = useState(open)
  const [observedOpen, setObservedOpen] = useState(open)
  const [phase, setPhase] = useState<OverlayPhase>(open ? 'opening' : 'closing')
  const [position, setPosition] = useState<AnchoredPosition>(INITIAL_POSITION)

  if (open !== observedOpen) {
    setObservedOpen(open)
    if (open) {
      setPosition(INITIAL_POSITION)
      setMounted(true)
      setPhase('opening')
    } else if (mounted) {
      setPhase('closing')
    }
  }

  useFocusTrap(surfaceRef, {
    active: mounted && kind !== 'menu',
    onEscape: onClose,
    initialFocusRef,
    returnFocusRef: anchorRef,
  })

  const finishClosing = useCallback(() => {
    if (exitTimer.current !== null) {
      globalThis.clearTimeout(exitTimer.current)
      exitTimer.current = null
    }
    setMounted(false)
    onClosed?.()
  }, [onClosed])

  useEffect(() => {
    if (!mounted) return
    if (open && phase === 'opening') {
      const frame = globalThis.requestAnimationFrame(() => setPhase('open'))
      return () => globalThis.cancelAnimationFrame(frame)
    }
    if (!open && phase === 'closing') {
      exitTimer.current = globalThis.setTimeout(
        finishClosing,
        prefersReducedMotion() ? 0 : EXIT_FALLBACK_MS,
      )
      return () => {
        if (exitTimer.current !== null) {
          globalThis.clearTimeout(exitTimer.current)
          exitTimer.current = null
        }
      }
    }
  }, [finishClosing, mounted, open, phase])

  useEffect(() => {
    if (kind !== 'menu' || !mounted || phase === 'closing') return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [kind, mounted, onClose, phase])

  const updatePosition = useCallback(() => {
    if (!open || !mounted || kind === 'modal') return
    const anchor = anchorRef?.current
    const widthReference = widthRef?.current ?? anchor
    const surface = surfaceRef.current
    if (!anchor?.isConnected || !widthReference?.isConnected || !surface) {
      onClose()
      return
    }

    const rootStyle = globalThis.getComputedStyle(document.documentElement)
    const tokenGutter = Number.parseFloat(
      rootStyle.getPropertyValue('--overlay-viewport-gutter'),
    )
    const gutter = Number.isFinite(tokenGutter)
      ? tokenGutter
      : DEFAULT_VIEWPORT_GUTTER
    const viewport = globalThis.visualViewport
    const viewportLeft = viewport?.offsetLeft ?? 0
    const viewportTop = viewport?.offsetTop ?? 0
    const viewportWidth = viewport?.width ?? globalThis.innerWidth
    const viewportHeight = viewport?.height ?? globalThis.innerHeight
    const maxWidth = Math.max(0, viewportWidth - gutter * 2)
    const maxHeight = Math.max(0, viewportHeight - gutter * 2)
    const anchorBounds = anchor.getBoundingClientRect()
    const widthBounds = widthReference.getBoundingClientRect()
    const surfaceBounds = surface.getBoundingClientRect()
    const surfaceStyle = globalThis.getComputedStyle(surface)
    const borderHeight =
      Number.parseFloat(surfaceStyle.borderTopWidth) +
      Number.parseFloat(surfaceStyle.borderBottomWidth)
    const tokenMenuMinHeight = Number.parseFloat(
      rootStyle.getPropertyValue('--overlay-menu-min-height'),
    )
    const menuMinHeight = Number.isFinite(tokenMenuMinHeight)
      ? tokenMenuMinHeight
      : 0
    const naturalSurfaceHeight = Math.max(
      surfaceBounds.height,
      surface.scrollHeight + (Number.isFinite(borderHeight) ? borderHeight : 0),
    )
    const width = Math.min(
      kind === 'menu' ? widthBounds.width : surfaceBounds.width,
      maxWidth,
    )
    const height = Math.min(
      kind === 'menu'
        ? Math.max(naturalSurfaceHeight, menuMinHeight)
        : naturalSurfaceHeight,
      maxHeight,
    )
    const minimumLeft = viewportLeft + gutter
    const minimumTop = viewportTop + gutter
    const maximumLeft = viewportLeft + viewportWidth - gutter - width
    const maximumTop = viewportTop + viewportHeight - gutter - height
    const idealLeft =
      kind === 'menu'
        ? anchorBounds.left
        : anchorBounds.left + anchorBounds.width / 2 - width / 2
    const idealTop =
      kind === 'menu'
        ? Math.min(
            anchorBounds.bottom + gutter / 2,
            viewportTop + viewportHeight - gutter - height,
          )
        : anchorPlacement === 'above'
          ? anchorBounds.top - height - gutter / 2
          : anchorBounds.top + anchorBounds.height / 2 - height / 2

    setPosition((current) => {
      /*
       * Opening establishes the popup's final location. Menus measure their
       * complete scroll height before becoming visible, prefer the space below
       * their trigger, and use any shortfall above it while preserving the
       * bottom gutter. Later observations may update available dimensions but
       * never move a view that is already open.
       */
      const preserveEstablishedPosition = current.ready
      const left = preserveEstablishedPosition
        ? current.left
        : Math.min(Math.max(idealLeft, minimumLeft), maximumLeft)
      const top = preserveEstablishedPosition
        ? current.top
        : Math.min(Math.max(idealTop, minimumTop), maximumTop)
      const next = {
        left,
        top,
        maxWidth,
        maxHeight,
        anchorWidth: widthBounds.width,
        ready: true,
      }
      return Object.entries(next).every(
        ([key, value]) => current[key as keyof AnchoredPosition] === value,
      )
        ? current
        : next
    })
  }, [anchorPlacement, anchorRef, kind, mounted, onClose, open, widthRef])

  useLayoutEffect(() => {
    if (!open || !mounted || kind === 'modal') return
    updatePosition()
    const surface = surfaceRef.current
    const anchor = anchorRef?.current
    const widthReference = widthRef?.current
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updatePosition)
    if (surface) resizeObserver?.observe(surface)
    if (anchor) resizeObserver?.observe(anchor)
    if (widthReference && widthReference !== anchor) {
      resizeObserver?.observe(widthReference)
    }
    globalThis.addEventListener('resize', updatePosition)
    globalThis.addEventListener('scroll', updatePosition, true)
    globalThis.visualViewport?.addEventListener('resize', updatePosition)
    globalThis.visualViewport?.addEventListener('scroll', updatePosition)
    return () => {
      resizeObserver?.disconnect()
      globalThis.removeEventListener('resize', updatePosition)
      globalThis.removeEventListener('scroll', updatePosition, true)
      globalThis.visualViewport?.removeEventListener('resize', updatePosition)
      globalThis.visualViewport?.removeEventListener('scroll', updatePosition)
    }
  }, [anchorRef, kind, mounted, open, updatePosition, widthRef])

  if (!mounted) return null

  const style =
    kind !== 'modal'
      ? ({
          '--record-overlay-left': `${position.left}px`,
          '--record-overlay-top': `${position.top}px`,
          '--record-overlay-max-width': `${position.maxWidth}px`,
          '--record-overlay-max-height': `${position.maxHeight}px`,
          '--record-overlay-anchor-width': `${position.anchorWidth}px`,
        } as CSSProperties)
      : undefined

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  return createPortal(
    <div
      className="record-overlay"
      data-kind={kind}
      data-placement={
        kind === 'modal'
          ? modalPlacement
          : kind === 'anchored'
            ? anchorPlacement
            : undefined
      }
      data-phase={phase}
      aria-hidden={phase === 'closing' && kind === 'menu' ? 'true' : undefined}
      inert={phase === 'closing' && kind === 'menu' ? true : undefined}
      onMouseDown={closeFromBackdrop}
      onTransitionEnd={(event) => {
        if (phase === 'closing' && event.target === event.currentTarget) {
          finishClosing()
        }
      }}
    >
      <section
        id={id}
        ref={surfaceRef}
        className={`record-overlay__surface ${className ?? ''}`}
        data-ready={kind === 'modal' || position.ready ? 'true' : 'false'}
        role={surfaceRole ?? (kind === 'menu' ? 'menu' : 'dialog')}
        aria-modal={kind === 'menu' ? undefined : 'true'}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={style}
      >
        {children}
      </section>
    </div>,
    document.body,
  )
}
