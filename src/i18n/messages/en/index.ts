/**
 * The English catalog: the one complete locale v0.1.0 ships.
 *
 * Feature catalogs are separate files so a feature's copy can be reviewed with
 * that feature, and they are merged here through `mergeCatalogs`, which throws
 * on a duplicate key rather than letting one feature silently redefine
 * another's wording.
 */

import { mergeCatalogs } from '../../catalog'
import { appMessages } from './app'
import { archiveMessages } from './archive'
import { developmentMessages } from './development'
import { failureMessages } from './failure'
import { recordMessages } from './record'
import { semanticMessages } from './semantic'
import { settingsMessages } from './settings'
import { timelineMessages } from './timeline'

export {
  appMessages,
  archiveMessages,
  developmentMessages,
  failureMessages,
  recordMessages,
  semanticMessages,
  settingsMessages,
  timelineMessages,
}

/** The feature catalogs, in the order they are merged. */
export const FEATURE_CATALOGS = [
  appMessages,
  archiveMessages,
  developmentMessages,
  failureMessages,
  recordMessages,
  semanticMessages,
  settingsMessages,
  timelineMessages,
] as const

/** Every message the application can show, keyed by its stable identifier. */
export type Messages = typeof appMessages &
  typeof archiveMessages &
  typeof developmentMessages &
  typeof failureMessages &
  typeof recordMessages &
  typeof semanticMessages &
  typeof settingsMessages &
  typeof timelineMessages

export const enMessages = mergeCatalogs(...FEATURE_CATALOGS) as Messages

/** The locale this catalog is written in. */
export const CATALOG_LOCALE = 'en'
