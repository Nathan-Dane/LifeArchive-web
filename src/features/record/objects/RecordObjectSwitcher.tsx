/**
 * The categorized navigation list for the exact objects at this location.
 *
 * Grouping never changes the order within a kind. The core owns the requested
 * shortest-to-longest and alphabetical tie order, including the meaning of an
 * ongoing Span; this browser surface only separates that ordered result into
 * Entry, Events, and Spans.
 */

import type { ReactNode } from 'react'
import type {
  StructuredSummary,
  TimeScale,
  TimeWindow,
} from '../../../core/client'
import { failureMessage, useFormat, useLocalisation } from '../../../i18n'
import { RecordSemanticIcon } from '../events'
import { objectName, objectWhen } from './objectNames'
import type { RecordObjects } from './recordObjects'
import { RecordObjectNoticeBar } from './RecordObjectNoticeBar'

const ORDINARY_LABEL = {
  day: 'record.objects.ordinaryDay',
  week: 'record.objects.ordinaryWeek',
  month: 'record.objects.ordinaryMonth',
  year: 'record.objects.ordinaryYear',
} as const satisfies Record<TimeScale, string>

export interface RecordObjectSwitcherProps {
  readonly scale: TimeScale
  readonly window: TimeWindow | null
  readonly objects: RecordObjects
  readonly creatingEvent: boolean
  readonly creatingSpan: boolean
  readonly onCreateEvent: () => void
  readonly onCreateSpan: () => void
}

export function RecordObjectSwitcher({
  scale,
  window,
  objects,
  creatingEvent,
  creatingSpan,
  onCreateEvent,
  onCreateSpan,
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

  const choose = (object: StructuredSummary) => {
    if (scale === 'day') objects.selectObject(object)
    else objects.goToObject(object)
  }

  return (
    <div className="record-objects">
      <div
        className="record-objects__groups"
        role="group"
        aria-label={t('record.objects.label')}
        aria-busy={state.status === 'loading' || undefined}
      >
        <ObjectGroup heading={t('record.objects.groupEntry')}>
          <button
            type="button"
            className="record-objects__tab record-objects__tab--ordinary ui-text"
            aria-pressed={
              state.selected === null && !creatingEvent && !creatingSpan
            }
            onClick={objects.selectOrdinary}
          >
            {t(ORDINARY_LABEL[scale])}
          </button>
        </ObjectGroup>

        <ObjectGroup heading={t('record.objects.groupEvents')}>
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
              />
            ))
          )}
        </ObjectGroup>

        <ObjectGroup heading={t('record.objects.groupSpans')}>
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
              />
            ))
          )}
        </ObjectGroup>

        <button
          type="button"
          className="record-objects__add ui-text"
          aria-pressed={creatingEvent}
          disabled={!window || state.status === 'failed'}
          onClick={onCreateEvent}
        >
          {t('record.event.new')}
        </button>
        <button
          type="button"
          className="record-objects__add ui-text"
          aria-pressed={creatingSpan}
          disabled={!window || state.status === 'failed'}
          onClick={onCreateSpan}
        >
          {t('record.span.new')}
        </button>
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
    </div>
  )
}

function ObjectGroup({
  heading,
  children,
}: {
  readonly heading: string
  readonly children: ReactNode
}) {
  return (
    <section className="record-objects__group">
      <h3 className="record-objects__group-title">{heading}</h3>
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
}: {
  readonly object: StructuredSummary
  readonly selected: boolean
  readonly onSelect: () => void
}) {
  const localisation = useLocalisation()
  const format = useFormat()
  return (
    <button
      type="button"
      className="record-objects__tab"
      data-object-id={object.id}
      data-object-kind={object.placement.kind}
      aria-label={objectName(localisation, format, object)}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <RecordSemanticIcon id={object.iconId} className="record-objects__icon" />
      <span className="record-objects__tab-copy" aria-hidden="true">
        <span className="record-objects__tab-title">{object.title}</span>
        <span className="record-objects__tab-when">
          {objectWhen(localisation, format, object)}
        </span>
      </span>
    </button>
  )
}
