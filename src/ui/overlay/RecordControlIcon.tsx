export type RecordControlIconName =
  | 'add'
  | 'archive'
  | 'back'
  | 'calendar'
  | 'check'
  | 'close'
  | 'expand'
  | 'manage'
  | 'media'
  | 'more'
  | 'next'
  | 'none'
  | 'restore'
  | 'search'
  | 'up'
  | 'down'

/** Small non-semantic controls shared by popups and compact actions. */
export function RecordControlIcon({
  name,
}: {
  readonly name: RecordControlIconName
}) {
  return (
    <svg
      className="record-control-icon"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === 'add' ? <path d="M10 4v12M4 10h12" /> : null}
      {name === 'archive' ? (
        <>
          <path d="M4.5 6.5h11M6 6.5l.7 9h6.6l.7-9" />
          <path d="M7.5 4.5h5" />
        </>
      ) : null}
      {name === 'back' ? <path d="m11.5 4.5-5.5 5.5 5.5 5.5M6 10h8" /> : null}
      {name === 'calendar' ? (
        <>
          <rect x="3.5" y="4.5" width="13" height="12" rx="2" />
          <path d="M6.5 3.5v3M13.5 3.5v3M3.5 8h13" />
        </>
      ) : null}
      {name === 'check' ? <path d="m4.5 10.5 3.4 3.4 7.6-7.8" /> : null}
      {name === 'close' ? <path d="m5 5 10 10M15 5 5 15" /> : null}
      {name === 'expand' ? <path d="m5 7.5 5 5 5-5" /> : null}
      {name === 'manage' ? (
        <>
          <rect x="4" y="4" width="3" height="3" rx="0.5" />
          <rect x="4" y="8.5" width="3" height="3" rx="0.5" />
          <rect x="4" y="13" width="3" height="3" rx="0.5" />
          <path d="M9.5 5.5h6M9.5 10h6M9.5 14.5h6" />
        </>
      ) : null}
      {name === 'next' ? <path d="m7.5 4.5 5.5 5.5-5.5 5.5" /> : null}
      {name === 'media' ? (
        <>
          <rect x="3.5" y="4.5" width="13" height="11" rx="1.5" />
          <circle cx="7.25" cy="8" r="1.1" />
          <path d="m5 14 3.4-3.5 2.3 2.1 1.7-1.7L15 14" />
        </>
      ) : null}
      {name === 'more' ? (
        <>
          <circle cx="5" cy="10" r="1" fill="currentColor" stroke="none" />
          <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
        </>
      ) : null}
      {name === 'up' ? <path d="m5 12.5 5-5 5 5" /> : null}
      {name === 'down' ? <path d="m5 7.5 5 5 5-5" /> : null}
      {name === 'none' ? (
        <>
          <circle cx="10" cy="10" r="6.5" />
          <path d="m5.4 5.4 9.2 9.2" />
        </>
      ) : null}
      {name === 'restore' ? (
        <>
          <path d="M5.5 8a5.5 5.5 0 1 1-.5 4" />
          <path d="M5.5 4.5V8H9" />
        </>
      ) : null}
      {name === 'search' ? (
        <>
          <circle cx="8.75" cy="8.75" r="4.75" />
          <path d="m12.25 12.25 3.5 3.5" />
        </>
      ) : null}
    </svg>
  )
}
