import type { SemanticId } from '../../../core/client'
import { semanticName, useLocalisation } from '../../../i18n'
import { RecordSemanticIcon } from '../events/RecordSemanticIcon'
import {
  SEMANTIC_ICON_CATALOG_VERSION,
  SEMANTIC_ICON_CATEGORIES,
} from './semanticCatalog'

export function SemanticIconPicker({
  value,
  onChange,
  disabled = false,
}: {
  readonly value: SemanticId
  readonly onChange: (id: SemanticId) => void
  readonly disabled?: boolean
}) {
  const localisation = useLocalisation()
  const known = SEMANTIC_ICON_CATEGORIES.some(({ icons }) =>
    (icons as readonly string[]).includes(value),
  )

  return (
    <fieldset
      className="semantic-icon-picker"
      disabled={disabled}
      data-catalog-version={SEMANTIC_ICON_CATALOG_VERSION}
    >
      <legend>{localisation.t('record.icon.pickerLabel')}</legend>
      {!known ? (
        <div className="semantic-icon-picker__unknown">
          <RecordSemanticIcon id={value} />
          <span>
            {semanticName(localisation, 'record', 'icon', value).accessibleName}
          </span>
        </div>
      ) : null}
      {SEMANTIC_ICON_CATEGORIES.map((category) => (
        <section
          key={category.id}
          className="semantic-icon-picker__category"
          aria-labelledby={`semantic-icon-category-${category.id}`}
        >
          <h4 id={`semantic-icon-category-${category.id}`}>
            {localisation.t(`record.icon.category.${category.id}`)}
          </h4>
          <div className="semantic-icon-picker__grid">
            {category.icons.map((id) => {
              const name = semanticName(localisation, 'record', 'icon', id)
              return (
                <button
                  key={id}
                  type="button"
                  className="semantic-icon-picker__option"
                  aria-label={name.accessibleName}
                  aria-pressed={value === id}
                  title={name.text}
                  onClick={() => onChange(id)}
                >
                  <RecordSemanticIcon id={id} decorative />
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </fieldset>
  )
}
