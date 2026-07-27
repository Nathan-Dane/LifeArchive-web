/**
 * Locale-aware date and number formatting.
 *
 * The rule this file exists to enforce: **a date is never assembled from
 * translated fragments.** No catalog holds a month name, a weekday name, or a
 * separator, because the order, the punctuation, and the capitalisation of a
 * date differ per locale in ways a phrase with holes cannot express.
 * `Intl.DateTimeFormat` already knows all of that.
 *
 * The other rule: **a civil date has no time zone.** A `CivilDate` is a
 * calendar day the core decided on. Reading it through the device's zone would
 * shift it a day for anyone west of UTC, so every value is formatted as a UTC
 * instant and displayed in UTC. That is not a time-zone assumption — it is the
 * absence of one.
 *
 * Which calendar day something falls on remains a core decision. Nothing here
 * adds, subtracts, compares, or ranges over dates; it only spells them.
 */

import { isCivilDate, type CivilDate } from '../core/client'

/** How much of a date to spell out. */
export type DateStyle = 'long' | 'medium' | 'short'

/** How much of a weekday name to spell out. */
export type WeekdayStyle = 'long' | 'short' | 'narrow'

export interface Formatters {
  /** The locale these formatters resolve against. */
  readonly locale: string
  /** One civil date, in the locale's own wording and order. */
  readonly civilDate: (date: CivilDate | string, style?: DateStyle) => string
  /**
   * The weekday one civil date falls on, named by the platform. A calendar
   * header takes its column names from the days the core placed there, so no
   * weekday name is ever ordered, numbered, or assembled here.
   */
  readonly civilWeekday: (
    date: CivilDate | string,
    style?: WeekdayStyle,
  ) => string
  /**
   * The day-of-month numeral of one civil date, in the locale's own digits.
   * It is read out of the date, never counted towards or away from one.
   */
  readonly civilDayOfMonth: (date: CivilDate | string) => string
  /** The month and year one civil date falls in, in the locale's wording. */
  readonly civilMonthAndYear: (date: CivilDate | string) => string
  /** An inclusive civil-date range, using the locale's own range wording. */
  readonly civilDateRange: (
    start: CivilDate | string,
    end: CivilDate | string,
    style?: DateStyle,
  ) => string
  /** A number, with the locale's own grouping and decimal marks. */
  readonly number: (value: number, options?: Intl.NumberFormatOptions) => string
  /**
   * A count of bytes, scaled to a readable unit. The unit word comes from
   * `Intl`, never from a catalog, for the same reason month names do.
   */
  readonly byteSize: (bytes: number) => string
}

/**
 * The decimal units browsers themselves quote storage in. Binary units would
 * disagree with what the browser's own storage settings show a reader.
 */
const BYTE_UNITS = [
  'byte',
  'kilobyte',
  'megabyte',
  'gigabyte',
  'terabyte',
] as const

const DATE_OPTIONS: Readonly<Record<DateStyle, Intl.DateTimeFormatOptions>> = {
  long: { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' },
  medium: { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' },
  short: { dateStyle: 'short', timeZone: 'UTC' },
}

/**
 * Turns canonical `YYYY-MM-DD` text into the UTC instant that stands for that
 * calendar day. Malformed text throws rather than being coerced: a silently
 * wrong date is worse than a visible failure.
 */
function civilDateAsUtcInstant(date: CivilDate | string): Date {
  if (!isCivilDate(date)) {
    throw new TypeError('Malformed civil date')
  }
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  const instant = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(instant.getTime())) {
    throw new TypeError('Malformed civil date')
  }
  return instant
}

/**
 * Builds the formatters for one locale. `Intl` objects are created once per
 * locale and reused: constructing them is the expensive part.
 */
export function createFormatters(locale: string): Formatters {
  const dateFormats = new Map<string, Intl.DateTimeFormat>()
  const numberFormats = new Map<string, Intl.NumberFormat>()

  const dateFormat = (
    key: string,
    options: Intl.DateTimeFormatOptions,
  ): Intl.DateTimeFormat => {
    const existing = dateFormats.get(key)
    if (existing) return existing
    const created = new Intl.DateTimeFormat(locale, options)
    dateFormats.set(key, created)
    return created
  }

  const styled = (style: DateStyle) => dateFormat(style, DATE_OPTIONS[style])

  const numberFormat = (options?: Intl.NumberFormatOptions) => {
    const key = options ? JSON.stringify(options) : ''
    const existing = numberFormats.get(key)
    if (existing) return existing
    const created = new Intl.NumberFormat(locale, options)
    numberFormats.set(key, created)
    return created
  }

  const formatters: Formatters = {
    locale,
    civilDate: (date, style = 'long') =>
      styled(style).format(civilDateAsUtcInstant(date)),
    civilWeekday: (date, style = 'short') =>
      dateFormat(`weekday:${style}`, {
        weekday: style,
        timeZone: 'UTC',
      }).format(civilDateAsUtcInstant(date)),
    civilDayOfMonth: (date) =>
      dateFormat('dayOfMonth', { day: 'numeric', timeZone: 'UTC' }).format(
        civilDateAsUtcInstant(date),
      ),
    civilMonthAndYear: (date) =>
      dateFormat('monthAndYear', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(civilDateAsUtcInstant(date)),
    civilDateRange: (start, end, style = 'long') =>
      styled(style).formatRange(
        civilDateAsUtcInstant(start),
        civilDateAsUtcInstant(end),
      ),
    number: (value, options) => numberFormat(options).format(value),
    byteSize: (bytes) => {
      const magnitude = bytes >= 1000 ? Math.floor(Math.log10(bytes) / 3) : 0
      const step = Math.min(magnitude, BYTE_UNITS.length - 1)
      return numberFormat({
        style: 'unit',
        unit: BYTE_UNITS[step],
        unitDisplay: 'short',
        maximumFractionDigits: step === 0 ? 0 : 1,
      }).format(bytes / 1000 ** step)
    },
  }
  return Object.freeze(formatters)
}

/**
 * The locale to format in. The browser's preference wins: someone reading
 * English copy still wants their own date order and decimal mark, and that
 * preference is theirs to state, not ours to infer from the served page.
 *
 * This chooses date and number conventions only. The wording always comes from
 * the catalog, and English is the only complete catalog there is.
 */
export function resolveFormattingLocale(): string {
  const preferred = globalThis.navigator?.language?.trim()
  if (preferred) return preferred
  const declared = globalThis.document?.documentElement?.lang?.trim()
  return declared ? declared : 'en'
}
