import { useId, useRef, useState } from 'react'
import type { SemanticId, StructuredTags } from '../../../core/client'
import { semanticName, useLocalisation } from '../../../i18n'
import { RecordControlIcon, RecordOverlay } from '../overlays'
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
      {display ? (
        <span className="material-symbols-rounded record-tag__star" aria-hidden>
          {MATERIAL_UI_GLYPHS.main}
        </span>
      ) : null}
      <span>{name.text}</span>
    </span>
  )
}

export function RecordTagRibbon({ tags }: { readonly tags: StructuredTags }) {
  if (tags.ordered.length === 0) return null
  const display = tags.display
  const ordered = [
    ...(display ? [display] : []),
    ...tags.ordered.filter((id) => id !== display),
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
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const firstTag = useRef<HTMLButtonElement>(null)
  const dialogId = useId()
  const headingId = useId()
  const unknownSelected = tags.ordered.filter(
    (id) => !(PREDEFINED_TAG_IDS as readonly string[]).includes(id),
  )
  const visibleIds = [...PREDEFINED_TAG_IDS, ...unknownSelected]
  const displayName = tags.display
    ? semanticName(localisation, 'record', 'tag', tags.display)
    : null

  return (
    <div className="record-tag-picker">
      <span className="record-details__label-line meta-text">
        {localisation.t('record.event.tags')}
      </span>
      <div className="record-tag-picker__assigned">
        <RecordTagRibbon tags={tags} />
        <button
          ref={trigger}
          type="button"
          className="record-tag-picker__trigger"
          aria-label={localisation.t('record.tag.manage')}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={dialogId}
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          <RecordControlIcon name="add" />
        </button>
      </div>
      <RecordOverlay
        id={dialogId}
        open={open}
        kind="anchored"
        labelledBy={headingId}
        anchorRef={trigger}
        initialFocusRef={firstTag}
        onClose={() => setOpen(false)}
        className="record-tag-dialog"
      >
        <header className="record-overlay__header">
          <div className="record-tag-dialog__heading">
            <h2 id={headingId} className="ui-heading">
              {localisation.t('record.tag.pickerLabel')}
            </h2>
            <p>{localisation.t('record.tag.pickerDetail')}</p>
          </div>
          <button
            type="button"
            className="record-overlay__close"
            aria-label={localisation.t('record.tag.close')}
            onClick={() => setOpen(false)}
          >
            <RecordControlIcon name="close" />
          </button>
        </header>
        <div
          className="record-tag-picker__list"
          role="group"
          aria-label={localisation.t('record.tag.pickerLabel')}
        >
          {visibleIds.map((id, index) => {
            const selected = tags.ordered.includes(id)
            const display = tags.display === id
            const name = semanticName(localisation, 'record', 'tag', id)
            return (
              <div
                key={id}
                className={`record-tag-picker__row record-tag-picker__row--${tagPaletteFor(id)}`}
                data-semantic-tag-id={id}
                data-selected={selected || undefined}
                data-display-tag={display || undefined}
              >
                <button
                  ref={index === 0 ? firstTag : undefined}
                  type="button"
                  className="record-tag-picker__select"
                  role="checkbox"
                  aria-checked={selected}
                  aria-label={name.accessibleName}
                  onClick={() =>
                    onChange(selected ? removeTag(tags, id) : addTag(tags, id))
                  }
                >
                  <RecordTagBadge id={id} display={display} />
                  <span className="record-tag-picker__check" aria-hidden="true">
                    {selected ? <RecordControlIcon name="check" /> : null}
                  </span>
                </button>
                {selected ? (
                  <button
                    type="button"
                    className="record-tag-picker__main"
                    aria-label={localisation.t('record.tag.makeMain', {
                      name: name.accessibleName,
                    })}
                    aria-pressed={display}
                    onClick={() => onChange(chooseDisplayTag(tags, id))}
                  >
                    {localisation.t('record.tag.main')}
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
        <footer className="record-overlay__footer">
          <p className="record-tag-dialog__summary" aria-live="polite">
            {displayName
              ? localisation.t('record.tag.summaryWithMain', {
                  count: tags.ordered.length,
                  name: displayName.text,
                })
              : localisation.t('record.tag.summary', {
                  count: tags.ordered.length,
                })}
          </p>
          <button
            type="button"
            className="button"
            onClick={() => setOpen(false)}
          >
            {localisation.t('record.tag.done')}
          </button>
        </footer>
      </RecordOverlay>
    </div>
  )
}
