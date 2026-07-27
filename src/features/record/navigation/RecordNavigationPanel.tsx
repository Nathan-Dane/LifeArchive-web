/**
 * Record's time navigation panel.
 *
 * It shows one temporal cursor: the scale it is read at, the civil location it
 * sits on, the week the core placed around that location, and — when the
 * reader expands it — the surrounding month the core placed as well.
 *
 * Every date on screen is spelled from a value the core returned. The panel
 * never names a period by joining words, never numbers a week, and never
 * decides which day belongs to which month. Where the native application
 * answers a swipe, there is a named control here, so nothing is reachable by
 * gesture alone.
 */

import { useId, useRef, type KeyboardEvent } from 'react'
import { LiveStatus } from '../../../accessibility'
import type {
  LifeArchiveClient,
  TimeScale,
  TimeWindow,
} from '../../../core/client'
import {
  failureMessage,
  useFormat,
  useLocalisation,
  type Formatters,
} from '../../../i18n'
import { RecordCalendarCells, RecordCalendarHeadings } from './RecordCalendar'
import { StepIcon } from './StepIcon'
import { useTemporalCursor, type TemporalCursorOptions } from './temporalCursor'

const SCALES: readonly TimeScale[] = ['day', 'week', 'month', 'year']

const SCALE_LABEL = {
  day: 'record.navigation.scaleDay',
  week: 'record.navigation.scaleWeek',
  month: 'record.navigation.scaleMonth',
  year: 'record.navigation.scaleYear',
} as const

const PREVIOUS_LABEL = {
  day: 'record.navigation.previousDay',
  week: 'record.navigation.previousWeek',
  month: 'record.navigation.previousMonth',
  year: 'record.navigation.previousYear',
} as const

const NEXT_LABEL = {
  day: 'record.navigation.nextDay',
  week: 'record.navigation.nextWeek',
  month: 'record.navigation.nextMonth',
  year: 'record.navigation.nextYear',
} as const

/**
 * The civil location of a window, in the reader's own date wording. A window
 * covering one day is spelled as that day; a wider one is spelled as the
 * inclusive range the core gave it, rather than as a name for the period.
 */
function civilLocation(format: Formatters, window: TimeWindow): string {
  return window.startDate === window.endDate
    ? format.civilDate(window.startDate)
    : format.civilDateRange(window.startDate, window.endDate)
}

export interface RecordNavigationPanelProps {
  readonly client: LifeArchiveClient
  readonly cursorOptions?: TemporalCursorOptions
}

export function RecordNavigationPanel({
  client,
  cursorOptions,
}: RecordNavigationPanelProps) {
  const localisation = useLocalisation()
  const t = localisation.t
  const format = useFormat()
  const cursor = useTemporalCursor(client, cursorOptions)
  const { state } = cursor
  const monthId = useId()
  const toggle = useRef<HTMLButtonElement>(null)

  const view = state.view
  const location = view ? civilLocation(format, view.window) : ''

  /*
   * Escape collapses the month first and returns the reader to the control
   * that opened it. Only then does it stop: with the month already collapsed
   * the key belongs to whatever surrounds the panel, which in a narrow layout
   * is the drawer holding it.
   */
  const onCalendarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !state.expanded) return
    event.preventDefault()
    event.stopPropagation()
    cursor.setExpanded(false)
    toggle.current?.focus()
  }

  return (
    <nav
      className="record-navigation"
      aria-label={t('record.navigation.label')}
      aria-busy={state.status === 'loading' || undefined}
    >
      <div
        className="record-navigation__scales"
        role="group"
        aria-label={t('record.navigation.scaleLabel')}
      >
        {SCALES.map((scale) => (
          <button
            key={scale}
            type="button"
            className="record-navigation__scale ui-text"
            aria-pressed={scale === state.scale}
            onClick={() => cursor.chooseScale(scale)}
          >
            {t(SCALE_LABEL[scale])}
          </button>
        ))}
      </div>

      <div className="record-navigation__cursor">
        <button
          type="button"
          className="record-navigation__step"
          aria-label={t(PREVIOUS_LABEL[state.scale])}
          disabled={!view || state.status === 'loading'}
          onClick={() => cursor.step('previous')}
        >
          <StepIcon name="previous" />
        </button>
        <p className="record-navigation__location title">{location}</p>
        <button
          type="button"
          className="record-navigation__step"
          aria-label={t(NEXT_LABEL[state.scale])}
          disabled={!view || state.status === 'loading'}
          onClick={() => cursor.step('next')}
        >
          <StepIcon name="next" />
        </button>
      </div>

      <div className="record-navigation__anchor">
        <p className="record-navigation__period meta-text">
          {view ? format.civilMonthAndYear(view.calendar.focusedDate) : ''}
        </p>
        <button
          type="button"
          className="button record-navigation__today ui-text"
          onClick={cursor.goToToday}
        >
          {t('record.navigation.today')}
        </button>
      </div>

      {state.status === 'failed' && state.failure ? (
        <div className="record-navigation__unavailable">
          <h2 className="title">{t('record.navigation.unavailableTitle')}</h2>
          <p role="alert" className="record-navigation__message">
            {failureMessage(localisation, state.failure)}
          </p>
          <p className="record-navigation__message">
            {t('record.navigation.unavailableDetail')}
          </p>
          {state.failure.retryable ? (
            <button
              type="button"
              className="button ui-text"
              onClick={cursor.retry}
            >
              {t('app.action.retry')}
            </button>
          ) : null}
        </div>
      ) : null}

      {view ? (
        <div
          className="record-calendar"
          data-expanded={state.expanded ? 'true' : 'false'}
          onKeyDown={onCalendarKeyDown}
        >
          <button
            ref={toggle}
            type="button"
            className="record-calendar__toggle ui-text"
            aria-expanded={state.expanded}
            aria-controls={monthId}
            onClick={() => cursor.setExpanded(!state.expanded)}
          >
            {t(
              state.expanded
                ? 'record.navigation.collapseCalendar'
                : 'record.navigation.expandCalendar',
            )}
          </button>
          <RecordCalendarCells
            days={view.calendar.week}
            columns={view.calendar.week.length}
            label={t('record.navigation.weekCells')}
            focusedDate={view.calendar.focusedDate}
            today={state.today}
            showWeekday
            onSelect={cursor.selectDate}
          />
          <div className="record-calendar__month" hidden={!state.expanded}>
            <RecordCalendarHeadings week={view.calendar.week} />
            <RecordCalendarCells
              id={monthId}
              days={view.calendar.month}
              columns={view.calendar.week.length}
              label={t('record.navigation.monthCells')}
              focusedDate={view.calendar.focusedDate}
              today={state.today}
              onSelect={cursor.selectDate}
            />
          </div>
        </div>
      ) : null}

      {/*
        One quiet region for the whole panel: it says the cursor is being read
        while a request is out, and names where the cursor landed once it is.
        Every control that moves the cursor is therefore announced without any
        of them owning an announcement of its own.
      */}
      <LiveStatus>
        {state.status === 'loading' ? t('record.navigation.loading') : location}
      </LiveStatus>
    </nav>
  )
}
