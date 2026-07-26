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

export interface Formatters {
  /** The locale these formatters resolve against. */
  readonly locale: string
  /** One civil date, in the locale's own wording and order. */
  readonly civilDate: (date: CivilDate | string, style?: DateStyle) => string
  /** An inclusive civil-date range, using the locale's own range wording. */
  readonly civilDateRange: (
    start: CivilDate | string,
    end: CivilDate | string,
    style?: DateStyle,
  ) => string
  /** A number, with the locale's own grouping and decimal marks. */
  readonly number: (value: number, options?: Intl.NumberFormatOptions) => string
}

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
  const dateFormats = new Map<DateStyle, Intl.DateTimeFormat>()
  const numberFormats = new Map<string, Intl.NumberFormat>()

  const dateFormat = (style: DateStyle): Intl.DateTimeFormat => {
    const existing = dateFormats.get(style)
    if (existing) return existing
    const created = new Intl.DateTimeFormat(locale, DATE_OPTIONS[style])
    dateFormats.set(style, created)
    return created
  }

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
      dateFormat(style).format(civilDateAsUtcInstant(date)),
    civilDateRange: (start, end, style = 'long') =>
      dateFormat(style).formatRange(
        civilDateAsUtcInstant(start),
        civilDateAsUtcInstant(end),
      ),
    number: (value, options) => numberFormat(options).format(value),
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
