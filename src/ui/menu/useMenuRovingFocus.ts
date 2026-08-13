import { useCallback, useRef, type KeyboardEvent } from 'react'

type MenuItem = HTMLElement

export interface MenuRovingFocusOptions {
  readonly onEscape?: () => void
  readonly stopEscapePropagation?: boolean
  readonly wrap?: boolean
  readonly onNavigate?: () => void
}

/** Shared Arrow/Home/End focus movement for application menu items. */
export function useMenuRovingFocus({
  onEscape,
  stopEscapePropagation = false,
  wrap = false,
  onNavigate,
}: MenuRovingFocusOptions = {}) {
  const items = useRef<(MenuItem | null)[]>([])

  const candidates = useCallback(
    () => items.current.filter((item): item is MenuItem => item !== null),
    [],
  )

  const itemRef = useCallback(
    (index: number) => (element: MenuItem | null) => {
      items.current[index] = element
    },
    [],
  )

  const focus = useCallback(
    (index: number) => {
      const available = candidates()
      if (available.length === 0) return
      const target = wrap
        ? (index + available.length) % available.length
        : Math.max(0, Math.min(index, available.length - 1))
      available[target]?.focus()
    },
    [candidates, wrap],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault()
        if (stopEscapePropagation) event.stopPropagation()
        onEscape()
        return
      }

      const available = candidates()
      const current = available.indexOf(document.activeElement as MenuItem)
      if (current < 0) return

      let target: number
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        target = current + 1
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        target = current - 1
      } else if (event.key === 'Home') {
        target = 0
      } else if (event.key === 'End') {
        target = available.length - 1
      } else {
        return
      }

      event.preventDefault()
      onNavigate?.()
      focus(target)
    },
    [candidates, focus, onEscape, onNavigate, stopEscapePropagation],
  )

  return { itemRef, focus, onKeyDown }
}
