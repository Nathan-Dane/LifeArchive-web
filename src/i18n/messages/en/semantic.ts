/**
 * The neutral wording for a semantic ID this build has no name for.
 *
 * Semantic icon and tag IDs are core-owned and open-ended: a newer archive can
 * legitimately contain an ID this frontend has never seen. Such an ID is shown
 * exactly as the core spelled it — never re-cased, translated, guessed at, or
 * replaced by a placeholder — and these phrases are what tells a screen-reader
 * user that the exact text is all this version knows.
 */
export const semanticMessages = {
  'semantic.unknown.icon': 'Unrecognised icon {id}',
  'semantic.unknown.tag': 'Unrecognised tag {id}',
} as const
