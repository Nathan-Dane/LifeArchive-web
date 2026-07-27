/**
 * The shape of a message catalog and the types that make it checkable.
 *
 * A catalog is a flat map from a stable dotted key to one complete phrase.
 * Flat and complete are both deliberate:
 *
 * - **Flat**, because a key is an identifier that survives rewording. Nesting
 *   invites callers to reach for a subtree and assemble a sentence from it.
 * - **Complete**, because a translator needs the whole phrase. A sentence
 *   glued together from fragments cannot be reordered, inflected, or given a
 *   different grammatical structure in another language.
 *
 * Nothing here formats a date. Dates and numbers go through `format.ts`, which
 * asks the platform, so no catalog ever needs to hold a month name.
 */

/** The plural categories `Intl.PluralRules` can select. */
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'

/**
 * A message that varies with a count. `other` is mandatory because it is the
 * only category every locale has; the rest are supplied when the locale in
 * question distinguishes them.
 */
export type PluralMessage = {
  readonly other: string
} & Partial<Readonly<Record<Exclude<PluralCategory, 'other'>, string>>>

/** One catalog entry: a phrase, or a phrase per plural category. */
export type MessageEntry = string | PluralMessage

/** A complete set of messages for one locale. */
export type MessageCatalog = Readonly<Record<string, MessageEntry>>

/** The keys of a catalog, as strings. */
export type MessageKey<Catalog extends MessageCatalog> = keyof Catalog & string

/**
 * The placeholder names inside a phrase. `'Opened {count} of {total}'` yields
 * `'count' | 'total'`.
 */
export type Placeholders<Phrase extends string> =
  Phrase extends `${string}{${infer Name}}${infer Rest}`
    ? Name | Placeholders<Rest>
    : never

/**
 * The values an entry needs. A plural entry always needs `count`, even when
 * none of its phrases interpolate it, because the count selects the phrase.
 */
export type EntryValueNames<Entry extends MessageEntry> = Entry extends string
  ? Placeholders<Entry>
  : Entry extends PluralMessage
    ? 'count' | Placeholders<Extract<Entry[keyof Entry], string>>
    : never

/** The values object an entry requires. */
export type MessageValues<Entry extends MessageEntry> = Readonly<
  Record<EntryValueNames<Entry>, string | number>
>

/**
 * The trailing arguments for one message: absent when the phrase needs no
 * values, and required otherwise. A forgotten interpolation is a type error,
 * not a `{name}` visible on screen.
 */
export type MessageArgs<Entry extends MessageEntry> = [
  EntryValueNames<Entry>,
] extends [never]
  ? []
  : [values: MessageValues<Entry>]

/** Values supplied to a key that is only known at runtime. */
export type DynamicValues = Readonly<Record<string, string | number>>

/** True when the entry varies by count. */
export function isPluralMessage(entry: MessageEntry): entry is PluralMessage {
  return typeof entry !== 'string'
}

/**
 * Merges feature catalogs into one, refusing to let a later catalog silently
 * redefine an earlier key. Duplicate keys are how one feature's rewording
 * quietly changes another feature's copy.
 */
export function mergeCatalogs<Catalogs extends readonly MessageCatalog[]>(
  ...catalogs: Catalogs
): MessageCatalog {
  const merged: Record<string, MessageEntry> = {}
  for (const catalog of catalogs) {
    for (const [key, entry] of Object.entries(catalog)) {
      if (key in merged) {
        throw new Error(`Duplicate message key: ${key}`)
      }
      merged[key] = entry
    }
  }
  return Object.freeze(merged)
}
