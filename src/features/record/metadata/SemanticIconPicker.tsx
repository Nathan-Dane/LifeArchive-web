import { useId, useRef, useState, type KeyboardEvent } from 'react'
import type { SemanticId } from '../../../core/client'
import { semanticName, useLocalisation } from '../../../i18n'
import { RecordSemanticIcon } from '../events/RecordSemanticIcon'
import { RecordOverlay } from '../overlays'
import {
  ORDERED_SEMANTIC_ICON_IDS,
  SEMANTIC_ICON_CATALOG_VERSION,
  SEMANTIC_ICON_CATEGORIES,
} from './semanticCatalog'

type CategoryId = (typeof SEMANTIC_ICON_CATEGORIES)[number]['id']
type IconView = 'all' | CategoryId

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
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<IconView>('all')
  const [draft, setDraft] = useState<SemanticId>(value)
  const [activeIcon, setActiveIcon] = useState<SemanticId>(value)
  const trigger = useRef<HTMLButtonElement>(null)
  const initialIcon = useRef<HTMLButtonElement>(null)
  const iconRefs = useRef(new Map<SemanticId, HTMLButtonElement>())
  const categoryRefs = useRef<(HTMLButtonElement | null)[]>([])
  const dialogId = useId()
  const headingId = useId()
  const catalogueId = useId()
  const currentName = semanticName(localisation, 'record', 'icon', value)

  const openPicker = () => {
    setView('all')
    setDraft(value)
    setActiveIcon(ORDERED_SEMANTIC_ICON_IDS[0])
    setOpen(true)
  }
  const close = () => setOpen(false)
  const commit = (id: SemanticId = draft) => {
    onChange(id)
    close()
  }
  const chooseView = (next: IconView) => {
    setView(next)
    const visible =
      next === 'all'
        ? ORDERED_SEMANTIC_ICON_IDS
        : SEMANTIC_ICON_CATEGORIES.find(({ id }) => id === next)?.icons
    if (visible?.includes(activeIcon as never)) return
    setActiveIcon(visible?.[0] ?? ORDERED_SEMANTIC_ICON_IDS[0])
  }
  const moveCategory = (index: number) => {
    const clamped = Math.min(
      Math.max(index, 0),
      SEMANTIC_ICON_CATEGORIES.length,
    )
    categoryRefs.current[clamped]?.focus()
  }
  const onCategoryKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      moveCategory(index + 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      moveCategory(index - 1)
    } else if (event.key === 'Home') {
      moveCategory(0)
    } else if (event.key === 'End') {
      moveCategory(SEMANTIC_ICON_CATEGORIES.length)
    } else {
      return
    }
    event.preventDefault()
  }
  const onGridKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    ids: readonly SemanticId[],
    id: SemanticId,
  ) => {
    const current = ids.indexOf(id)
    if (current < 0) return
    const grid = event.currentTarget.closest<HTMLElement>(
      '.semantic-icon-picker__grid',
    )
    const columns = grid
      ? Math.max(
          globalThis
            .getComputedStyle(grid)
            .gridTemplateColumns.split(' ')
            .filter(Boolean).length,
          1,
        )
      : 1
    const step = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns,
    }[event.key]
    const next =
      step === undefined
        ? event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? ids.length - 1
            : null
        : Math.min(Math.max(current + step, 0), ids.length - 1)
    if (next === null) return
    const nextId = ids[next]
    if (nextId) {
      setActiveIcon(nextId)
      iconRefs.current.get(nextId)?.focus()
    }
    event.preventDefault()
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="semantic-icon-picker__trigger"
        aria-label={localisation.t('record.icon.trigger', {
          name: currentName.accessibleName,
        })}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        disabled={disabled}
        onClick={openPicker}
      >
        <RecordSemanticIcon id={value} decorative />
      </button>
      <RecordOverlay
        id={dialogId}
        open={open}
        kind="modal"
        labelledBy={headingId}
        anchorRef={trigger}
        initialFocusRef={initialIcon}
        onClose={close}
        className="semantic-icon-dialog"
      >
        <header className="record-overlay__header semantic-icon-dialog__header">
          <div className="semantic-icon-dialog__title">
            <span className="semantic-icon-dialog__preview" aria-hidden>
              <RecordSemanticIcon id={draft} decorative />
            </span>
            <div>
              <h2 id={headingId} className="ui-heading">
                {localisation.t('record.icon.pickerLabel')}
              </h2>
              <p className="meta-text">
                {
                  semanticName(localisation, 'record', 'icon', draft)
                    .accessibleName
                }
              </p>
            </div>
          </div>
          <div className="semantic-icon-dialog__actions">
            <button
              type="button"
              className="button button--secondary semantic-icon-dialog__cancel"
              onClick={close}
            >
              {localisation.t('record.icon.cancel')}
            </button>
            <button
              type="button"
              className="button semantic-icon-dialog__use"
              onClick={() => commit()}
            >
              {localisation.t('record.icon.use')}
            </button>
          </div>
        </header>
        <div className="semantic-icon-dialog__body">
          <nav
            className="semantic-icon-picker__categories"
            role="tablist"
            aria-label={localisation.t('record.icon.groups')}
          >
            <button
              ref={(element) => {
                categoryRefs.current[0] = element
              }}
              type="button"
              id={`${dialogId}-tab-all`}
              role="tab"
              aria-controls={catalogueId}
              aria-selected={view === 'all'}
              tabIndex={view === 'all' ? 0 : -1}
              onKeyDown={(event) => onCategoryKeyDown(event, 0)}
              onClick={() => chooseView('all')}
            >
              <span className="semantic-icon-picker__category-label">
                <span
                  className="semantic-icon-picker__category-glyph"
                  aria-hidden
                >
                  <RecordSemanticIcon
                    id={ORDERED_SEMANTIC_ICON_IDS[0]}
                    decorative
                  />
                </span>
                <span>{localisation.t('record.icon.all')}</span>
              </span>
              <span>{ORDERED_SEMANTIC_ICON_IDS.length}</span>
            </button>
            <span
              className="semantic-icon-picker__category-separator"
              role="separator"
            />
            {SEMANTIC_ICON_CATEGORIES.map((category, index) => (
              <button
                key={category.id}
                ref={(element) => {
                  categoryRefs.current[index + 1] = element
                }}
                type="button"
                id={`${dialogId}-tab-${category.id}`}
                role="tab"
                aria-controls={catalogueId}
                aria-selected={view === category.id}
                tabIndex={view === category.id ? 0 : -1}
                onKeyDown={(event) => onCategoryKeyDown(event, index + 1)}
                onClick={() => chooseView(category.id)}
              >
                <span className="semantic-icon-picker__category-label">
                  <span
                    className="semantic-icon-picker__category-glyph"
                    aria-hidden
                  >
                    <RecordSemanticIcon id={category.icons[0]} decorative />
                  </span>
                  <span>
                    {localisation.t(`record.icon.category.${category.id}`)}
                  </span>
                </span>
                <span>{category.icons.length}</span>
              </button>
            ))}
          </nav>
          <div
            id={catalogueId}
            className="semantic-icon-picker__catalogue"
            role="tabpanel"
            aria-labelledby={`${dialogId}-tab-${view}`}
            data-view={view}
            data-catalog-version={SEMANTIC_ICON_CATALOG_VERSION}
          >
            <header className="semantic-icon-picker__catalogue-head">
              <h3 className="ui-heading">
                {view === 'all'
                  ? localisation.t('record.icon.all')
                  : localisation.t(`record.icon.category.${view}`)}
              </h3>
              <span className="meta-text">
                {localisation.t('record.icon.count', {
                  count:
                    view === 'all'
                      ? ORDERED_SEMANTIC_ICON_IDS.length
                      : (SEMANTIC_ICON_CATEGORIES.find(({ id }) => id === view)
                          ?.icons.length ?? 0),
                })}
              </span>
            </header>
            {view === 'all'
              ? SEMANTIC_ICON_CATEGORIES.map((category) => (
                  <IconCategory
                    key={category.id}
                    id={category.id}
                    icons={category.icons}
                    draft={draft}
                    activeIcon={activeIcon}
                    dense
                    initialIcon={initialIcon}
                    iconRefs={iconRefs}
                    onActive={setActiveIcon}
                    onChoose={setDraft}
                    onCommit={commit}
                    onKeyDown={onGridKeyDown}
                  />
                ))
              : SEMANTIC_ICON_CATEGORIES.filter(({ id }) => id === view).map(
                  (category) => (
                    <IconCategory
                      key={category.id}
                      id={category.id}
                      icons={category.icons}
                      draft={draft}
                      activeIcon={activeIcon}
                      initialIcon={initialIcon}
                      iconRefs={iconRefs}
                      onActive={setActiveIcon}
                      onChoose={setDraft}
                      onCommit={commit}
                      onKeyDown={onGridKeyDown}
                    />
                  ),
                )}
          </div>
        </div>
      </RecordOverlay>
    </>
  )
}

function IconCategory({
  id,
  icons,
  draft,
  activeIcon,
  dense = false,
  initialIcon,
  iconRefs,
  onActive,
  onChoose,
  onCommit,
  onKeyDown,
}: {
  readonly id: CategoryId
  readonly icons: readonly SemanticId[]
  readonly draft: SemanticId
  readonly activeIcon: SemanticId
  readonly dense?: boolean
  readonly initialIcon: React.RefObject<HTMLButtonElement | null>
  readonly iconRefs: React.RefObject<Map<SemanticId, HTMLButtonElement>>
  readonly onActive: (id: SemanticId) => void
  readonly onChoose: (id: SemanticId) => void
  readonly onCommit: (id: SemanticId) => void
  readonly onKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    icons: readonly SemanticId[],
    id: SemanticId,
  ) => void
}) {
  const localisation = useLocalisation()
  const headingId = useId()
  const categoryName = localisation.t(`record.icon.category.${id}`)
  return (
    <section
      className="semantic-icon-picker__category"
      aria-labelledby={dense ? headingId : undefined}
      aria-label={dense ? undefined : categoryName}
    >
      {dense ? <h4 id={headingId}>{categoryName}</h4> : null}
      <div
        className="semantic-icon-picker__grid"
        data-dense={dense ? 'true' : 'false'}
        role="listbox"
        aria-label={categoryName}
      >
        {icons.map((iconId) => {
          const name = semanticName(localisation, 'record', 'icon', iconId)
          const selected = draft === iconId
          return (
            <button
              key={iconId}
              ref={(element) => {
                if (element) iconRefs.current.set(iconId, element)
                else iconRefs.current.delete(iconId)
                if (iconId === activeIcon) initialIcon.current = element
              }}
              type="button"
              className="semantic-icon-picker__option"
              role="option"
              aria-label={name.accessibleName}
              aria-selected={selected}
              tabIndex={iconId === activeIcon ? 0 : -1}
              title={dense ? name.text : undefined}
              onFocus={() => onActive(iconId)}
              onKeyDown={(event) => onKeyDown(event, icons, iconId)}
              onClick={() => onChoose(iconId)}
              onDoubleClick={() => onCommit(iconId)}
            >
              <RecordSemanticIcon id={iconId} decorative />
              {dense ? null : (
                <span className="semantic-icon-picker__name">{name.text}</span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
