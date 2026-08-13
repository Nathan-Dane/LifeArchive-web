import type { SemanticId, StructuredTags } from '../../../core/client'
import { semanticName, useLocalisation } from '../../../i18n'
import { SelectionMenu } from '../../../ui/menu'
import {
  PREDEFINED_TAG_IDS,
  MATERIAL_UI_GLYPHS,
  chooseDisplayTag,
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
      {display ? (
        <span className="material-symbols-rounded record-tag__star" aria-hidden>
          {MATERIAL_UI_GLYPHS.main}
        </span>
      ) : null}
      <span>{name.text}</span>
    </span>
  )
}

export function RecordTagRibbon({
  tags,
  disabled = false,
  menuId,
  menuOpen = false,
  onActivate,
}: {
  readonly tags: StructuredTags
  readonly disabled?: boolean
  readonly menuId?: string
  readonly menuOpen?: boolean
  readonly onActivate?: (opener: HTMLButtonElement, focusFirst: boolean) => void
}) {
  if (tags.ordered.length === 0) return null
  const display = tags.display
  const ordered = [
    ...(display ? [display] : []),
    ...tags.ordered.filter((id) => id !== display),
  ]
  return (
    <div className="record-tag-ribbon">
      {ordered.map((id) =>
        onActivate ? (
          <button
            key={id}
            type="button"
            className="selection-picker__assigned-trigger"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            disabled={disabled}
            onClick={(event) =>
              onActivate(event.currentTarget, event.detail === 0)
            }
          >
            <RecordTagBadge id={id} display={id === display} />
          </button>
        ) : (
          <RecordTagBadge key={id} id={id} display={id === display} />
        ),
      )}
    </div>
  )
}

export function RecordTagPicker({
  tags,
  onChange,
  disabled = false,
  label,
}: {
  readonly tags: StructuredTags
  readonly onChange: (tags: StructuredTags) => void
  readonly disabled?: boolean
  readonly label?: string
}) {
  const localisation = useLocalisation()
  const unknownSelected = tags.ordered.filter(
    (id) => !(PREDEFINED_TAG_IDS as readonly string[]).includes(id),
  )
  const visibleIds = [...PREDEFINED_TAG_IDS, ...unknownSelected]
  const options = visibleIds.map((id) => {
    const name = semanticName(localisation, 'record', 'tag', id)
    return { value: id, label: name.accessibleName }
  })

  return (
    <div className="record-tag-picker">
      <span className="record-details__label-line meta-text">
        {label ?? localisation.t('record.event.tags')}
      </span>
      <SelectionMenu
        options={options}
        selected={tags.ordered}
        primary={tags.display}
        multiple
        allowPrimary
        disabled={disabled}
        menuLabel={localisation.t('record.tag.pickerLabel')}
        triggerLabel={localisation.t('record.tag.manage')}
        assignedClassName="record-tag-picker__assigned"
        menuClassName="record-tag-menu"
        listClassName="record-tag-picker__list"
        rowClassName={({ value }) =>
          `record-tag-picker__row--${tagPaletteFor(value)}`
        }
        renderAssigned={({ value }, display) => (
          <RecordTagBadge id={value} display={display} />
        )}
        renderOption={({ value }) => <RecordTagBadge id={value} />}
        mainAction={({ label: accessibleName }) => ({
          label: localisation.t('record.tag.main'),
          accessibleLabel: localisation.t('record.tag.makeMain', {
            name: accessibleName,
          }),
        })}
        onSelectionChange={(ordered) =>
          onChange({
            ordered,
            display:
              tags.display && ordered.includes(tags.display)
                ? tags.display
                : (ordered[0] ?? null),
          })
        }
        onPrimaryChange={(id) => onChange(chooseDisplayTag(tags, id))}
      />
    </div>
  )
}
