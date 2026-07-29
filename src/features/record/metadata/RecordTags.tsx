import { useId, useRef, useState, type KeyboardEvent } from 'react'
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
            className="record-tag-picker__assigned-trigger"
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
}: {
  readonly tags: StructuredTags
  readonly onChange: (tags: StructuredTags) => void
  readonly disabled?: boolean
}) {
  const localisation = useLocalisation()
  const [open, setOpen] = useState(false)
  const [keyboardNavigation, setKeyboardNavigation] = useState(false)
  const assigned = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const firstTag = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const triggerId = useId()
  const menuLabelId = useId()
  const unknownSelected = tags.ordered.filter(
    (id) => !(PREDEFINED_TAG_IDS as readonly string[]).includes(id),
  )
  const visibleIds = [...PREDEFINED_TAG_IDS, ...unknownSelected]
  const focusFirstMenuItem = () => {
    setKeyboardNavigation(true)
    globalThis.queueMicrotask(() => firstTag.current?.focus())
  }
  const openMenu = (nextOpener: HTMLButtonElement, focusFirst: boolean) => {
    opener.current = nextOpener
    setOpen(true)
    setKeyboardNavigation(focusFirst)
    if (focusFirst) focusFirstMenuItem()
  }
  const closeMenu = (restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) {
      const focusTarget = opener.current
      globalThis.queueMicrotask(() => focusTarget?.focus())
    }
  }
  const moveFocus = (direction: 1 | -1) => {
    const items = Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>(
        '.record-tag-picker__select',
      ) ?? [],
    )
    if (items.length === 0) return
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      current < 0
        ? direction > 0
          ? 0
          : items.length - 1
        : (current + direction + items.length) % items.length
    items[next]?.focus()
  }
  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      setKeyboardNavigation(true)
      moveFocus(1)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      setKeyboardNavigation(true)
      moveFocus(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setKeyboardNavigation(true)
      firstTag.current?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      setKeyboardNavigation(true)
      const items = menu.current?.querySelectorAll<HTMLButtonElement>(
        '.record-tag-picker__select',
      )
      items?.item(items.length - 1)?.focus()
    }
  }

  return (
    <div className="record-tag-picker">
      <span className="record-details__label-line meta-text">
        {localisation.t('record.event.tags')}
      </span>
      <span id={menuLabelId} className="visually-hidden">
        {localisation.t('record.tag.pickerLabel')}
      </span>
      <div ref={assigned} className="record-tag-picker__assigned">
        <RecordTagRibbon
          tags={tags}
          disabled={disabled}
          menuId={menuId}
          menuOpen={open}
          onActivate={openMenu}
        />
        <button
          id={triggerId}
          ref={trigger}
          type="button"
          className="record-tag-picker__trigger"
          aria-label={localisation.t('record.tag.manage')}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          disabled={disabled}
          onClick={(event) => openMenu(event.currentTarget, event.detail === 0)}
          onKeyDown={(event) => {
            if (
              open &&
              (event.key === 'ArrowDown' || event.key === 'ArrowUp')
            ) {
              event.preventDefault()
              focusFirstMenuItem()
            }
          }}
        >
          <RecordControlIcon name="add" />
        </button>
      </div>
      <RecordOverlay
        id={menuId}
        open={open}
        kind="menu"
        labelledBy={menuLabelId}
        anchorRef={assigned}
        onClose={closeMenu}
        className="record-menu record-tag-menu"
      >
        <div
          ref={menu}
          className="record-menu__items record-tag-picker__list"
          data-keyboard-navigation={keyboardNavigation}
          onKeyDown={onMenuKeyDown}
          onPointerMove={() => setKeyboardNavigation(false)}
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
                  role="menuitemcheckbox"
                  aria-checked={selected}
                  aria-label={name.accessibleName}
                  onPointerDown={() => setKeyboardNavigation(false)}
                  onClick={() =>
                    onChange(selected ? removeTag(tags, id) : addTag(tags, id))
                  }
                >
                  <RecordTagBadge id={id} />
                  <span className="record-tag-picker__check" aria-hidden="true">
                    {selected ? <RecordControlIcon name="check" /> : null}
                  </span>
                </button>
                {selected ? (
                  <button
                    type="button"
                    className="record-tag-picker__main"
                    role="menuitem"
                    aria-label={localisation.t('record.tag.makeMain', {
                      name: name.accessibleName,
                    })}
                    aria-pressed={display}
                    onPointerDown={() => setKeyboardNavigation(false)}
                    onClick={() => onChange(chooseDisplayTag(tags, id))}
                  >
                    {localisation.t('record.tag.main')}
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      </RecordOverlay>
    </div>
  )
}
