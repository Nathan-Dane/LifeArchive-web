import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import type {
  CivilDate,
  InvalidationToken,
  StableId,
  TrackSummary,
} from '../../../core/client'
import { useTranslate } from '../../../i18n'
import { RecordSemanticIcon } from '../events'
import { RecordControlIcon, RecordOverlay } from '../overlays'
import { newestRecordInvalidation } from '../recordInvalidation'
import { TrackDetails } from './TrackDetails'
import type { CreatedTrack, Tracks } from './useTracks'

export function TrackChooser({
  tracks,
  value,
  date,
  disabled = false,
  onChange,
}: {
  readonly tracks: Tracks
  readonly value: string
  readonly date?: CivilDate
  readonly disabled?: boolean
  readonly onChange: (
    trackId: StableId | null,
    invalidation?: InvalidationToken,
  ) => void
}) {
  const t = useTranslate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const [managerTracks, setManagerTracks] = useState<
    readonly TrackSummary[] | null
  >(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const managerClose = useRef<HTMLButtonElement>(null)
  const managerLoadGeneration = useRef(0)
  const menuItems = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()
  const triggerId = useId()
  const managerId = useId()
  const managerHeadingId = useId()
  const editorHeadingId = useId()
  const available = tracks.state.tracks.filter(
    ({ track }) => !track.isArchived || track.id === value,
  )
  const selected = available.find(({ track }) => track.id === value) ?? null
  const selectedName = selected?.track.name ?? t('record.track.none')
  const selectedIndex = selected
    ? available.findIndex(({ track }) => track.id === selected.track.id) + 1
    : 0

  const closeMenu = (restoreFocus: boolean) => {
    setMenuOpen(false)
    if (restoreFocus) {
      globalThis.queueMicrotask(() => trigger.current?.focus())
    }
  }
  const choose = (trackId: StableId | null) => {
    const invalidation = tracks.state.invalidation ?? undefined
    if (invalidation) {
      onChange(trackId, invalidation)
    } else {
      onChange(trackId)
    }
    closeMenu(true)
  }
  const moveFocus = (index: number) => {
    const last = available.length + (date ? 2 : 1)
    const clamped = Math.min(Math.max(index, 0), last)
    menuItems.current[clamped]?.focus()
  }
  const onMenuKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const current = menuItems.current.indexOf(
      document.activeElement as HTMLButtonElement,
    )
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeMenu(true)
      return
    }
    if (current < 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      moveFocus(current + 1)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      moveFocus(current - 1)
    } else if (event.key === 'Home') {
      moveFocus(0)
    } else if (event.key === 'End') {
      moveFocus(available.length + (date ? 2 : 1))
    } else {
      return
    }
    event.preventDefault()
  }
  const refreshManager = (seed?: TrackSummary) => {
    const seeded = new Map<StableId, TrackSummary>()
    for (const summary of tracks.state.tracks) {
      seeded.set(summary.track.id, summary)
    }
    if (seed) seeded.set(seed.track.id, seed)
    setManagerTracks([...seeded.values()])
    const requested = (managerLoadGeneration.current += 1)
    void tracks.loadManagementList().then((summaries) => {
      if (managerLoadGeneration.current === requested) {
        setManagerTracks(summaries)
      }
    })
  }
  const openManager = () => {
    closeMenu(false)
    setManagerOpen(true)
    refreshManager()
  }
  const closeTrackTask = () => {
    managerLoadGeneration.current += 1
    setManagerOpen(false)
    if (tracks.state.creating) {
      tracks.cancelCreate()
    } else if (tracks.state.selected) {
      tracks.clearSelection()
    }
  }
  const backToManager = () => {
    tracks.clearSelection()
    refreshManager()
    globalThis.queueMicrotask(() => managerClose.current?.focus())
  }
  const finishCreate = (created: CreatedTrack) => {
    tracks.clearSelection()
    if (managerOpen) {
      refreshManager(created.summary)
      globalThis.queueMicrotask(() => managerClose.current?.focus())
      return
    }
    onChange(
      created.summary.track.id,
      newestRecordInvalidation(
        tracks.state.invalidation,
        created.invalidation,
      ) ?? created.invalidation,
    )
  }

  return (
    <>
      <button
        id={triggerId}
        ref={trigger}
        type="button"
        className="record-track-chooser"
        aria-label={t('record.track.trigger', { name: selectedName })}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        disabled={
          disabled ||
          (tracks.state.status === 'loading' && !menuOpen && !managerOpen)
        }
        onClick={() => setMenuOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && menuOpen) {
            event.preventDefault()
            closeMenu(true)
          } else if (
            (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
            !menuOpen
          ) {
            event.preventDefault()
            setMenuOpen(true)
            globalThis.queueMicrotask(() =>
              moveFocus(
                event.key === 'ArrowDown'
                  ? selectedIndex
                  : available.length + (date ? 2 : 1),
              ),
            )
          }
        }}
      >
        <span className="record-track-chooser__icon" aria-hidden="true">
          {selected ? (
            <RecordSemanticIcon id={selected.track.iconId} decorative />
          ) : (
            <RecordControlIcon name="none" />
          )}
        </span>
        <span className="record-track-chooser__name">{selectedName}</span>
        <span className="record-track-chooser__chevron" aria-hidden="true">
          <RecordControlIcon name="expand" />
        </span>
      </button>
      <RecordOverlay
        id={menuId}
        open={menuOpen}
        kind="menu"
        labelledBy={triggerId}
        anchorRef={trigger}
        onClose={() => closeMenu(true)}
        className="record-menu record-track-menu"
      >
        <div
          className="record-menu__items record-track-menu__items"
          onKeyDown={onMenuKeyDown}
        >
          <TrackMenuOption
            optionRef={(element) => {
              menuItems.current[0] = element
            }}
            checked={selected === null}
            label={t('record.track.noSelection')}
            onClick={() => choose(null)}
            icon={<RecordControlIcon name="none" />}
          />
          {available.length > 0 ? (
            <span className="record-track-menu__separator" role="separator" />
          ) : null}
          {available.map((summary, index) => (
            <TrackMenuOption
              key={summary.track.id}
              optionRef={(element) => {
                menuItems.current[index + 1] = element
              }}
              checked={summary.track.id === value}
              label={summary.track.name}
              onClick={() => choose(summary.track.id)}
              icon={<RecordSemanticIcon id={summary.track.iconId} decorative />}
            />
          ))}
          <span className="record-track-menu__separator" role="separator" />
          {date ? (
            <button
              ref={(element) => {
                menuItems.current[available.length + 1] = element
              }}
              type="button"
              role="menuitem"
              className="record-menu__item record-track-menu__action record-track-menu__action--primary"
              onClick={() => {
                closeMenu(true)
                tracks.startCreate(date)
              }}
            >
              <span className="record-track-menu__option-icon" aria-hidden>
                <RecordControlIcon name="add" />
              </span>
              <span>{t('record.track.new')}</span>
            </button>
          ) : null}
          <button
            ref={(element) => {
              menuItems.current[available.length + (date ? 2 : 1)] = element
            }}
            type="button"
            role="menuitem"
            className="record-menu__item record-track-menu__action"
            onClick={openManager}
          >
            <span className="record-track-menu__option-icon" aria-hidden>
              <RecordControlIcon name="manage" />
            </span>
            <span>{t('record.track.manageAll')}</span>
          </button>
        </div>
      </RecordOverlay>
      <RecordOverlay
        id={managerId}
        open={managerOpen || tracks.active}
        kind="modal"
        labelledBy={tracks.active ? editorHeadingId : managerHeadingId}
        anchorRef={trigger}
        initialFocusRef={managerClose}
        onClose={closeTrackTask}
        className={
          tracks.active ? 'record-track-editor' : 'record-track-manager'
        }
      >
        {tracks.active ? (
          <TrackDetails
            key={
              tracks.state.creating ? 'new-track' : tracks.state.selected?.id
            }
            tracks={tracks}
            headingId={editorHeadingId}
            closeRef={managerClose}
            onBack={managerOpen ? backToManager : undefined}
            onClose={closeTrackTask}
            onCreated={finishCreate}
            onManagementRefresh={managerOpen ? refreshManager : undefined}
          />
        ) : (
          <TrackManager
            headingId={managerHeadingId}
            closeRef={managerClose}
            tracks={managerTracks ?? tracks.state.tracks}
            canCreate={date !== undefined}
            onClose={closeTrackTask}
            onCreate={() => {
              if (date) tracks.startCreate(date)
            }}
            onSelect={(summary) => {
              tracks.select(summary)
              globalThis.queueMicrotask(() => managerClose.current?.focus())
            }}
          />
        )}
      </RecordOverlay>
    </>
  )
}

function TrackMenuOption({
  optionRef,
  checked,
  label,
  icon,
  onClick,
}: {
  readonly optionRef: (element: HTMLButtonElement | null) => void
  readonly checked: boolean
  readonly label: string
  readonly icon: ReactNode
  readonly onClick: () => void
}) {
  return (
    <button
      ref={optionRef}
      type="button"
      className="record-menu__item"
      role="menuitemradio"
      aria-checked={checked}
      onClick={onClick}
    >
      <span className="record-track-menu__option-icon" aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
      <span className="record-track-menu__selected" aria-hidden>
        {checked ? <RecordControlIcon name="check" /> : null}
      </span>
    </button>
  )
}

function TrackManager({
  headingId,
  closeRef,
  tracks,
  canCreate,
  onClose,
  onCreate,
  onSelect,
}: {
  readonly headingId: string
  readonly closeRef: RefObject<HTMLButtonElement | null>
  readonly tracks: readonly TrackSummary[]
  readonly canCreate: boolean
  readonly onClose: () => void
  readonly onCreate: () => void
  readonly onSelect: (summary: TrackSummary) => void
}) {
  const t = useTranslate()
  const active = tracks.filter(({ track }) => !track.isArchived)
  const archived = tracks.filter(({ track }) => track.isArchived)
  return (
    <>
      <header className="record-overlay__header record-track-manager__header">
        <div>
          <h2 id={headingId} className="ui-heading">
            {t('record.track.manageAll')}
          </h2>
          <p className="meta-text">{t('record.track.manageDetail')}</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="record-overlay__close"
          aria-label={t('record.track.closeManager')}
          onClick={onClose}
        >
          <RecordControlIcon name="close" />
        </button>
      </header>
      <div className="record-track-manager__body">
        <TrackManagerGroup
          heading={t('record.track.activeHeading')}
          tracks={active}
          onSelect={onSelect}
        />
        {archived.length > 0 ? (
          <TrackManagerGroup
            heading={t('record.track.archivedHeading')}
            tracks={archived}
            archived
            onSelect={onSelect}
          />
        ) : null}
        {active.length === 0 && archived.length === 0 ? (
          <p className="record-track-manager__empty">
            {t('record.track.empty')}
          </p>
        ) : null}
      </div>
      <footer className="record-overlay__footer record-track-manager__footer">
        <button
          type="button"
          className="button button--primary"
          disabled={!canCreate}
          onClick={onCreate}
        >
          <RecordControlIcon name="add" />
          <span>{t('record.track.new')}</span>
        </button>
      </footer>
    </>
  )
}

function TrackManagerGroup({
  heading,
  tracks,
  archived = false,
  onSelect,
}: {
  readonly heading: string
  readonly tracks: readonly TrackSummary[]
  readonly archived?: boolean
  readonly onSelect: (summary: TrackSummary) => void
}) {
  const t = useTranslate()
  const headingId = useId()
  if (tracks.length === 0) return null
  return (
    <section
      className="record-track-manager__group"
      aria-labelledby={headingId}
      data-archived={archived || undefined}
    >
      <h3 id={headingId} className="eyebrow">
        {heading}
      </h3>
      <div className="record-track-manager__list">
        {tracks.map((summary) => (
          <button
            key={summary.track.id}
            type="button"
            onClick={() => onSelect(summary)}
          >
            <span className="record-track-manager__icon" aria-hidden>
              <RecordSemanticIcon id={summary.track.iconId} decorative />
            </span>
            <span className="record-track-manager__copy">
              <strong>{summary.track.name}</strong>
              <span className="meta-text">
                {t('record.track.memberCount', {
                  count: summary.memberCount,
                })}
                {archived ? ` · ${t('record.track.archived')}` : ''}
              </span>
            </span>
            <span className="record-track-manager__next" aria-hidden>
              <RecordControlIcon name="next" />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
