import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableChildren(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => {
      const style = globalThis.getComputedStyle(element)
      return (
        !element.hidden &&
        !element.matches(':disabled') &&
        !element.closest('fieldset[disabled]') &&
        element.getAttribute('aria-hidden') !== 'true' &&
        !element.closest('[aria-hidden="true"]') &&
        !element.closest('[inert]') &&
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      )
    },
  )
}

export interface FocusTrapOptions {
  readonly active: boolean
  readonly onEscape: () => void
  readonly restoreFocus?: boolean
  /** A preferred initial control inside the surface. */
  readonly initialFocusRef?: RefObject<HTMLElement | null>
  /**
   * An explicit opener for surfaces whose activation hides the focused
   * control before layout effects run.
   */
  readonly returnFocusRef?: RefObject<HTMLElement | null>
}

/**
 * Gives a modal surface one keyboard boundary.
 *
 * The opener is captured when the surface activates, focus enters the first
 * control, Tab wraps in both directions, Escape closes, and cleanup restores
 * the opener. The hook contains no drawer or dialog presentation policy, so
 * the same behaviour can serve later confirmation dialogs.
 */
export function useFocusTrap(
  container: RefObject<HTMLElement | null>,
  {
    active,
    onEscape,
    restoreFocus = true,
    initialFocusRef,
    returnFocusRef,
  }: FocusTrapOptions,
): void {
  const returnFocus = useRef<HTMLElement | null>(null)
  const onEscapeRef = useRef(onEscape)
  useEffect(() => {
    onEscapeRef.current = onEscape
  }, [onEscape])

  useLayoutEffect(() => {
    if (!active) return
    const surface = container.current
    if (!surface) return
    returnFocus.current =
      returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null)
    focusTrapStack.push(surface)

    const moveInside = () => {
      const target =
        (initialFocusRef?.current &&
        surface.contains(initialFocusRef.current) &&
        focusableChildren(surface).includes(initialFocusRef.current)
          ? initialFocusRef.current
          : null) ??
        focusableChildren(surface)[0] ??
        surface
      target.focus()
    }

    moveInside()

    const onKeyDown = (event: KeyboardEvent) => {
      if (focusTrapStack.at(-1) !== surface) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onEscapeRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = focusableChildren(surface)
      if (focusable.length === 0) {
        event.preventDefault()
        surface.focus()
        return
      }

      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const keepFocusInside = (event: FocusEvent) => {
      if (focusTrapStack.at(-1) !== surface) return
      if (event.target instanceof Node && !surface.contains(event.target)) {
        moveInside()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', keepFocusInside)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', keepFocusInside)
      const stackIndex = focusTrapStack.lastIndexOf(surface)
      if (stackIndex >= 0) focusTrapStack.splice(stackIndex, 1)
      const focusTarget = returnFocus.current
      if (restoreFocus && focusTarget) {
        queueMicrotask(() => focusTarget.focus())
      }
      returnFocus.current = null
    }
  }, [active, container, initialFocusRef, restoreFocus, returnFocusRef])
}

/**
 * Drawers and portal-based task surfaces may nest. Only the most recently
 * activated surface owns document-level focus containment; when it closes,
 * the previous surface becomes the boundary again.
 */
const focusTrapStack: HTMLElement[] = []

/** Tracks a CSS media condition without making rendering depend on a width guess. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () =>
      typeof globalThis.matchMedia === 'function' &&
      globalThis.matchMedia(query).matches,
  )
  useEffect(() => {
    const media = globalThis.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query, setMatches])
  return matches
}
