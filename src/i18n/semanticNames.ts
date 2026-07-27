/**
 * Naming a core-owned semantic ID.
 *
 * The core owns semantic icon and tag IDs; the presentation layer owns their
 * names. Record and Timeline put those names in their own catalogs under
 * `record.semantic.icon.<id>` and `timeline.semantic.tag.<id>` — this file is
 * only the lookup, so no feature has to reimplement the unknown-ID rule.
 *
 * That rule: **an ID this build has no name for stays exactly as the core
 * spelled it.** It is not re-cased, transliterated, humanised, truncated, or
 * replaced by a placeholder, because it may be the only thing distinguishing
 * two markings in an archive written by a newer version. What the catalog does
 * supply for such an ID is a neutral accessible name saying that the exact
 * text is all this version knows.
 */

import type { SemanticId } from '../core/client'
import type { AppLocalisation } from './context'

/** Which family of semantic ID is being named. */
export type SemanticKind = 'icon' | 'tag'

export interface SemanticName {
  /** What to display. The exact ID when this build has no name for it. */
  readonly text: string
  /** What a screen reader should announce. */
  readonly accessibleName: string
  /** False when the text is the raw ID rather than a name. */
  readonly recognised: boolean
}

/** The catalog key a feature uses to name one semantic ID. */
export function semanticNameKey(
  owner: string,
  kind: SemanticKind,
  id: SemanticId,
): string {
  return `${owner}.semantic.${kind}.${id}`
}

/**
 * Resolves the name for one semantic ID.
 *
 * `owner` is the catalog namespace of the feature that owns the naming —
 * `'record'` or `'timeline'`.
 */
export function semanticName(
  localisation: AppLocalisation,
  owner: string,
  kind: SemanticKind,
  id: SemanticId,
): SemanticName {
  const named = localisation.resolve(semanticNameKey(owner, kind, id))
  if (named !== null) {
    return { text: named, accessibleName: named, recognised: true }
  }
  const accessibleName =
    localisation.resolve(`semantic.unknown.${kind}`, { id }) ?? id
  return { text: id, accessibleName, recognised: false }
}
