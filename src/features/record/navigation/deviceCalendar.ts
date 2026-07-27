/**
 * The three device facts core time navigation takes as inputs.
 *
 * All three are **observed, never computed**: which zone the reader is in,
 * which week conventions their locale uses, and which civil day it currently
 * is for them. Reading the clock is not calendar work — containment,
 * traversal, week numbering, month placement, and every bound belong to the
 * core, and a second implementation of any of them in this repository would
 * drift from the archive it is describing.
 *
 * So nothing here adds, subtracts, compares, or ranges over a date. The one
 * date this module produces is the one the platform says it is right now, and
 * it is produced from `Intl` parts rather than assembled from a `Date`'s
 * components, so it is the reader's civil day rather than the runtime's.
 */

import { civilDate, type CivilDate, type WeekRules } from '../../../core/client'

/**
 * ISO-8601 week conventions: weeks begin on Monday and the first week of a
 * year is the one holding at least four of its days. Used only when the
 * platform declines to state the reader's own conventions — it is a stated
 * fallback, not an assumption about anybody's calendar.
 */
export const ISO_WEEK_RULES: WeekRules = Object.freeze({
  firstWeekday: 1,
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

/** What `Intl.Locale` reports about a locale's week, where it reports it. */
interface LocaleWeekInfo {
  readonly firstDay: number
  readonly minimalDays: number
}

type LocaleWithWeekInfo = Intl.Locale & {
  readonly getWeekInfo?: () => LocaleWeekInfo
  readonly weekInfo?: LocaleWeekInfo
}

function localeWeekRules(locale: string): WeekRules {
  try {
    const resolved = new Intl.Locale(locale) as LocaleWithWeekInfo
    const info = resolved.getWeekInfo?.() ?? resolved.weekInfo
    if (
      !info ||
      !Number.isInteger(info.firstDay) ||
      !Number.isInteger(info.minimalDays)
    ) {
      return ISO_WEEK_RULES
    }
    return Object.freeze({
      firstWeekday: info.firstDay,
      minimumDaysInFirstWeek: info.minimalDays,
    })
  } catch {
    return ISO_WEEK_RULES
  }
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
  /** The locale whose week conventions apply. Defaults to the platform's. */
  readonly locale?: string
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
  const locale =
    options.locale ?? new Intl.DateTimeFormat().resolvedOptions().locale
  const now = options.now ?? (() => new Date())
  return Object.freeze({
    timeZoneId,
    weekRules: localeWeekRules(locale),
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
