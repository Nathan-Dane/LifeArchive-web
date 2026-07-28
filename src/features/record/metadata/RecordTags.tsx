import type { SemanticId, StructuredTags } from '../../../core/client'
import { semanticName, useLocalisation } from '../../../i18n'
import {
  PREDEFINED_TAG_IDS,
  MATERIAL_UI_GLYPHS,
  addTag,
  chooseDisplayTag,
  removeTag,
  tagPaletteFor,
} from './semanticCatalog'

export function RecordTagBadge({
  id,
  display = false,
}: {
  readonly id: SemanticId
  readonly display?: boolean
}) {
  const localisation = useLocalisation()
  const name = semanticName(localisation, 'record', 'tag', id)
  return (
    <span
      className={`record-tag record-tag--${tagPaletteFor(id)}`}
      data-semantic-tag-id={id}
      data-display-tag={display || undefined}
      aria-label={
        display
          ? localisation.t('record.tag.mainLabel', {
              name: name.accessibleName,
            })
          : name.accessibleName
      }
    >
      <span>{name.text}</span>
      {display ? (
        <span className="material-symbols-rounded record-tag__star" aria-hidden>
          {MATERIAL_UI_GLYPHS.main}
        </span>
      ) : null}
    </span>
  )
}

export function RecordTagRibbon({ tags }: { readonly tags: StructuredTags }) {
  if (tags.ordered.length === 0) return null
  const display = tags.display
  const ordered = [
    ...tags.ordered.filter((id) => id !== display),
    ...(display ? [display] : []),
  ]
  return (
    <div className="record-tag-ribbon">
      {ordered.map((id) => (
        <RecordTagBadge key={id} id={id} display={id === display} />
      ))}
    </div>
  )
}

export function RecordTagPicker({
  tags,
  onChange,
  disabled = false,
}: {
  readonly tags: StructuredTags
  readonly onChange: (tags: StructuredTags) => void
  readonly disabled?: boolean
}) {
  const localisation = useLocalisation()
  const unknownSelected = tags.ordered.filter(
    (id) => !(PREDEFINED_TAG_IDS as readonly string[]).includes(id),
  )
  const visibleIds = [...PREDEFINED_TAG_IDS, ...unknownSelected]

  return (
    <fieldset className="record-tag-picker" disabled={disabled}>
      <legend>{localisation.t('record.tag.pickerLabel')}</legend>
      <RecordTagRibbon tags={tags} />
      <div className="record-tag-picker__list">
        {visibleIds.map((id) => {
          const selected = tags.ordered.includes(id)
          const display = tags.display === id
          const name = semanticName(localisation, 'record', 'tag', id)
          return (
            <div
              key={id}
              className={`record-tag-picker__row record-tag-picker__row--${tagPaletteFor(id)}`}
              data-semantic-tag-id={id}
            >
              <button
                type="button"
                className="record-tag-picker__select"
                aria-pressed={selected}
                onClick={() =>
                  onChange(selected ? removeTag(tags, id) : addTag(tags, id))
                }
              >
                <span className="material-symbols-rounded" aria-hidden="true">
                  {selected
                    ? MATERIAL_UI_GLYPHS.selected
                    : MATERIAL_UI_GLYPHS.unselected}
                </span>
                <span>{name.text}</span>
              </button>
              <button
                type="button"
                className="record-tag-picker__main"
                aria-label={localisation.t('record.tag.makeMain', {
                  name: name.accessibleName,
                })}
                aria-pressed={display}
                disabled={!selected}
                onClick={() => onChange(chooseDisplayTag(tags, id))}
              >
                <span className="material-symbols-rounded" aria-hidden="true">
                  {display
                    ? MATERIAL_UI_GLYPHS.main
                    : MATERIAL_UI_GLYPHS.notMain}
                </span>
                <span>{localisation.t('record.tag.main')}</span>
              </button>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
