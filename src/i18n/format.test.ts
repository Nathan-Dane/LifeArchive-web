import { describe, expect, it } from 'vitest'
import { civilDate } from '../core/client'
import { createFormatters, resolveFormattingLocale } from './format'
import { enMessages } from './messages/en'

const NEW_YEAR = civilDate('2024-01-01')
const MARCH_NINTH = civilDate('2024-03-09')
const MARCH_TWELFTH = civilDate('2024-03-12')

describe('civil dates', () => {
  it('spells a date in the locale s own order and wording', () => {
    expect(createFormatters('en-GB').civilDate(MARCH_NINTH)).toBe(
      '9 March 2024',
    )
    expect(createFormatters('en-US').civilDate(MARCH_NINTH)).toBe(
      'March 9, 2024',
    )
    expect(createFormatters('da-DK').civilDate(MARCH_NINTH)).toBe(
      '9. marts 2024',
    )
  })

  it('offers shorter forms without changing the day', () => {
    expect(createFormatters('en-GB').civilDate(MARCH_NINTH, 'short')).toBe(
      '09/03/2024',
    )
    expect(createFormatters('en-GB').civilDate(MARCH_NINTH, 'medium')).toBe(
      '9 Mar 2024',
    )
  })

  it('never shifts the day for the device time zone', () => {
    for (const locale of ['en-CA', 'sv-SE']) {
      expect(createFormatters(locale).civilDate(NEW_YEAR, 'short')).toBe(
        '2024-01-01',
      )
    }
  })

  it('uses the locale s own range wording rather than a joined pair', () => {
    const range = createFormatters('en-GB').civilDateRange(
      MARCH_NINTH,
      MARCH_TWELFTH,
    )
    expect(range).toContain('9')
    expect(range).toContain('12 March 2024')
    expect(range).not.toBe('9 March 2024 12 March 2024')
    expect(
      createFormatters('en-GB').civilCompactDateRange(
        MARCH_NINTH,
        MARCH_TWELFTH,
      ),
    ).toMatch(/^9.*12 Mar$/)
  })

  it('refuses malformed date text instead of guessing', () => {
    const formatters = createFormatters('en-GB')
    for (const value of ['9 March 2024', '2024-3-9', '', 'today']) {
      expect(() => formatters.civilDate(value)).toThrow(TypeError)
    }
  })
})

describe('the parts a calendar cell shows', () => {
  it('names the weekday of a date the locale s own way', () => {
    expect(createFormatters('en-GB').civilWeekday(MARCH_NINTH)).toBe('Sat')
    expect(createFormatters('en-GB').civilWeekday(MARCH_NINTH, 'long')).toBe(
      'Saturday',
    )
    expect(createFormatters('da-DK').civilWeekday(MARCH_NINTH, 'long')).toBe(
      'lørdag',
    )
  })

  it('reads the day-of-month numeral out of the date', () => {
    expect(createFormatters('en-GB').civilDayOfMonth(NEW_YEAR)).toBe('1')
    expect(createFormatters('en-GB').civilDayOfMonth(MARCH_TWELFTH)).toBe('12')
  })

  it('spells the month and year a date falls in', () => {
    expect(createFormatters('en-GB').civilMonth(MARCH_NINTH)).toBe('Mar')
    expect(createFormatters('en-GB').civilMonth(MARCH_NINTH, 'long')).toBe(
      'March',
    )
    expect(createFormatters('en-GB').civilMonthAndYear(MARCH_NINTH)).toBe(
      'March 2024',
    )
    expect(createFormatters('da-DK').civilMonthAndYear(MARCH_NINTH)).toBe(
      'marts 2024',
    )
    expect(createFormatters('en-GB').civilYear(MARCH_NINTH)).toBe('2024')
  })

  it('reads every part in UTC, so no part shifts with the device zone', () => {
    const formatters = createFormatters('en-GB')
    expect(formatters.civilDayOfMonth(NEW_YEAR)).toBe('1')
    expect(formatters.civilMonth(NEW_YEAR, 'long')).toBe('January')
    expect(formatters.civilMonthAndYear(NEW_YEAR)).toBe('January 2024')
    expect(formatters.civilYear(NEW_YEAR)).toBe('2024')
    expect(formatters.civilWeekday(NEW_YEAR, 'long')).toBe('Monday')
  })

  it('refuses malformed date text for every part', () => {
    const formatters = createFormatters('en-GB')
    for (const value of ['9 March 2024', '2024-3-9', '', 'today']) {
      expect(() => formatters.civilWeekday(value)).toThrow(TypeError)
      expect(() => formatters.civilDayOfMonth(value)).toThrow(TypeError)
      expect(() => formatters.civilMonth(value)).toThrow(TypeError)
      expect(() => formatters.civilMonthAndYear(value)).toThrow(TypeError)
      expect(() => formatters.civilYear(value)).toThrow(TypeError)
      expect(() => formatters.civilCompactDateRange(value, NEW_YEAR)).toThrow(
        TypeError,
      )
    }
  })
})

describe('numbers', () => {
  it('uses the locale s own grouping and decimal marks', () => {
    expect(createFormatters('en-GB').number(1234.5)).toBe('1,234.5')
    expect(createFormatters('da-DK').number(1234.5)).toBe('1.234,5')
  })

  it('passes number options through', () => {
    expect(createFormatters('en-GB').number(0.25, { style: 'percent' })).toBe(
      '25%',
    )
  })
})

describe('byte counts', () => {
  it('scales to a readable unit without rounding small counts away', () => {
    const format = createFormatters('en-GB')
    expect(format.byteSize(0)).toBe('0 byte')
    expect(format.byteSize(999)).toBe('999 byte')
    expect(format.byteSize(1500)).toBe('1.5 kB')
    expect(format.byteSize(5_000_000_000)).toBe('5 GB')
  })

  it('stops at the largest unit rather than inventing one', () => {
    expect(createFormatters('en-GB').byteSize(9e15)).toBe('9,000 TB')
  })

  it('takes its unit word and decimal mark from the locale', () => {
    expect(createFormatters('da-DK').byteSize(1500)).toBe('1,5 kB')
  })
})

describe('the formatting locale', () => {
  it('resolves to something Intl accepts', () => {
    expect(
      () => new Intl.DateTimeFormat(resolveFormattingLocale()),
    ).not.toThrow()
  })
})

describe('the catalog and dates', () => {
  /**
   * The point of `format.ts` is that no catalog ever needs a month name. If one
   * appears, a date is being assembled from fragments somewhere.
   */
  it('holds no month name, weekday name, or date fragment', () => {
    const fragments = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]
    const phrases = Object.values(enMessages).flatMap((entry: unknown) =>
      typeof entry === 'string'
        ? [entry]
        : Object.values(entry as object).filter(
            (phrase): phrase is string => typeof phrase === 'string',
          ),
    )
    for (const phrase of phrases) {
      for (const fragment of fragments) {
        expect(phrase, `"${phrase}" contains ${fragment}`).not.toContain(
          fragment,
        )
      }
    }
    for (const key of Object.keys(enMessages)) {
      expect(key).not.toMatch(/\.(month|weekday|dayName|monthName)\b/)
    }
  })
})
