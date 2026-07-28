/**
 * The row that chooses which object at this location is being worked on.
 *
 * At Day scale the ordinary entry is fixed at the leading edge and the objects
 * the core placed follow it, in the core's order, each addressed by its exact
 * stable ID. At broader scales the same row offers the ordinary entry and one
 * bounded `Objects` control, because a month is not a list of tabs; choosing
 * from it hands off to the object's own day.
 *
 * Two things are deliberately absent. There is no menu on any control here:
 * deletion belongs at the bottom of the selected object's own surface, not on
 * the thing that selects it. And no control is drawn from a list position — a
 * tab carries the ID of the object it selects, so two Events on one date and
 * two overlapping Spans stay distinct.
 */

import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import type {
  StructuredSummary,
  TimeScale,
  TimeWindow,
} from '../../../core/client'
import { failureMessage, useFormat, useLocalisation } from '../../../i18n'
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
  /** The window the objects were placed in, or `null` while there is none. */
  readonly window: TimeWindow | null
  readonly objects: RecordObjects
}

export function RecordObjectSwitcher({
  scale,
  window,
  objects,
}: RecordObjectSwitcherProps) {
  const localisation = useLocalisation()
  const t = localisation.t
  const { state } = objects
  const pickerId = useId()
  const addNoteId = useId()
  const [picking, setPicking] = useState(false)

  return (
    <div className="record-objects">
      <div
        className="record-objects__row"
        role="group"
        aria-label={t('record.objects.label')}
        aria-busy={state.status === 'loading' || undefined}
      >
        <button
          type="button"
          className="record-objects__tab record-objects__tab--ordinary ui-text"
          aria-pressed={state.selected === null}
          onClick={objects.selectOrdinary}
        >
          {t(ORDINARY_LABEL[scale])}
        </button>

        {state.status === 'failed' && state.failure ? null : scale === 'day' ? (
          state.objects.map((object) => (
            <ObjectTab
              key={object.id}
              object={object}
              selected={object.id === state.selected?.id}
              onSelect={() => objects.selectObject(object)}
            />
          ))
        ) : (
          <button
            type="button"
            className="record-objects__picker-toggle ui-text"
            aria-expanded={picking}
            aria-controls={pickerId}
            disabled={state.status !== 'ready'}
            onClick={() => setPicking((open) => !open)}
          >
            {t('record.objects.count', { count: state.objects.length })}
          </button>
        )}

        {/*
          Creating Events and Spans is a later step. The control keeps its
          place in the row so the row it belongs to is the real one, and it is
          marked unavailable rather than removed or silently inert — it stays
          focusable so the reason is announced where the control is.
        */}
        <button
          type="button"
          className="record-objects__add ui-text"
          aria-disabled="true"
          aria-describedby={addNoteId}
        >
          {t('record.objects.add')}
        </button>
        <p id={addNoteId} className="visually-hidden">
          {t('record.objects.addUnavailable')}
        </p>
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

      {scale === 'day' ? null : (
        <ObjectPicker
          id={pickerId}
          open={picking}
          objects={objects}
          window={window}
          onClose={() => setPicking(false)}
        />
      )}

      <RecordObjectNoticeBar objects={objects} />
    </div>
  )
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
      <span className="record-objects__tab-kind" aria-hidden="true">
        {localisation.t(
          object.placement.kind === 'event'
            ? 'record.objects.kindEvent'
            : 'record.objects.kindSpan',
        )}
      </span>
      <span className="record-objects__tab-title" aria-hidden="true">
        {object.title}
      </span>
    </button>
  )
}

/**
 * The grouped picker a broader scale offers instead of a rail.
 *
 * Events and Spans are separated because they are different kinds of thing,
 * and within each group the core's order is kept exactly. Choosing one is a
 * handoff: the cursor moves to that object's own day and the object becomes
 * the selection, so the reader lands on the object rather than on a date that
 * happens to contain it.
 */
function ObjectPicker({
  id,
  open,
  objects,
  window,
  onClose,
}: {
  readonly id: string
  readonly open: boolean
  readonly objects: RecordObjects
  readonly window: TimeWindow | null
  readonly onClose: () => void
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const format = useFormat()
  const { state } = objects

  if (!open) return null

  const events = state.objects.filter(
    (object) => object.placement.kind === 'event',
  )
  const spans = state.objects.filter(
    (object) => object.placement.kind === 'span',
  )

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }

  const group = (
    heading: string,
    members: readonly StructuredSummary[],
  ): ReactNode =>
    members.length === 0 ? null : (
      <section className="record-objects__group">
        <h3 className="eyebrow">{heading}</h3>
        <ul className="record-objects__list">
          {members.map((object) => (
            <li key={object.id}>
              <button
                type="button"
                className="record-objects__choice"
                data-object-id={object.id}
                onClick={() => {
                  onClose()
                  objects.goToObject(object)
                }}
              >
                <span className="record-objects__choice-title">
                  {object.title}
                </span>
                <span className="record-objects__choice-when meta-text">
                  {objectWhen(localisation, format, object)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    )

  return (
    <div id={id} className="record-objects__picker" onKeyDown={onKeyDown}>
      {state.objects.length === 0 ? (
        <p className="record-objects__message">
          {window ? t('record.objects.none') : t('record.objects.noneUnplaced')}
        </p>
      ) : (
        <>
          {group(t('record.objects.groupEvents'), events)}
          {group(t('record.objects.groupSpans'), spans)}
          {state.bounded ? (
            <p className="record-objects__message">
              {t('record.objects.bounded', { count: state.objects.length })}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
