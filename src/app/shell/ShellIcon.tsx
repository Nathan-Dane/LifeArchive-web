/**
 * The shell's own small icon set.
 *
 * Drawn here rather than pulled from an icon library or copied from a native
 * symbol set: five glyphs do not justify a dependency, and the native symbol
 * names are Apple's, not portable design tokens. Every glyph is decorative —
 * the control around it always carries the words.
 */

export type ShellIconName =
  | 'navigation'
  | 'details'
  | 'record'
  | 'timeline'
  | 'settings'
  | 'appearance-system'
  | 'appearance-light'
  | 'appearance-dark'
  | 'close'

const PATHS: Record<ShellIconName, React.ReactNode> = {
  navigation: (
    <>
      <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
      <path d="M7.5 3.5v13" />
    </>
  ),
  details: (
    <>
      <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
      <path d="M12.5 3.5v13" />
    </>
  ),
  record: (
    <>
      <rect x="4" y="3.5" width="12" height="13" rx="1.75" />
      <path d="M7 7h6M7 10h6M7 13h4" />
    </>
  ),
  timeline: (
    <>
      <circle cx="10" cy="10" r="6.25" />
      <path d="M10 6.5V10l2.5 1.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="10" cy="10" r="2.25" />
      <path d="M10 3.25v1.5M10 15.25v1.5M3.25 10h1.5M15.25 10h1.5M5.25 5.25l1.05 1.05M13.7 13.7l1.05 1.05M14.75 5.25 13.7 6.3M6.3 13.7l-1.05 1.05" />
    </>
  ),
  'appearance-system': (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 3.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" stroke="none" />
    </>
  ),
  'appearance-light': (
    <>
      <circle cx="10" cy="10" r="3.75" />
      <path d="M10 2.5v1.6M10 15.9v1.6M2.5 10h1.6M15.9 10h1.6M4.7 4.7l1.1 1.1M14.2 14.2l1.1 1.1M15.3 4.7l-1.1 1.1M5.8 14.2l-1.1 1.1" />
    </>
  ),
  'appearance-dark': (
    <path d="M15.5 12.4A6.6 6.6 0 0 1 7.6 4.5a6.6 6.6 0 1 0 7.9 7.9z" />
  ),
  close: <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />,
}

export function ShellIcon({ name }: { readonly name: ShellIconName }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  )
}
