import {
  useCallback,
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

interface AnchoredPosition {
  readonly left: number
  readonly top: number
  readonly maxWidth: number
  readonly maxHeight: number
  readonly ready: boolean
}

const INITIAL_POSITION: AnchoredPosition = {
  left: 0,
  top: 0,
  maxWidth: 0,
  maxHeight: 0,
  ready: false,
}

export interface RecordOverlayProps {
  readonly id?: string
  readonly open: boolean
  readonly kind: 'anchored' | 'modal'
  readonly labelledBy: string
  readonly onClose: () => void
  readonly children: ReactNode
  readonly anchorRef?: RefObject<HTMLElement | null>
  readonly initialFocusRef?: RefObject<HTMLElement | null>
  readonly className?: string
}

/**
 * One blocking layer for Record popups and task modals.
 *
 * Anchored surfaces begin centred over their activating control, then clamp
 * inward to the tokenised viewport gutter. The same layer owns dismissal,
 * focus trapping, focus restoration, viewport collision, and the stronger
 * backdrop so individual pickers cannot drift into separate behaviours.
 */
export function RecordOverlay({
  id,
  open,
  kind,
  labelledBy,
  onClose,
  children,
  anchorRef,
  initialFocusRef,
  className,
}: RecordOverlayProps) {
  const surfaceRef = useRef<HTMLElement>(null)
  const [position, setPosition] = useState<AnchoredPosition>(INITIAL_POSITION)

  useFocusTrap(surfaceRef, {
    active: open,
    onEscape: onClose,
    initialFocusRef,
    returnFocusRef: anchorRef,
  })

  const updatePosition = useCallback(() => {
    if (!open || kind !== 'anchored') return
    const anchor = anchorRef?.current
    const surface = surfaceRef.current
    if (!anchor?.isConnected || !surface) {
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
    const surfaceBounds = surface.getBoundingClientRect()
    const width = Math.min(surfaceBounds.width, maxWidth)
    const height = Math.min(surfaceBounds.height, maxHeight)
    const minimumLeft = viewportLeft + gutter
    const minimumTop = viewportTop + gutter
    const maximumLeft = viewportLeft + viewportWidth - gutter - width
    const maximumTop = viewportTop + viewportHeight - gutter - height
    const idealLeft =
      anchorBounds.left + anchorBounds.width / 2 - surfaceBounds.width / 2
    const idealTop =
      anchorBounds.top + anchorBounds.height / 2 - surfaceBounds.height / 2

    setPosition((current) => {
      /*
       * Opening establishes the popup's location. Changes inside the owning
       * control (for example, tags wrapping beside its add button) must not
       * drag an already-open dialog around the viewport. Later observations
       * only clamp that established location if the viewport itself can no
       * longer contain it.
       */
      const left = Math.min(
        Math.max(current.ready ? current.left : idealLeft, minimumLeft),
        maximumLeft,
      )
      const top = Math.min(
        Math.max(current.ready ? current.top : idealTop, minimumTop),
        maximumTop,
      )
      const next = {
        left,
        top,
        maxWidth,
        maxHeight,
        ready: true,
      }
      return Object.entries(next).every(
        ([key, value]) => current[key as keyof AnchoredPosition] === value,
      )
        ? current
        : next
    })
  }, [anchorRef, kind, onClose, open])

  useLayoutEffect(() => {
    if (!open || kind !== 'anchored') return
    updatePosition()
    const surface = surfaceRef.current
    const anchor = anchorRef?.current
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updatePosition)
    if (surface) resizeObserver?.observe(surface)
    if (anchor) resizeObserver?.observe(anchor)
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
  }, [anchorRef, kind, open, updatePosition])

  if (!open) return null

  const style =
    kind === 'anchored'
      ? ({
          '--record-overlay-left': `${position.left}px`,
          '--record-overlay-top': `${position.top}px`,
          '--record-overlay-max-width': `${position.maxWidth}px`,
          '--record-overlay-max-height': `${position.maxHeight}px`,
        } as CSSProperties)
      : undefined

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  return createPortal(
    <div
      className="record-overlay"
      data-kind={kind}
      onMouseDown={closeFromBackdrop}
    >
      <section
        id={id}
        ref={surfaceRef}
        className={`record-overlay__surface ${className ?? ''}`}
        data-ready={kind === 'modal' || position.ready ? 'true' : 'false'}
        role="dialog"
        aria-modal="true"
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
