import { describe, expect, it } from 'vitest'
import {
  createLocalisation,
  MissingMessageError,
  MissingMessageValueError,
} from './localisation'
import { mergeCatalogs } from './catalog'

/**
 * A fixture catalog rather than the product one. Plurals and interpolation are
 * mechanisms this file has to prove; inventing product copy to exercise them
 * would put phrases in the shipped catalog that nothing shows.
 */
const FIXTURE = {
  'fixture.plain': 'Nothing to interpolate',
  'fixture.greeting': 'Hello {name}',
  'fixture.two': '{first} and {second}',
  'fixture.entries': {
    one: '{count} entry',
    other: '{count} entries',
  },
  'fixture.withZero': {
    zero: 'No entries yet',
    one: '{count} entry',
    other: '{count} entries',
  },
  'fixture.countless': {
    one: 'One thing',
    other: 'Several things',
  },
} as const

function localisation(locale = 'en-GB') {
  return createLocalisation(locale, FIXTURE)
}

describe('catalog lookup', () => {
  it('returns the phrase for a key', () => {
    expect(localisation().t('fixture.plain')).toBe('Nothing to interpolate')
  })

  it('fails loudly for a key the catalog does not have', () => {
    const lookup = localisation().t as (key: string) => string
    expect(() => lookup('fixture.absent')).toThrow(MissingMessageError)
    expect(() => lookup('fixture.absent')).toThrow(/fixture\.absent/)
  })

  it('resolves a runtime key to null instead of throwing', () => {
    expect(localisation().resolve('fixture.absent')).toBeNull()
    expect(localisation().resolve('fixture.plain')).toBe(
      'Nothing to interpolate',
    )
    expect(localisation().has('fixture.absent')).toBe(false)
    expect(localisation().has('fixture.plain')).toBe(true)
  })

  it('does not mistake inherited object properties for messages', () => {
    const lookup = localisation().t as (key: string) => string
    expect(() => lookup('toString')).toThrow(MissingMessageError)
    expect(localisation().has('constructor')).toBe(false)
  })
})

describe('interpolation', () => {
  it('substitutes every placeholder', () => {
    expect(localisation().t('fixture.greeting', { name: 'Ada' })).toBe(
      'Hello Ada',
    )
    expect(
      localisation().t('fixture.two', { first: 'one', second: 'other' }),
    ).toBe('one and other')
  })

  it('fails loudly rather than rendering a placeholder', () => {
    const lookup = localisation().t as (
      key: string,
      values: Record<string, string | number>,
    ) => string
    expect(() => lookup('fixture.greeting', {})).toThrow(
      MissingMessageValueError,
    )
    expect(() => lookup('fixture.greeting', {})).toThrow(/name/)
  })

  it('formats interpolated numbers for the locale', () => {
    expect(
      createLocalisation('en-GB', FIXTURE).t('fixture.entries', {
        count: 1234,
      }),
    ).toBe('1,234 entries')
    expect(
      createLocalisation('da-DK', FIXTURE).t('fixture.entries', {
        count: 1234,
      }),
    ).toBe('1.234 entries')
  })
})

describe('plurals', () => {
  it('selects the English categories', () => {
    const t = localisation().t
    expect(t('fixture.entries', { count: 1 })).toBe('1 entry')
    expect(t('fixture.entries', { count: 0 })).toBe('0 entries')
    expect(t('fixture.entries', { count: 7 })).toBe('7 entries')
  })

  it('prefers an explicit zero phrase over the plural rule', () => {
    const t = localisation().t
    expect(t('fixture.withZero', { count: 0 })).toBe('No entries yet')
    expect(t('fixture.withZero', { count: 1 })).toBe('1 entry')
  })

  it('follows the locale, not English', () => {
    const polish = createLocalisation('pl-PL', {
      'fixture.files': {
        one: '{count} plik',
        few: '{count} pliki',
        many: '{count} plików',
        other: '{count} pliku',
      },
    } as const)
    expect(polish.t('fixture.files', { count: 1 })).toBe('1 plik')
    expect(polish.t('fixture.files', { count: 3 })).toBe('3 pliki')
    expect(polish.t('fixture.files', { count: 12 })).toBe('12 plików')
  })

  it('falls back to other when the locale needs a category the catalog omits', () => {
    const polish = createLocalisation('pl-PL', FIXTURE)
    expect(polish.t('fixture.entries', { count: 3 })).toBe('3 entries')
  })

  it('requires a count even when no phrase interpolates it', () => {
    const t = localisation().t
    expect(t('fixture.countless', { count: 1 })).toBe('One thing')
    expect(t('fixture.countless', { count: 4 })).toBe('Several things')

    const lookup = t as (key: string, values: Record<string, string>) => string
    expect(() => lookup('fixture.countless', { count: 'two' })).toThrow(
      MissingMessageValueError,
    )
  })
})

describe('catalog composition', () => {
  it('merges feature catalogs', () => {
    expect(mergeCatalogs({ 'a.one': 'One' }, { 'b.two': 'Two' })).toStrictEqual(
      { 'a.one': 'One', 'b.two': 'Two' },
    )
  })

  it('refuses to let one catalog redefine another key', () => {
    expect(() =>
      mergeCatalogs({ 'a.one': 'One' }, { 'a.one': 'Something else' }),
    ).toThrow(/Duplicate message key: a\.one/)
  })
})
