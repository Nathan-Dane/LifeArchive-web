export type EditorIconName =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'inline-code'
  | 'bullet-list'
  | 'ordered-list'
  | 'indent'
  | 'outdent'
  | 'quote'
  | 'divider'
  | 'clear'
  | 'link'

const PATHS: Record<EditorIconName, React.ReactNode> = {
  undo: (
    <>
      <path d="M8 7H4V3" />
      <path d="M4.4 6.6a7 7 0 1 1-.4 6.1" />
    </>
  ),
  redo: (
    <>
      <path d="M12 7h4V3" />
      <path d="M15.6 6.6a7 7 0 1 0 .4 6.1" />
    </>
  ),
  bold: (
    <>
      <path d="M7 4h4.2a3 3 0 0 1 0 6H7z" />
      <path d="M7 10h4.8a3 3 0 0 1 0 6H7z" />
    </>
  ),
  italic: (
    <>
      <path d="M10 4h5M5 16h5M12.5 4l-5 12" />
    </>
  ),
  underline: (
    <>
      <path d="M6 4v5a4 4 0 0 0 8 0V4M5 16h10" />
    </>
  ),
  strikethrough: (
    <>
      <path d="M6 6c.8-1.4 2.1-2 4-2 2.4 0 4 1.2 4 3M6 14c.8 1.3 2.2 2 4.2 2 2.3 0 3.8-1.1 3.8-2.8 0-1.4-.8-2.2-2.4-2.7" />
      <path d="M3 10h14" />
    </>
  ),
  'inline-code': (
    <>
      <path d="M7 6l-4 4 4 4M13 6l4 4-4 4M11.5 4l-3 12" />
    </>
  ),
  'bullet-list': (
    <>
      <circle cx="4" cy="6" r=".8" fill="currentColor" stroke="none" />
      <circle cx="4" cy="10" r=".8" fill="currentColor" stroke="none" />
      <circle cx="4" cy="14" r=".8" fill="currentColor" stroke="none" />
      <path d="M7 6h9M7 10h9M7 14h9" />
    </>
  ),
  'ordered-list': (
    <>
      <path d="M3 5h1v3M3 8h2M3 11.5c.4-.6 2-.5 2 .4 0 .7-2 1.5-2 2.6h2" />
      <path d="M8 6h8M8 10h8M8 14h8" />
    </>
  ),
  indent: (
    <>
      <path d="M3 5h14M8 10h9M8 15h9M3 8l3 2-3 2z" />
    </>
  ),
  outdent: (
    <>
      <path d="M3 5h14M8 10h9M8 15h9M6 8l-3 2 3 2z" />
    </>
  ),
  quote: (
    <>
      <path d="M4 8.5h4v4H4zM12 8.5h4v4h-4z" />
      <path d="M8 8.5c0-2-1-3.5-3-4M16 8.5c0-2-1-3.5-3-4" />
    </>
  ),
  divider: <path d="M3 10h14" />,
  clear: (
    <>
      <path d="M5 15L14 6M7 4h8M11 4L7.5 14M4 16h12" />
    </>
  ),
  link: (
    <>
      <path d="M8.2 12.8l-1 1a3 3 0 0 1-4.2-4.2l2.6-2.7a3 3 0 0 1 4.2 0" />
      <path d="M11.8 7.2l1-1A3 3 0 0 1 17 10.4L14.4 13a3 3 0 0 1-4.2 0" />
      <path d="M7.5 12.5l5-5" />
    </>
  ),
}

export function EditorIcon({ name }: { readonly name: EditorIconName }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  )
}
