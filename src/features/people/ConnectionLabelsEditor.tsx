import { useId, useRef, useState } from 'react'
import { useTranslate } from '../../i18n'
import { useMenuRovingFocus } from '../../ui/menu'
import { RecordControlIcon, RecordOverlay } from '../../ui/overlay'
import { STANDARD_CONNECTION_LABELS } from './connectionLabels'

const STANDARD_VALUES = STANDARD_CONNECTION_LABELS.map(({ value }) => value)

/** Connection assignment deliberately shares Record's tag-picker surface. */
export function ConnectionLabelsEditor({
  labels,
  disabled = false,
  onChange,
}: {
  readonly labels: readonly string[]
  readonly disabled?: boolean
  readonly onChange: (labels: readonly string[]) => void
}) {
  const t = useTranslate()
  const menuId = useId()
  const labelId = useId()
  const assigned = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const [customOrder, setCustomOrder] = useState<readonly string[]>([])
  const [keyboardNavigation, setKeyboardNavigation] = useState(false)

  const options = [
    ...STANDARD_CONNECTION_LABELS.map(({ value, message }) => ({
      value,
      label: t(message),
    })),
    ...customOrder.map((value) => ({ value, label: value })),
  ]

  const focusMenuStart = () =>
    globalThis.queueMicrotask(() => menuFocus.focus(0))
  const openMenu = (trigger: HTMLButtonElement, focusFirst: boolean) => {
    opener.current = trigger
    setCustomOrder((current) => {
      const customLabels = labels.filter(
        (label) => !(STANDARD_VALUES as readonly string[]).includes(label),
      )
      return [
        ...current,
        ...customLabels.filter((label) => !current.includes(label)),
      ]
    })
    setOpen(true)
    setKeyboardNavigation(focusFirst)
    if (focusFirst) focusMenuStart()
  }
  const closeMenu = () => {
    setOpen(false)
    const target = opener.current
    globalThis.queueMicrotask(() => target?.focus())
  }
  const menuFocus = useMenuRovingFocus({
    wrap: true,
    onEscape: closeMenu,
    onNavigate: () => setKeyboardNavigation(true),
  })
  const toggle = (label: string) => {
    onChange(
      labels.includes(label)
        ? labels.filter((value) => value !== label)
        : [...labels, label],
    )
  }
  const makePrimary = (label: string) => {
    onChange([label, ...labels.filter((value) => value !== label)])
  }
  const addCustom = () => {
    const label = custom.trim()
    if (!label || labels.includes(label)) return
    onChange([...labels, label])
    setCustomOrder((current) =>
      current.includes(label) ? current : [...current, label],
    )
    setCustom('')
  }

  return (
    <section
      className="person-connections record-tag-picker"
      aria-labelledby={labelId}
    >
      <h3 id={labelId} className="eyebrow">
        {t('people.connections')}
      </h3>
      <div
        ref={assigned}
        className="record-tag-picker__assigned person-connection-picker__assigned"
      >
        {labels.map((label, index) => (
          <button
            key={label}
            type="button"
            className="record-tag-picker__assigned-trigger"
            disabled={disabled}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={(event) =>
              openMenu(event.currentTarget, event.detail === 0)
            }
          >
            <span className="person-connection-pill">
              {label}
              {index === 0 ? (
                <span className="visually-hidden">
                  {t('people.connections.primary')}
                </span>
              ) : null}
            </span>
          </button>
        ))}
        <button
          type="button"
          className="record-tag-picker__trigger"
          disabled={disabled}
          aria-label={t(
            labels.length === 0
              ? 'people.connections.choose'
              : 'people.connections.add',
          )}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={(event) => openMenu(event.currentTarget, event.detail === 0)}
        >
          <RecordControlIcon name="add" />
        </button>
      </div>
      <RecordOverlay
        id={menuId}
        open={open}
        kind="menu"
        labelledBy={labelId}
        anchorRef={assigned}
        onClose={closeMenu}
        className="record-menu record-tag-menu person-connection-menu"
      >
        <div
          className="record-menu__items record-tag-picker__list person-connection-picker__list"
          data-keyboard-navigation={keyboardNavigation}
          onKeyDown={menuFocus.onKeyDown}
          onPointerMove={() => setKeyboardNavigation(false)}
        >
          {options.map((option, index) => {
            const selected = labels.includes(option.value)
            const primary = labels[0] === option.value
            return (
              <div
                key={option.value}
                className="record-tag-picker__row person-connection-picker__row"
                data-selected={selected || undefined}
              >
                <button
                  ref={menuFocus.itemRef(index)}
                  type="button"
                  className="record-tag-picker__select"
                  role="menuitemcheckbox"
                  aria-checked={selected}
                  onPointerDown={() => setKeyboardNavigation(false)}
                  onClick={() => toggle(option.value)}
                >
                  <span className="person-connection-picker__name">
                    {option.label}
                  </span>
                  <span className="record-tag-picker__check" aria-hidden="true">
                    {selected ? <RecordControlIcon name="check" /> : null}
                  </span>
                </button>
                {selected ? (
                  <button
                    type="button"
                    className="record-tag-picker__main"
                    role="menuitem"
                    aria-label={t(
                      primary
                        ? 'people.connections.primary'
                        : 'people.connections.makePrimary',
                    )}
                    aria-pressed={primary}
                    disabled={primary}
                    onPointerDown={() => setKeyboardNavigation(false)}
                    onClick={() => makePrimary(option.value)}
                  >
                    {primary
                      ? t('people.connections.primary')
                      : t('people.connections.makePrimary')}
                  </button>
                ) : null}
              </div>
            )
          })}
          <form
            className="person-connection-picker__custom"
            role="none"
            onSubmit={(event) => {
              event.preventDefault()
              addCustom()
            }}
          >
            <label>
              <span className="visually-hidden">
                {t('people.connections.custom')}
              </span>
              <input
                value={custom}
                placeholder={t('people.connections.custom')}
                onChange={(event) => setCustom(event.currentTarget.value)}
              />
            </label>
            <button type="submit" disabled={!/\S/u.test(custom)}>
              <RecordControlIcon name="add" />
              <span>{t('people.connections.custom.add')}</span>
            </button>
          </form>
        </div>
      </RecordOverlay>
    </section>
  )
}
