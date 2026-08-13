import type {
  PersonDate,
  PersonDatePrecision,
  PersonOtherName,
  PersonReference,
} from '../../core/client'
import { useLocalisation } from '../../i18n'
import { RecordControlIcon } from '../../ui/overlay'
import { PeopleSelect } from './PeopleSelect'

const OTHER_NAME_KINDS = [
  'nickname',
  'formerName',
  'birthName',
  'alternateSpelling',
  'anotherScript',
  'other',
] as const

const REFERENCE_KINDS = [
  'personalWebsite',
  'socialProfile',
  'professionalProfile',
  'memorial',
  'other',
] as const

export function OtherNameRow({
  index,
  name,
  disabled,
  onChange,
  onRemove,
}: {
  readonly index: number
  readonly name: PersonOtherName
  readonly disabled: boolean
  readonly onChange: (value: PersonOtherName) => void
  readonly onRemove: () => void
}) {
  const t = useLocalisation().t
  return (
    <div className="person-repeat__row">
      <PeopleSelect
        ariaLabel={t('people.otherNames.kindLabel', { number: index + 1 })}
        value={name.kindId}
        disabled={disabled}
        options={OTHER_NAME_KINDS.map((kind) => ({
          value: kind,
          label: t(`people.otherNames.kind.${kind}`),
        }))}
        onChange={(kindId) => onChange({ ...name, kindId })}
      />
      <input
        aria-label={t('people.otherNames.valueLabel', { number: index + 1 })}
        value={name.value}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...name, value: event.currentTarget.value })
        }
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={t('people.otherNames.removeNumbered', {
          number: index + 1,
        })}
        onClick={onRemove}
      >
        <RecordControlIcon name="close" />
      </button>
    </div>
  )
}

export function ReferenceRow({
  index,
  reference,
  disabled,
  onChange,
  onRemove,
}: {
  readonly index: number
  readonly reference: PersonReference
  readonly disabled: boolean
  readonly onChange: (value: PersonReference) => void
  readonly onRemove: () => void
}) {
  const t = useLocalisation().t
  return (
    <div className="person-reference">
      <PeopleSelect
        ariaLabel={t('people.references.kindLabel', { number: index + 1 })}
        value={reference.kindId}
        disabled={disabled}
        options={REFERENCE_KINDS.map((kind) => ({
          value: kind,
          label: t(`people.references.kind.${kind}`),
        }))}
        onChange={(kindId) => onChange({ ...reference, kindId })}
      />
      <input
        aria-label={t('people.references.labelNumbered', {
          number: index + 1,
        })}
        value={reference.label ?? ''}
        placeholder={t('people.references.label')}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...reference, label: event.currentTarget.value || null })
        }
      />
      <input
        type="url"
        aria-label={t('people.references.urlNumbered', { number: index + 1 })}
        value={reference.url}
        placeholder={t('people.references.url')}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...reference, url: event.currentTarget.value })
        }
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={t('people.references.removeNumbered', {
          number: index + 1,
        })}
        onClick={onRemove}
      >
        <RecordControlIcon name="close" />
      </button>
    </div>
  )
}

export function PartialDateEditor({
  label,
  value,
  disabled,
  onChange,
}: {
  readonly label: string
  readonly value: PersonDate | null
  readonly disabled: boolean
  readonly onChange: (value: PersonDate | null) => void
}) {
  const t = useLocalisation().t
  const precision = value?.precision ?? 'year'
  const updatePrecision = (next: PersonDatePrecision) => {
    const year = value?.year ?? new Date().getFullYear()
    onChange({
      precision: next,
      year,
      month: next === 'year' ? null : (value?.month ?? null),
      day: next === 'day' ? (value?.day ?? null) : null,
      approximate: value?.approximate ?? false,
    })
  }
  return (
    <fieldset className="person-date">
      <legend>{label}</legend>
      <label>
        <input
          type="checkbox"
          checked={value !== null}
          disabled={disabled}
          onChange={(event) =>
            event.currentTarget.checked
              ? updatePrecision('year')
              : onChange(null)
          }
        />
        <span>{value ? label : t('people.date.none')}</span>
      </label>
      {value ? (
        <div className="person-date__fields">
          <div className="person-date__field">
            <span>{t('people.date.precision')}</span>
            <PeopleSelect
              value={precision}
              ariaLabel={t('people.date.precision')}
              disabled={disabled}
              options={[
                {
                  value: 'day',
                  label: t('people.date.precision.fullDate'),
                },
                {
                  value: 'month',
                  label: t('people.date.precision.monthYear'),
                },
                {
                  value: 'year',
                  label: t('people.date.precision.yearOnly'),
                },
              ]}
              onChange={(next) => updatePrecision(next as PersonDatePrecision)}
            />
          </div>
          {precision === 'day' ? (
            <label>
              <span>{t('people.date.dayField')}</span>
              <input
                type="number"
                min="1"
                max="31"
                value={value.day ?? ''}
                disabled={disabled}
                onChange={(event) =>
                  onChange({
                    ...value,
                    day: event.currentTarget.valueAsNumber || null,
                  })
                }
              />
            </label>
          ) : null}
          {precision !== 'year' ? (
            <label>
              <span>{t('people.date.monthField')}</span>
              <input
                type="number"
                min="1"
                max="12"
                value={value.month ?? ''}
                disabled={disabled}
                onChange={(event) =>
                  onChange({
                    ...value,
                    month: event.currentTarget.valueAsNumber || null,
                  })
                }
              />
            </label>
          ) : null}
          <label>
            <span>{t('people.date.yearField')}</span>
            <input
              type="number"
              min="1"
              max="9999"
              value={value.year}
              disabled={disabled}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) =>
                onChange({
                  ...value,
                  year: Number.isNaN(event.currentTarget.valueAsNumber)
                    ? value.year
                    : event.currentTarget.valueAsNumber,
                })
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={value.approximate}
              disabled={disabled}
              onChange={(event) =>
                onChange({ ...value, approximate: event.currentTarget.checked })
              }
            />
            <span>{t('people.date.approximate')}</span>
          </label>
        </div>
      ) : null}
    </fieldset>
  )
}
