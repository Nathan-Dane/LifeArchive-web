import { useId, useRef, useState } from 'react'
import { useTranslate } from '../../i18n'
import { RecordControlIcon, RecordOverlay } from '../../ui/overlay'

const STANDARD = [
  ['Friend', 'people.connections.friend'],
  ['Family', 'people.connections.family'],
  ['Colleague', 'people.connections.colleague'],
  ['Partner', 'people.connections.partner'],
  ['Former classmate', 'people.connections.formerClassmate'],
  ['Family friend', 'people.connections.familyFriend'],
  ['Doctor', 'people.connections.doctor'],
  ['Public figure', 'people.connections.publicFigure'],
  ['Never met personally', 'people.connections.neverMetPersonally'],
] as const
const STANDARD_VALUES = STANDARD.map(([value]) => value)

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
  const popupId = useId()
  const labelId = useId()
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const [customOrder, setCustomOrder] = useState<readonly string[]>([])

  const openFrom = (element: HTMLButtonElement) => {
    anchor.current = element
    if (!open) {
      setCustomOrder(
        labels.filter(
          (label) => !(STANDARD_VALUES as readonly string[]).includes(label),
        ),
      )
    }
    setOpen(true)
  }

  const toggle = (label: string) => {
    onChange(
      labels.includes(label)
        ? labels.filter((value) => value !== label)
        : [...labels, label],
    )
  }
  const primary = (label: string) => {
    onChange([label, ...labels.filter((value) => value !== label)])
  }
  const addCustom = () => {
    if (!/\S/u.test(custom) || labels.includes(custom)) return
    onChange([...labels, custom])
    setCustomOrder((current) =>
      current.includes(custom) ? current : [...current, custom],
    )
    setCustom('')
  }

  return (
    <section className="person-connections" aria-labelledby={labelId}>
      <h3 id={labelId} className="eyebrow">
        {t('people.connections')}
      </h3>
      {labels.length === 0 ? (
        <button
          ref={anchor}
          type="button"
          className="person-connections__add"
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={(event) => openFrom(event.currentTarget)}
        >
          {t('people.connections.add')}
        </button>
      ) : (
        <div className="person-connections__labels">
          {labels.map((label, index) => (
            <button
              key={label}
              ref={index === 0 ? anchor : undefined}
              type="button"
              disabled={disabled}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={(event) => {
                openFrom(event.currentTarget)
              }}
            >
              {label}
              {index === 0 ? (
                <span className="visually-hidden">
                  {t('people.connections.primary')}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
      <RecordOverlay
        id={popupId}
        open={open}
        kind="anchored"
        labelledBy={labelId}
        anchorRef={anchor}
        onClose={() => setOpen(false)}
        className="person-connections__popup"
      >
        <div className="person-connections__options">
          {STANDARD.map(([label, message]) => (
            <div key={label} className="person-connections__option">
              <button
                type="button"
                role="checkbox"
                aria-checked={labels.includes(label)}
                onClick={() => toggle(label)}
              >
                <span aria-hidden="true">
                  {labels.includes(label) ? (
                    <RecordControlIcon name="check" />
                  ) : null}
                </span>
                {t(message)}
              </button>
              {labels.includes(label) && labels[0] !== label ? (
                <button type="button" onClick={() => primary(label)}>
                  {t('people.connections.makePrimary')}
                </button>
              ) : labels[0] === label ? (
                <span>{t('people.connections.primary')}</span>
              ) : null}
            </div>
          ))}
          {customOrder.map((label) => (
            <div key={label} className="person-connections__option">
              <button
                type="button"
                role="checkbox"
                aria-checked={labels.includes(label)}
                onClick={() => toggle(label)}
              >
                <span aria-hidden="true">
                  {labels.includes(label) ? (
                    <RecordControlIcon name="check" />
                  ) : null}
                </span>
                {label}
              </button>
              {labels.includes(label) && labels[0] !== label ? (
                <button type="button" onClick={() => primary(label)}>
                  {t('people.connections.makePrimary')}
                </button>
              ) : labels[0] === label ? (
                <span>{t('people.connections.primary')}</span>
              ) : null}
            </div>
          ))}
          <div className="person-connections__custom">
            <label>
              <span className="visually-hidden">
                {t('people.connections.custom')}
              </span>
              <input
                value={custom}
                placeholder={t('people.connections.custom')}
                onChange={(event) => setCustom(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addCustom()
                  }
                }}
              />
            </label>
            <button
              type="button"
              disabled={!/\S/u.test(custom)}
              onClick={addCustom}
            >
              <RecordControlIcon name="add" />
              <span>{t('people.connections.custom.add')}</span>
            </button>
          </div>
        </div>
      </RecordOverlay>
    </section>
  )
}
