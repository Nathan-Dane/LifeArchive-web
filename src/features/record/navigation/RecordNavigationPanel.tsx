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
import type { TimeScale, TimeWindow } from '../../../core/client'
import {
  failureMessage,
  useFormat,
  useLocalisation,
  type Formatters,
} from '../../../i18n'
import { civilLocation } from '../civilLocation'
import { RecordCalendarCells, RecordCalendarHeadings } from './RecordCalendar'
import { StepIcon } from './StepIcon'
import type { TemporalCursor } from './temporalCursor'

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

export interface RecordNavigationPanelProps {
  /**
   * The one Record cursor. It is passed in rather than created here: the
   * writing surface and the details region read the same position, and a panel
   * that owned a cursor of its own would be a second time state beside them.
   */
  readonly cursor: TemporalCursor
}

export function RecordNavigationPanel({ cursor }: RecordNavigationPanelProps) {
  const localisation = useLocalisation()
  const t = localisation.t
  const format = useFormat()
  const { state } = cursor
  const monthId = useId()
  const toggle = useRef<HTMLButtonElement>(null)

  const view = state.view
  const location = view ? civilLocation(format, view.window) : ''
  const commandLocation = view
    ? state.scale === 'day'
      ? format.civilDate(view.calendar.focusedDate, 'medium')
      : fullPeriodLabel(format, view.window)
    : ''

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

      <div className="record-navigation__cursor" data-scale={state.scale}>
        <button
          type="button"
          className="record-navigation__step"
          aria-label={t(PREVIOUS_LABEL[state.scale])}
          disabled={!view || state.status === 'loading'}
          onClick={() => cursor.step('previous')}
        >
          <StepIcon name="previous" />
        </button>
        <p className="record-navigation__location">{commandLocation}</p>
        {view && state.scale === 'day' ? (
          <button
            ref={toggle}
            type="button"
            className="record-navigation__calendar-toggle"
            aria-label={t(
              state.expanded
                ? 'record.navigation.collapseCalendar'
                : 'record.navigation.expandCalendar',
            )}
            aria-expanded={state.expanded}
            aria-controls={monthId}
            onClick={() => cursor.setExpanded(!state.expanded)}
          >
            <CalendarIcon />
          </button>
        ) : null}
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

      {state.status === 'failed' && state.failure ? (
        <div className="record-navigation__unavailable">
          <h2 className="ui-heading">
            {t('record.navigation.unavailableTitle')}
          </h2>
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

      {view && state.scale === 'day' ? (
        <div
          id={monthId}
          className="record-calendar"
          data-expanded={state.expanded ? 'true' : 'false'}
          onKeyDown={onCalendarKeyDown}
        >
          <div
            className="record-navigation__anchor record-navigation__anchor--expanded"
            hidden={!state.expanded}
          >
            <p className="record-navigation__period">
              {format.civilMonthAndYear(view.calendar.focusedDate)}
            </p>
            <button
              type="button"
              className="record-navigation__today"
              onClick={cursor.goToToday}
            >
              {t('record.navigation.today')}
            </button>
          </div>
          <div className="record-calendar__headings" hidden={!state.expanded}>
            <RecordCalendarHeadings week={view.calendar.week} />
          </div>
          <RecordCalendarCells
            days={
              view.calendar.month.length > 0
                ? view.calendar.month
                : view.calendar.week
            }
            selectedWeek={view.calendar.week}
            columns={view.calendar.week.length}
            label={t(
              state.expanded
                ? 'record.navigation.monthCells'
                : 'record.navigation.weekCells',
            )}
            focusedDate={view.calendar.focusedDate}
            today={state.today}
            expanded={state.expanded}
            onSelect={cursor.selectDate}
          />
        </div>
      ) : null}

      {view && state.scale !== 'day' && state.periods.length === 3 ? (
        <div
          className="record-navigation__period-strip"
          role="group"
          aria-label={t('record.navigation.periodStrip')}
        >
          {state.periods.map((period) => (
            <button
              key={period.id}
              type="button"
              aria-label={fullPeriodLabel(format, period)}
              aria-pressed={period.id === view.window.id}
              onClick={() =>
                cursor.goTo({
                  scale: state.scale,
                  anchor: period.startDate,
                })
              }
            >
              {shortPeriodLabel(format, period)}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className="record-navigation__anchor"
        hidden={!view || (state.scale === 'day' && state.expanded)}
      >
        <p className="record-navigation__period">
          {view ? anchorPeriodLabel(format, view.window) : ''}
        </p>
        <button
          type="button"
          className="record-navigation__today"
          onClick={cursor.goToToday}
        >
          {t('record.navigation.today')}
        </button>
      </div>

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

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4.5" width="14" height="12.5" rx="2.25" />
      <path d="M6.5 2.75v3.5M13.5 2.75v3.5M3 8h14" />
    </svg>
  )
}

function fullPeriodLabel(format: Formatters, window: TimeWindow): string {
  switch (window.scale) {
    case 'day':
      return format.civilDate(window.startDate, 'medium')
    case 'week':
      /*
       * The current contract exposes exact core-produced bounds but no week
       * ordinal. A range is truthful here; deriving “W28” in React would make
       * the browser a second week-numbering authority.
       */
      return format.civilDateRange(window.startDate, window.endDate, 'medium')
    case 'month':
      return format.civilMonthAndYear(window.startDate)
    case 'year':
      return format.civilYear(window.startDate)
  }
}

function shortPeriodLabel(format: Formatters, window: TimeWindow): string {
  switch (window.scale) {
    case 'day':
      return format.civilDate(window.startDate, 'short')
    case 'week':
      return format.civilCompactDateRange(window.startDate, window.endDate)
    case 'month':
      return format.civilMonth(window.startDate)
    case 'year':
      return format.civilYear(window.startDate)
  }
}

function anchorPeriodLabel(format: Formatters, window: TimeWindow): string {
  switch (window.scale) {
    case 'day':
    case 'week':
      return format.civilMonthAndYear(window.startDate)
    case 'month':
      return format.civilYear(window.startDate)
    case 'year':
      return ''
  }
}
