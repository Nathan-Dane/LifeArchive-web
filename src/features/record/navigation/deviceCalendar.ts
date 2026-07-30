/**
 * The device facts and archive policy core time navigation takes as inputs.
 *
 * The zone and civil day are **observed, never computed**. Archive 0.4.1 does
 * not persist the week rules that formed an ordinary week entry, so web 0.1
 * uses one explicit ISO policy instead of making durable span identity depend
 * on whichever browser locale happens to open the archive. Reading the clock
 * is not calendar work — containment, traversal, week numbering, month
 * placement, and every bound belong to the core, and a second implementation
 * of any of them in this repository would drift from the archive it describes.
 *
 * So nothing here adds, subtracts, compares, or ranges over a date. The one
 * date this module produces is the one the platform says it is right now, and
 * it is produced from `Intl` parts rather than assembled from a `Date`'s
 * components, so it is the reader's civil day rather than the runtime's.
 */

import { civilDate, type CivilDate, type WeekRules } from '../../../core/client'

/**
 * ISO-8601 week conventions in the Foundation numbering required by the core:
 * Sunday is 1, so Monday is 2. The first week of a year holds at least four of
 * its days.
 */
export const ISO_WEEK_RULES: WeekRules = Object.freeze({
  firstWeekday: 2,
  minimumDaysInFirstWeek: 4,
})

/** The zone used when the platform names none. */
const FALLBACK_TIME_ZONE = 'UTC'

export interface DeviceCalendar {
  /** The IANA zone the reader's civil days are measured in. */
  readonly timeZoneId: string
  /** The week conventions passed to every core time operation. */
  readonly weekRules: WeekRules
  /** The civil day it is on this device now, read afresh at each call. */
  readonly today: () => CivilDate
}

function resolveTimeZone(): string {
  try {
    return (
      new Intl.DateTimeFormat().resolvedOptions().timeZone ?? FALLBACK_TIME_ZONE
    )
  } catch {
    return FALLBACK_TIME_ZONE
  }
}

/**
 * The civil day `instant` falls on in `timeZoneId`.
 *
 * The year, month, and day come from `Intl` in the Gregorian calendar with
 * Latin digits, so the result is canonical `YYYY-MM-DD` for every reader
 * regardless of the calendar or numbering system their locale prefers.
 */
export function civilDateOf(instant: Date, timeZoneId: string): CivilDate {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timeZoneId,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? ''
  const year = part('year').padStart(4, '0')
  return civilDate(`${year}-${part('month')}-${part('day')}`)
}

export interface DeviceCalendarOptions {
  /** The zone civil days are read in. Defaults to the platform's. */
  readonly timeZoneId?: string
  /** The clock. Injected so a test observes a chosen day, not the real one. */
  readonly now?: () => Date
}

/** Builds the device facts, reading the platform for anything not supplied. */
export function createDeviceCalendar(
  options: DeviceCalendarOptions = {},
): DeviceCalendar {
  const timeZoneId = options.timeZoneId ?? resolveTimeZone()
  const now = options.now ?? (() => new Date())
  return Object.freeze({
    timeZoneId,
    weekRules: ISO_WEEK_RULES,
    today: () => civilDateOf(now(), timeZoneId),
  })
}

let shared: DeviceCalendar | null = null

/**
 * The device facts the application uses. Built on first use rather than at
 * import, so reading the platform is never a module side effect, and cached so
 * that every effect depending on it sees one stable identity.
 */
export function deviceCalendar(): DeviceCalendar {
  shared ??= createDeviceCalendar()
  return shared
}

/** Test seam: forget the cached facts so a new platform reading is taken. */
export function resetDeviceCalendar(): void {
  shared = null
}
