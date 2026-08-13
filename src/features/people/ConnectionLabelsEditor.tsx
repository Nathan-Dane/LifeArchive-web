import { useState } from 'react'
import { useTranslate } from '../../i18n'
import { SelectionMenu } from '../../ui/menu'
import { RecordControlIcon } from '../../ui/overlay'
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
  const [custom, setCustom] = useState('')
  const [customOrder, setCustomOrder] = useState<readonly string[]>([])
  const selectedCustomLabels = labels.filter(
    (label) => !(STANDARD_VALUES as readonly string[]).includes(label),
  )
  const visibleCustomLabels = [
    ...customOrder,
    ...selectedCustomLabels.filter((label) => !customOrder.includes(label)),
  ]

  const options = [
    ...STANDARD_CONNECTION_LABELS.map(({ value, message }) => ({
      value,
      label: t(message),
    })),
    ...visibleCustomLabels.map((value) => ({ value, label: value })),
  ]
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
    <section className="person-connections">
      <h3 className="eyebrow">{t('people.connections')}</h3>
      <SelectionMenu
        options={options}
        selected={labels}
        primary={labels[0] ?? null}
        multiple
        allowPrimary
        disableCurrentPrimary
        disabled={disabled}
        menuLabel={t('people.connections')}
        triggerLabel={t(
          labels.length === 0
            ? 'people.connections.choose'
            : 'people.connections.add',
        )}
        assignedClassName="person-connection-picker__assigned"
        menuClassName="record-tag-menu person-connection-menu"
        listClassName="person-connection-picker__list"
        rowClassName={() => 'person-connection-picker__row'}
        renderAssigned={({ label }, primary) => (
          <span className="person-connection-pill">
            {label}
            {primary ? (
              <span className="visually-hidden">
                {t('people.connections.primary')}
              </span>
            ) : null}
          </span>
        )}
        renderOption={({ label }) => (
          <span className="person-connection-picker__name">{label}</span>
        )}
        mainAction={(_option, primary) => ({
          label: t(
            primary
              ? 'people.connections.primary'
              : 'people.connections.makePrimary',
          ),
          accessibleLabel: t(
            primary
              ? 'people.connections.primary'
              : 'people.connections.makePrimary',
          ),
        })}
        footer={
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
        }
        onOpen={() =>
          setCustomOrder((current) => [
            ...current,
            ...selectedCustomLabels.filter((label) => !current.includes(label)),
          ])
        }
        onSelectionChange={onChange}
        onPrimaryChange={makePrimary}
      />
    </section>
  )
}
