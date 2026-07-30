/**
 * One Record destination, shared by the three regions that show it.
 *
 * Record occupies the whole workspace: time navigation on one edge, the
 * writing surface in the middle, the details of what is selected on the other.
 * All three describe **one** position — a scale, a civil location, and either
 * the ordinary entry or one exact object ID — so the state that holds it lives
 * above them rather than inside any one of them. Two of these regions owning
 * two cursors is exactly the competing-state defect the feature is designed
 * against.
 *
 * The context has no default. A Record region rendered without the provider is
 * a composition mistake, not a state a reader can reach, and it says so rather
 * than quietly presenting a second empty cursor.
 */

import { createContext, useContext } from 'react'
import type { LifeArchiveClient, StableId } from '../../core/client'
import type { TemporalCursor } from './navigation/temporalCursor'
import type { RecordObjects } from './objects/recordObjects'
import type { EventEditor } from './events'
import type { SpanEditor } from './spans'
import type { Tracks } from './tracks'

export interface RecordNavigationSummary {
  readonly ordinary: {
    readonly windowId: string
    readonly text: string
    readonly mediaCount: number | null
  } | null
  readonly structuredMediaCounts: ReadonlyMap<StableId, number>
  readonly reportOrdinaryText: (windowId: string, text: string) => void
  readonly reportMediaCount: (
    ownerId: StableId,
    count: number,
    ordinaryWindowId?: string,
  ) => void
}

export interface RecordDestination {
  readonly client: LifeArchiveClient
  readonly developmentMock: boolean
  readonly cursor: TemporalCursor
  readonly objects: RecordObjects
  readonly events: EventEditor
  readonly spans: SpanEditor
  readonly tracks: Tracks
  readonly navigationSummary: RecordNavigationSummary
}

export const RecordDestinationContext = createContext<RecordDestination | null>(
  null,
)

export function useRecordDestination(): RecordDestination {
  const destination = useContext(RecordDestinationContext)
  if (!destination) {
    throw new Error('Record regions must be composed inside Record')
  }
  return destination
}
