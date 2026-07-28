/**
 * Record's three regions, and the one destination behind them.
 *
 * The provider builds the temporal cursor and the object selection once and
 * hands both to whichever regions the workspace mounts. The regions themselves
 * are thin on purpose: routing composes regions, and a region that reached for
 * the client itself would be a second place the destination could come from.
 */

import { useMemo, type ReactNode } from 'react'
import type { LifeArchiveClient } from '../../core/client'
import { useEventEditor } from './events'
import { useSpanEditor } from './spans'
import { RecordNavigationPanel } from './navigation/RecordNavigationPanel'
import {
  useTemporalCursor,
  type TemporalCursorOptions,
} from './navigation/temporalCursor'
import { RecordObjectDetails } from './objects/RecordObjectDetails'
import { RecordObjectSwitcher } from './objects/RecordObjectSwitcher'
import { useRecordObjects } from './objects/recordObjects'
import {
  RecordDestinationContext,
  useRecordDestination,
} from './recordDestination'
import {
  RecordDraftSessionContext,
  useRecordDraftSessionGuard,
} from './recordDraftSession'

export interface RecordDestinationProviderProps {
  readonly client: LifeArchiveClient
  readonly developmentMock?: boolean
  readonly children: ReactNode
  readonly cursorOptions?: TemporalCursorOptions
}

export function RecordDestinationProvider({
  client,
  developmentMock = false,
  children,
  cursorOptions,
}: RecordDestinationProviderProps) {
  const draftSession = useRecordDraftSessionGuard()
  const rawCursor = useTemporalCursor(client, cursorOptions)
  const guard = draftSession.flushBefore
  const cursor = useMemo(
    () => ({
      ...rawCursor,
      chooseScale: (scale: Parameters<typeof rawCursor.chooseScale>[0]) =>
        guard(() => rawCursor.chooseScale(scale)),
      step: (step: Parameters<typeof rawCursor.step>[0]) =>
        guard(() => rawCursor.step(step)),
      goToToday: () => guard(rawCursor.goToToday),
      selectDate: (date: Parameters<typeof rawCursor.selectDate>[0]) =>
        guard(() => rawCursor.selectDate(date)),
      goTo: (destination: Parameters<typeof rawCursor.goTo>[0]) =>
        guard(() => rawCursor.goTo(destination)),
    }),
    [guard, rawCursor],
  )
  /*
   * Only a settled cursor has a window worth asking about. The panel keeps the
   * previous answer on screen while a newer one is in flight, which is right
   * for a calendar and wrong here: objects listed for the window being left
   * would be reconciled against a selection that belongs to the one being
   * arrived at, and an object followed to its own day would look missing on
   * the way there.
   */
  const settled = cursor.state.status === 'ready'
  const rawObjects = useRecordObjects(client, {
    window: settled ? (cursor.state.view?.window ?? null) : null,
    goTo: rawCursor.goTo,
  })
  const rawEvents = useEventEditor(client, {
    selected: rawObjects.state.selected,
    developmentMock,
    register: draftSession.register,
    onCreated: rawObjects.selectCreated,
    onChanged: rawObjects.replaceObject,
    onDeleted: rawObjects.removeObject,
    refreshObjects: rawObjects.retry,
  })
  const rawSpans = useSpanEditor(client, {
    selected: rawObjects.state.selected,
    developmentMock,
    register: draftSession.register,
    onCreated: rawObjects.selectCreated,
    onChanged: rawObjects.replaceObject,
    onDeleted: rawObjects.removeObject,
    refreshObjects: rawObjects.retry,
  })
  const events = useMemo(
    () => ({
      ...rawEvents,
      startCreate: (date: Parameters<typeof rawEvents.startCreate>[0]) =>
        guard(() => rawEvents.startCreate(date)),
    }),
    [guard, rawEvents],
  )
  const spans = useMemo(
    () => ({
      ...rawSpans,
      startCreate: (date: Parameters<typeof rawSpans.startCreate>[0]) =>
        guard(() => rawSpans.startCreate(date)),
    }),
    [guard, rawSpans],
  )
  const objects = useMemo(
    () => ({
      ...rawObjects,
      selectOrdinary: () => guard(rawObjects.selectOrdinary),
      selectObject: (object: Parameters<typeof rawObjects.selectObject>[0]) =>
        guard(() => rawObjects.selectObject(object)),
      goToObject: (object: Parameters<typeof rawObjects.goToObject>[0]) =>
        guard(() => rawObjects.goToObject(object)),
    }),
    [guard, rawObjects],
  )
  return (
    <RecordDraftSessionContext.Provider
      value={{ register: draftSession.register }}
    >
      <RecordDestinationContext.Provider
        value={{ client, developmentMock, cursor, objects, events, spans }}
      >
        {children}
      </RecordDestinationContext.Provider>
    </RecordDraftSessionContext.Provider>
  )
}

/** Record's leading workspace region: where in time and what is selected. */
export function RecordNavigationRegion() {
  const { cursor, objects, events, spans } = useRecordDestination()
  return (
    <div className="record-navigation-region">
      <RecordNavigationPanel cursor={cursor} />
      <RecordObjectSwitcher
        scale={cursor.state.scale}
        window={cursor.state.view?.window ?? null}
        objects={objects}
        creatingEvent={events.creating}
        creatingSpan={spans.creating}
        onCreateEvent={() => {
          const date = cursor.state.view?.calendar.focusedDate
          if (date) events.startCreate(date)
        }}
        onCreateSpan={() => {
          const date = cursor.state.view?.calendar.focusedDate
          if (date) spans.startCreate(date)
        }}
      />
    </div>
  )
}

/** Record's trailing workspace region: what is selected. */
export function RecordDetailsRegion() {
  const { cursor, objects, events, spans } = useRecordDestination()
  return (
    <RecordObjectDetails
      scale={cursor.state.scale}
      window={cursor.state.view?.window ?? null}
      objects={objects}
      event={events}
      span={spans}
    />
  )
}
