import { useId, useRef, useState, type KeyboardEvent } from 'react'
import type { CivilDate, StableId } from '../../../core/client'
import { useTranslate } from '../../../i18n'
import { RecordSemanticIcon } from '../events'
import { RecordControlIcon, RecordOverlay } from '../overlays'
import type { Tracks } from './useTracks'

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
  readonly onChange: (trackId: StableId | null) => void
}) {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const initialOption = useRef<HTMLButtonElement>(null)
  const options = useRef<(HTMLButtonElement | null)[]>([])
  const dialogId = useId()
  const headingId = useId()
  const available = tracks.state.tracks.filter(
    ({ track }) => !track.isArchived || track.id === value,
  )
  const selected = available.find(({ track }) => track.id === value) ?? null
  const selectedName = selected?.track.name ?? t('record.track.none')
  const selectedIndex = selected
    ? available.findIndex(({ track }) => track.id === selected.track.id) + 1
    : 0

  const close = () => setOpen(false)
  const choose = (trackId: StableId | null) => {
    onChange(trackId)
    close()
  }
  const moveFocus = (index: number) => {
    const clamped = Math.min(Math.max(index, 0), available.length)
    options.current[clamped]?.focus()
  }
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = options.current.indexOf(
      document.activeElement as HTMLButtonElement,
    )
    if (current < 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      moveFocus(current + 1)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      moveFocus(current - 1)
    } else if (event.key === 'Home') {
      moveFocus(0)
    } else if (event.key === 'End') {
      moveFocus(available.length)
    } else {
      return
    }
    event.preventDefault()
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="record-track-chooser"
        aria-label={t('record.track.trigger', { name: selectedName })}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        disabled={disabled || tracks.state.status === 'loading'}
        onClick={() => setOpen(true)}
      >
        <span className="record-track-chooser__icon" aria-hidden="true">
          {selected ? (
            <RecordSemanticIcon id={selected.track.iconId} decorative />
          ) : (
            <RecordControlIcon name="none" />
          )}
        </span>
        <span className="record-track-chooser__name">{selectedName}</span>
        <RecordControlIcon name="expand" />
      </button>
      <RecordOverlay
        id={dialogId}
        open={open}
        kind="anchored"
        labelledBy={headingId}
        anchorRef={trigger}
        initialFocusRef={initialOption}
        onClose={close}
        className="record-track-dialog"
      >
        <header className="record-overlay__header">
          <h2 id={headingId} className="ui-heading">
            {t('record.track.choose')}
          </h2>
          <button
            type="button"
            className="record-overlay__close"
            aria-label={t('record.track.close')}
            onClick={close}
          >
            <RecordControlIcon name="close" />
          </button>
        </header>
        <div
          className="record-track-dialog__list"
          role="listbox"
          aria-label={t('record.track.choose')}
          onKeyDown={onListKeyDown}
        >
          <button
            ref={(element) => {
              options.current[0] = element
              if (selectedIndex === 0) initialOption.current = element
            }}
            type="button"
            role="option"
            aria-selected={selected === null}
            tabIndex={selectedIndex === 0 ? 0 : -1}
            onClick={() => choose(null)}
          >
            <span className="record-track-dialog__option-icon" aria-hidden>
              <RecordControlIcon name="none" />
            </span>
            <span>{t('record.track.none')}</span>
            {selected === null ? (
              <span className="record-track-dialog__selected" aria-hidden>
                <RecordControlIcon name="check" />
              </span>
            ) : null}
          </button>
          {available.map((summary, index) => {
            const active = summary.track.id === value
            const optionIndex = index + 1
            return (
              <button
                key={summary.track.id}
                ref={(element) => {
                  options.current[optionIndex] = element
                  if (active) initialOption.current = element
                }}
                type="button"
                role="option"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => choose(summary.track.id)}
              >
                <span className="record-track-dialog__option-icon" aria-hidden>
                  <RecordSemanticIcon id={summary.track.iconId} decorative />
                </span>
                <span>{summary.track.name}</span>
                {active ? (
                  <span className="record-track-dialog__selected" aria-hidden>
                    <RecordControlIcon name="check" />
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        {date || selected ? (
          <footer className="record-overlay__footer record-track-dialog__footer">
            {date ? (
              <button
                type="button"
                className="record-track-dialog__footer-action record-track-dialog__footer-action--primary"
                onClick={() => {
                  close()
                  tracks.startCreate(date)
                }}
              >
                <RecordControlIcon name="add" />
                {t('record.track.new')}
              </button>
            ) : null}
            {selected ? (
              <button
                type="button"
                className="record-track-dialog__footer-action"
                onClick={() => {
                  close()
                  tracks.select(selected)
                }}
              >
                {t('record.track.manage')}
              </button>
            ) : null}
          </footer>
        ) : null}
      </RecordOverlay>
    </>
  )
}
