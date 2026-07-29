/**
 * The categorized navigation list for the exact objects at this location.
 *
 * Grouping never changes the order within a kind. The core owns the requested
 * shortest-to-longest and alphabetical tie order, including the meaning of an
 * ongoing Span; this browser surface only separates that ordered result into
 * Entry, Events, and Spans.
 */

import { useId, useRef, useState, type ReactNode } from 'react'
import type {
  StableId,
  StructuredSummary,
  TimeScale,
  TimeWindow,
} from '../../../core/client'
import { failureMessage, useFormat, useLocalisation } from '../../../i18n'
import { RecordSemanticIcon } from '../events'
import { displayAccentClassName } from '../metadata'
import { RecordControlIcon, RecordOverlay } from '../overlays'
import { objectName, objectWhen } from './objectNames'
import type { RecordObjects } from './recordObjects'
import { RecordObjectNoticeBar } from './RecordObjectNoticeBar'

const ORDINARY_LABEL = {
  day: 'record.objects.ordinaryDay',
  week: 'record.objects.ordinaryWeek',
  month: 'record.objects.ordinaryMonth',
  year: 'record.objects.ordinaryYear',
} as const satisfies Record<TimeScale, string>

const EMPTY_MEDIA_COUNTS: ReadonlyMap<StableId, number> = new Map()

export interface RecordObjectSwitcherProps {
  readonly scale: TimeScale
  readonly window: TimeWindow | null
  readonly objects: RecordObjects
  readonly creatingEvent: boolean
  readonly creatingSpan: boolean
  readonly ordinarySummary?: {
    readonly text: string
    readonly mediaCount: number | null
  } | null
  readonly structuredMediaCounts?: ReadonlyMap<StableId, number>
  readonly onCreateEvent: () => void
  readonly onCreateSpan: () => void
  readonly onNavigate?: () => void
}

export function RecordObjectSwitcher({
  scale,
  window,
  objects,
  creatingEvent,
  creatingSpan,
  ordinarySummary = null,
  structuredMediaCounts = EMPTY_MEDIA_COUNTS,
  onCreateEvent,
  onCreateSpan,
  onNavigate,
}: RecordObjectSwitcherProps) {
  const localisation = useLocalisation()
  const t = localisation.t
  const { state } = objects
  const events = state.objects.filter(
    (object) => object.placement.kind === 'event',
  )
  const spans = state.objects.filter(
    (object) => object.placement.kind === 'span',
  )
  const [creatingMenuOpen, setCreatingMenuOpen] = useState(false)
  const createButton = useRef<HTMLButtonElement>(null)
  const createEventButton = useRef<HTMLButtonElement>(null)
  const createDialogId = useId()
  const createHeadingId = useId()

  const choose = (object: StructuredSummary) => {
    if (scale === 'day') objects.selectObject(object)
    else objects.goToObject(object)
    onNavigate?.()
  }

  return (
    <div className="record-objects">
      <div
        className="record-objects__groups"
        role="group"
        aria-label={t('record.objects.label')}
        aria-busy={state.status === 'loading' || undefined}
      >
        <button
          type="button"
          className="record-objects__tab record-objects__tab--ordinary ui-text"
          aria-label={t(ORDINARY_LABEL[scale])}
          aria-pressed={
            state.selected === null && !creatingEvent && !creatingSpan
          }
          onClick={() => {
            objects.selectOrdinary()
            onNavigate?.()
          }}
        >
          <span className="record-objects__ordinary-icon" aria-hidden="true">
            <RecordSemanticIcon id="writing" decorative />
          </span>
          <span className="record-objects__tab-copy">
            <span className="record-objects__tab-title">
              {t(ORDINARY_LABEL[scale])}
            </span>
            {ordinarySummary?.text || ordinarySummary?.mediaCount ? (
              <span className="record-objects__tab-meta">
                {ordinarySummary.text ? (
                  <span className="record-objects__tab-excerpt">
                    {ordinarySummary.text}
                  </span>
                ) : null}
                <MediaCount count={ordinarySummary.mediaCount} />
              </span>
            ) : null}
          </span>
        </button>

        <ObjectGroup
          heading={t('record.objects.groupEvents')}
          count={events.length}
        >
          {events.length === 0 ? (
            <EmptyGroup />
          ) : (
            events.map((object) => (
              <ObjectTab
                key={object.id}
                object={object}
                selected={
                  object.id === state.selected?.id &&
                  !creatingEvent &&
                  !creatingSpan
                }
                onSelect={() => choose(object)}
                mediaCount={
                  object.mediaCount ??
                  structuredMediaCounts.get(object.id) ??
                  null
                }
              />
            ))
          )}
        </ObjectGroup>

        <ObjectGroup
          heading={t('record.objects.groupSpans')}
          count={spans.length}
        >
          {spans.length === 0 ? (
            <EmptyGroup />
          ) : (
            spans.map((object) => (
              <ObjectTab
                key={object.id}
                object={object}
                selected={
                  object.id === state.selected?.id &&
                  !creatingEvent &&
                  !creatingSpan
                }
                onSelect={() => choose(object)}
                mediaCount={
                  object.mediaCount ??
                  structuredMediaCounts.get(object.id) ??
                  null
                }
              />
            ))
          )}
        </ObjectGroup>
      </div>

      {state.status === 'failed' && state.failure ? (
        <div className="record-objects__unavailable">
          <p role="alert" className="record-objects__message">
            {failureMessage(localisation, state.failure)}
          </p>
          <p className="record-objects__message">
            {t('record.objects.unavailableDetail')}
          </p>
          {state.failure.retryable ? (
            <button
              type="button"
              className="button ui-text"
              onClick={objects.retry}
            >
              {t('app.action.retry')}
            </button>
          ) : null}
        </div>
      ) : null}

      {state.bounded ? (
        <p className="record-objects__message">
          {t('record.objects.bounded', { count: state.objects.length })}
        </p>
      ) : null}

      <RecordObjectNoticeBar objects={objects} />

      <div className="record-objects__footer">
        <button
          ref={createButton}
          type="button"
          className="record-objects__add ui-text"
          aria-haspopup="dialog"
          aria-expanded={creatingMenuOpen}
          aria-controls={createDialogId}
          aria-pressed={creatingEvent || creatingSpan}
          disabled={!window || state.status === 'failed'}
          onClick={() => setCreatingMenuOpen(true)}
        >
          <RecordControlIcon name="add" />
          <span>{t('record.objects.newStructured')}</span>
        </button>
      </div>
      <RecordOverlay
        id={createDialogId}
        open={creatingMenuOpen}
        kind="anchored"
        labelledBy={createHeadingId}
        anchorRef={createButton}
        initialFocusRef={createEventButton}
        onClose={() => setCreatingMenuOpen(false)}
        className="record-create-popup"
      >
        <header className="record-overlay__header">
          <h2 id={createHeadingId} className="ui-heading">
            {t('record.objects.newStructured')}
          </h2>
          <button
            type="button"
            className="record-overlay__close"
            aria-label={t('record.objects.closeCreateMenu')}
            onClick={() => setCreatingMenuOpen(false)}
          >
            <RecordControlIcon name="close" />
          </button>
        </header>
        <div className="record-create-popup__options">
          <button
            ref={createEventButton}
            type="button"
            onClick={() => {
              setCreatingMenuOpen(false)
              onCreateEvent()
            }}
          >
            <RecordSemanticIcon id="life-event" decorative />
            <span>{t('record.event.new')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCreatingMenuOpen(false)
              onCreateSpan()
            }}
          >
            <RecordSemanticIcon id="span" decorative />
            <span>{t('record.span.new')}</span>
          </button>
        </div>
      </RecordOverlay>
    </div>
  )
}

function ObjectGroup({
  heading,
  count,
  children,
}: {
  readonly heading: string
  readonly count?: number
  readonly children: ReactNode
}) {
  return (
    <section className="record-objects__group">
      <div className="record-objects__group-heading">
        <h3 className="record-objects__group-title">{heading}</h3>
        {count === undefined ? null : (
          <span className="record-objects__group-count" aria-hidden="true">
            {count}
          </span>
        )}
      </div>
      <div className="record-objects__group-items">{children}</div>
    </section>
  )
}

function EmptyGroup() {
  const t = useLocalisation().t
  return <p className="record-objects__empty">{t('record.objects.noItems')}</p>
}

function ObjectTab({
  object,
  selected,
  onSelect,
  mediaCount,
}: {
  readonly object: StructuredSummary
  readonly selected: boolean
  readonly onSelect: () => void
  readonly mediaCount: number | null
}) {
  const localisation = useLocalisation()
  const format = useFormat()
  return (
    <button
      type="button"
      className={`record-objects__tab ${displayAccentClassName(object.tags.display)}`}
      data-object-id={object.id}
      data-object-kind={object.placement.kind}
      data-display-tag-id={object.tags.display ?? undefined}
      aria-label={objectName(localisation, format, object)}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <RecordSemanticIcon id={object.iconId} className="record-objects__icon" />
      <span className="record-objects__tab-copy" aria-hidden="true">
        <span className="record-objects__tab-title">{object.title}</span>
        {object.placement.kind === 'span' || mediaCount ? (
          <span className="record-objects__tab-meta">
            {object.placement.kind === 'span' ? (
              <span className="record-objects__tab-when">
                {objectWhen(localisation, format, object)}
              </span>
            ) : null}
            <MediaCount count={mediaCount} />
          </span>
        ) : null}
      </span>
    </button>
  )
}

function MediaCount({ count }: { readonly count: number | null }) {
  const format = useFormat()
  if (!count) return null
  return (
    <span className="record-objects__media-count" aria-hidden="true">
      <RecordControlIcon name="media" />
      <span>{format.number(count)}</span>
    </span>
  )
}
