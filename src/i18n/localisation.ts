/**
 * The localisation surface: a catalog, a locale, and the two ways to reach a
 * phrase.
 *
 * `t` is for keys known at build time. It is typed against the catalog, so a
 * key that does not exist and a forgotten interpolation value are both type
 * errors, and at runtime it *throws* on a missing key rather than rendering a
 * key name, an empty string, or `{name}`. A missing message is a bug in this
 * repository, not a condition a person should have to read past — and a route
 * error boundary already turns a thrown error into a calm, non-destructive
 * screen.
 *
 * `resolve` is for keys only known at runtime — a core failure code, a
 * semantic ID from a newer archive. It returns `null` instead of throwing,
 * because those keys legitimately may not exist, and the caller supplies the
 * fallback.
 */

import {
  isPluralMessage,
  type DynamicValues,
  type MessageArgs,
  type MessageCatalog,
  type MessageEntry,
  type MessageKey,
  type PluralCategory,
} from './catalog'
import {
  createFormatters,
  type DateFormatPreference,
  type Formatters,
} from './format'

/** Thrown when a build-time key is not in the catalog. */
export class MissingMessageError extends Error {
  readonly key: string

  constructor(key: string) {
    super(`Missing message: ${key}`)
    this.name = 'MissingMessageError'
    this.key = key
  }
}

/** Thrown when a phrase has a placeholder the caller supplied no value for. */
export class MissingMessageValueError extends Error {
  readonly key: string
  readonly placeholder: string

  constructor(key: string, placeholder: string) {
    super(`Missing value "${placeholder}" for message: ${key}`)
    this.name = 'MissingMessageValueError'
    this.key = key
    this.placeholder = placeholder
  }
}

/** Looks up a catalog key that is known at build time. */
export interface Translator<Catalog extends MessageCatalog> {
  <Key extends MessageKey<Catalog>>(
    key: Key,
    ...args: MessageArgs<Catalog[Key]>
  ): string
}

export interface Localisation<Catalog extends MessageCatalog = MessageCatalog> {
  /** The locale used for plural selection and for dates and numbers. */
  readonly locale: string
  /** The catalog in use. Its own language, which may differ from `locale`. */
  readonly catalog: Catalog
  readonly t: Translator<Catalog>
  /** True when the catalog has a phrase for a runtime-supplied key. */
  readonly has: (key: string) => boolean
  /** A runtime-supplied key, or `null` when the catalog has no phrase. */
  readonly resolve: (key: string, values?: DynamicValues) => string | null
  readonly format: Formatters
}

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_]*)\}/g

function selectPlural(
  locale: string,
  entry: Exclude<MessageEntry, string>,
  count: number,
): string {
  if (count === 0 && entry.zero !== undefined) return entry.zero
  const category = new Intl.PluralRules(locale).select(count) as PluralCategory
  return entry[category] ?? entry.other
}

function interpolate(
  key: string,
  phrase: string,
  values: DynamicValues,
  format: Formatters,
): string {
  return phrase.replace(PLACEHOLDER, (_match, name: string) => {
    const value = values[name]
    if (value === undefined) {
      throw new MissingMessageValueError(key, name)
    }
    return typeof value === 'number' ? format.number(value) : value
  })
}

function renderEntry(
  locale: string,
  key: string,
  entry: MessageEntry,
  values: DynamicValues,
  format: Formatters,
): string {
  if (!isPluralMessage(entry)) {
    return interpolate(key, entry, values, format)
  }
  const count = values.count
  if (typeof count !== 'number') {
    throw new MissingMessageValueError(key, 'count')
  }
  return interpolate(key, selectPlural(locale, entry, count), values, format)
}

const NO_VALUES: DynamicValues = Object.freeze({})

/**
 * Builds the localisation surface for one locale and catalog.
 *
 * The locale and the catalog are separate arguments on purpose. English is the
 * only complete catalog v0.1.0 has, but someone reading it is still entitled
 * to their own date order, decimal mark, and plural rules.
 */
export function createLocalisation<Catalog extends MessageCatalog>(
  locale: string,
  catalog: Catalog,
  datePreference: DateFormatPreference = 'regional',
): Localisation<Catalog> {
  const format = createFormatters(locale, datePreference)

  const render = (key: string, values: DynamicValues): string | null => {
    const entry = Object.hasOwn(catalog, key) ? catalog[key] : undefined
    if (entry === undefined) return null
    return renderEntry(locale, key, entry, values, format)
  }

  const t = ((key: string, values?: DynamicValues) => {
    const rendered = render(key, values ?? NO_VALUES)
    if (rendered === null) throw new MissingMessageError(key)
    return rendered
  }) as Translator<Catalog>

  return Object.freeze({
    locale,
    catalog,
    t,
    has: (key: string) => Object.hasOwn(catalog, key),
    resolve: (key: string, values?: DynamicValues) =>
      render(key, values ?? NO_VALUES),
    format,
  })
}
