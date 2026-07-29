import { useId, type ReactNode } from 'react'

export function SettingsContentPage({
  title,
  detail,
  children,
}: {
  readonly title: string
  readonly detail?: string
  readonly children: ReactNode
}) {
  return (
    <div className="settings-page">
      <header className="settings-page__heading">
        <h1 className="display-large">{title}</h1>
        {detail ? <p>{detail}</p> : null}
      </header>
      {children}
    </div>
  )
}

export function SettingsSection({
  title,
  children,
}: {
  readonly title: string
  readonly children: ReactNode
}) {
  return (
    <section className="settings-section">
      <h2 className="eyebrow">{title}</h2>
      <div className="settings-card">{children}</div>
    </section>
  )
}

export function SettingsSelectRow<Value extends string>({
  label,
  detail,
  unavailable,
  value,
  options,
  disabled = false,
  onChange,
}: {
  readonly label: string
  readonly detail?: string
  readonly unavailable?: string
  readonly value: Value
  readonly options: readonly {
    readonly value: Value
    readonly label: string
  }[]
  readonly disabled?: boolean
  readonly onChange: (value: Value) => void
}) {
  const id = useId()
  const detailId = useId()
  const unavailableId = useId()
  const describedBy = [
    detail ? detailId : null,
    unavailable ? unavailableId : null,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div className="settings-row" data-disabled={disabled || undefined}>
      <div className="settings-row__copy">
        <label htmlFor={id}>{label}</label>
        {detail ? <span id={detailId}>{detail}</span> : null}
        {unavailable ? (
          <span id={unavailableId} className="settings-row__unavailable">
            {unavailable}
          </span>
        ) : null}
      </div>
      <select
        id={id}
        className="settings-select"
        value={value}
        disabled={disabled}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.currentTarget.value as Value)}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function SettingsToggleRow({
  label,
  detail,
  unavailable,
  checked,
  disabled = false,
  onChange,
}: {
  readonly label: string
  readonly detail: string
  readonly unavailable?: string
  readonly checked: boolean
  readonly disabled?: boolean
  readonly onChange: (checked: boolean) => void
}) {
  const detailId = useId()
  const unavailableId = useId()
  const describedBy = unavailable ? `${detailId} ${unavailableId}` : detailId
  return (
    <label
      className="settings-row settings-toggle-row"
      data-disabled={disabled || undefined}
    >
      <span className="settings-row__copy">
        <strong>{label}</strong>
        <span id={detailId}>{detail}</span>
        {unavailable ? (
          <span id={unavailableId} className="settings-row__unavailable">
            {unavailable}
          </span>
        ) : null}
      </span>
      <span className="settings-switch">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        <span aria-hidden="true" />
      </span>
    </label>
  )
}

export function SettingsDisabledRow({
  label,
  detail,
  unavailable,
}: {
  readonly label: string
  readonly detail: string
  readonly unavailable: string
}) {
  return (
    <div className="settings-row settings-row--disabled" aria-disabled="true">
      <div className="settings-row__copy">
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <span className="settings-unavailable">{unavailable}</span>
    </div>
  )
}
