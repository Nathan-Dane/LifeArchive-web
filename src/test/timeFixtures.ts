/**
 * Core-produced time values, for tests.
 *
 * `coreTimeWindow` marks a value as one the core produced, so only a client
 * implementation may call it — a feature that called it would be a second time
 * authority. A test standing in for the core is exactly that, and it lives
 * here rather than beside a feature so the boundary rule stays absolute where
 * it matters: no file under `features/` or `app/` marks a window itself.
 *
 * Nothing here computes a calendar. A caller states which dates a fixture
 * holds, in the order it wants them placed, and gets them back unchanged.
 */

import {
  civilDate,
  coreTimeWindow,
  type CalendarContext,
  type CalendarDay,
  type TimeScale,
  type TimeWindow,
} from '../core/client'

/**
 * A window standing for one period. The instants are inert: a caller asserting
 * on civil bounds should not have to invent epoch milliseconds to do it.
 */
export function coreWindow(
  scale: TimeScale,
  start: string,
  end: string = start,
): TimeWindow {
  return coreTimeWindow({
    id: `${scale}:${start}`,
    scale,
    startMs: 0,
    endMs: 0,
    startDate: civilDate(start),
    endDate: civilDate(end),
    calendarId: 'gregory',
    timeZoneId: 'UTC',
  })
}

/** One placed calendar cell, in or out of the focused month as stated. */
export function coreCalendarDay(
  date: string,
  withinFocusedMonth = true,
): CalendarDay {
  return {
    date: civilDate(date),
    window: coreWindow('day', date),
    withinFocusedMonth,
  }
}

/**
 * A calendar context holding exactly the days it is given. The month defaults
 * to the same days as the week, because most tests care about one or the
 * other rather than about their relationship.
 */
export function coreCalendarContext(
  focusedDate: string,
  week: readonly (string | CalendarDay)[],
  month: readonly (string | CalendarDay)[] = week,
): CalendarContext {
  const placed = (day: string | CalendarDay): CalendarDay =>
    typeof day === 'string' ? coreCalendarDay(day) : day
  return {
    focused: coreWindow('day', focusedDate),
    focusedDate: civilDate(focusedDate),
    week: week.map(placed),
    month: month.map(placed),
  }
}
