export interface StatusAction {
  readonly label: string
  readonly run: () => void
}

export interface StatusScreenProps {
  readonly title: string
  readonly detail?: string
  readonly busy?: boolean
  readonly action?: StatusAction
  readonly secondaryAction?: StatusAction
}

/**
 * The calm screen an application state shows when it cannot show a feature.
 *
 * Every string reaching this component is already localised: it takes copy,
 * not keys, so no phrase can be assembled here out of translated fragments.
 */
export function StatusScreen({
  title,
  detail,
  busy = false,
  action,
  secondaryAction,
}: StatusScreenProps) {
  return (
    <main id="main-content" className="workspace__content" tabIndex={-1}>
      <section
        className="status-screen"
        aria-labelledby="app-state-title"
        aria-busy={busy || undefined}
      >
        <h1 id="app-state-title" className="display-large">
          {title}
        </h1>
        {detail ? <p className="status-screen__detail">{detail}</p> : null}
        {(action ?? secondaryAction) ? (
          <div className="status-screen__actions">
            {action ? (
              <button
                type="button"
                className="button button--primary"
                onClick={action.run}
              >
                {action.label}
              </button>
            ) : null}
            {secondaryAction ? (
              <button
                type="button"
                className="button"
                onClick={secondaryAction.run}
              >
                {secondaryAction.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  )
}
