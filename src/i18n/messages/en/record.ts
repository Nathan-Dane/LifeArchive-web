/**
 * Record copy.
 *
 * Record owns the presentation names for the semantic icon and tag IDs it
 * displays: the core supplies the ID, this catalog supplies the word. There
 * are no approved semantic IDs in v0.1.0 yet, so the only entry is the page
 * itself; an ID without a name here stays exact on screen and takes the
 * neutral fallback in `semantic.ts`.
 */
export const recordMessages = {
  'record.page.title': 'Record',
} as const
