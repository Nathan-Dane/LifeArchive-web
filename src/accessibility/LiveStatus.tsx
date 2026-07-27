import type { ReactNode } from 'react'

export interface LiveStatusProps {
  readonly children: ReactNode
  /** Make the status visible when it is useful to sighted readers too. */
  readonly visible?: boolean
}

/**
 * A quiet, atomic status announcement.
 *
 * Callers update it only for meaningful operation transitions. It deliberately
 * uses polite `status` semantics rather than an assertive alert, so typing and
 * each autosave keystroke never interrupt a screen reader.
 */
export function LiveStatus({ children, visible = false }: LiveStatusProps) {
  return (
    <div
      className={visible ? 'live-status' : 'visually-hidden'}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {children}
    </div>
  )
}
