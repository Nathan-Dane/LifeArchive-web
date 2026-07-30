/**
 * The two chevrons on the previous and next controls.
 *
 * Drawn here rather than taken from an icon set for the same reason the shell
 * draws its own: two glyphs do not justify a dependency, and a native symbol
 * name is a platform's vocabulary rather than a portable token. Both are
 * decorative — the control around them carries the words a reader hears.
 *
 * They point along the inline axis, so a right-to-left reading order turns
 * them with the text rather than leaving "next" pointing backwards.
 */

export type StepIconName = 'previous' | 'next'

const PATHS: Record<StepIconName, string> = {
  previous: 'M12 4.5L6.5 10l5.5 5.5',
  next: 'M8 4.5l5.5 5.5L8 15.5',
}

export function StepIcon({ name }: { readonly name: StepIconName }) {
  return (
    <svg
      className="record-navigation__chevron"
      aria-hidden="true"
      focusable="false"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
