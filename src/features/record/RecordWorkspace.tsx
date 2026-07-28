/**
 * Record's three regions, and the one destination behind them.
 *
 * The provider builds the temporal cursor and the object selection once and
 * hands both to whichever regions the workspace mounts. The regions themselves
 * are thin on purpose: routing composes regions, and a region that reached for
 * the client itself would be a second place the destination could come from.
 */

import type { ReactNode } from 'react'
import type { LifeArchiveClient } from '../../core/client'
import { RecordNavigationPanel } from './navigation/RecordNavigationPanel'
import {
  useTemporalCursor,
  type TemporalCursorOptions,
} from './navigation/temporalCursor'
import { RecordObjectDetails } from './objects/RecordObjectDetails'
import { useRecordObjects } from './objects/recordObjects'
import {
  RecordDestinationContext,
  useRecordDestination,
} from './recordDestination'

export interface RecordDestinationProviderProps {
  readonly client: LifeArchiveClient
  readonly children: ReactNode
  readonly cursorOptions?: TemporalCursorOptions
}

export function RecordDestinationProvider({
  client,
  children,
  cursorOptions,
}: RecordDestinationProviderProps) {
  const cursor = useTemporalCursor(client, cursorOptions)
  /*
   * Only a settled cursor has a window worth asking about. The panel keeps the
   * previous answer on screen while a newer one is in flight, which is right
   * for a calendar and wrong here: objects listed for the window being left
   * would be reconciled against a selection that belongs to the one being
   * arrived at, and an object followed to its own day would look missing on
   * the way there.
   */
  const settled = cursor.state.status === 'ready'
  const objects = useRecordObjects(client, {
    window: settled ? (cursor.state.view?.window ?? null) : null,
    goTo: cursor.goTo,
  })
  return (
    <RecordDestinationContext.Provider value={{ cursor, objects }}>
      {children}
    </RecordDestinationContext.Provider>
  )
}

/** Record's leading workspace region: where in time the reader is. */
export function RecordNavigationRegion() {
  const { cursor } = useRecordDestination()
  return <RecordNavigationPanel cursor={cursor} />
}

/** Record's trailing workspace region: what is selected. */
export function RecordDetailsRegion() {
  const { cursor, objects } = useRecordDestination()
  return (
    <RecordObjectDetails
      scale={cursor.state.scale}
      window={cursor.state.view?.window ?? null}
      objects={objects}
    />
  )
}
