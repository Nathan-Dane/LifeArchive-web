/**
 * Record's three regions, and the one destination behind them.
 *
 * The provider builds the temporal cursor and the object selection once and
 * hands both to whichever regions the workspace mounts. The regions themselves
 * are thin on purpose: routing composes regions, and a region that reached for
 * the client itself would be a second place the destination could come from.
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { LifeArchiveClient, StableId } from '../../core/client'
import { useWorkspacePanels } from '../../app/shell'
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
import { useTracks } from './tracks'

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
  const [ordinaryNavigation, setOrdinaryNavigation] = useState<{
    readonly windowId: string
    readonly text: string
    readonly mediaCount: number | null
  } | null>(null)
  const [structuredMediaCounts, setStructuredMediaCounts] = useState<
    ReadonlyMap<StableId, number>
  >(() => new Map())
  const reportOrdinaryText = useCallback((windowId: string, text: string) => {
    setOrdinaryNavigation((current) => {
      if (current?.windowId === windowId && current.text === text)
        return current
      return {
        windowId,
        text,
        mediaCount: current?.windowId === windowId ? current.mediaCount : null,
      }
    })
  }, [])
  const reportMediaCount = useCallback(
    (ownerId: StableId, count: number, ordinaryWindowId?: string) => {
      if (ordinaryWindowId) {
        setOrdinaryNavigation((current) => {
          if (
            current?.windowId === ordinaryWindowId &&
            current.mediaCount === count
          ) {
            return current
          }
          return {
            windowId: ordinaryWindowId,
            text: current?.windowId === ordinaryWindowId ? current.text : '',
            mediaCount: count,
          }
        })
        return
      }
      setStructuredMediaCounts((current) => {
        if (current.get(ownerId) === count) return current
        const next = new Map(current)
        next.set(ownerId, count)
        return next
      })
    },
    [],
  )
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
  const rawTracks = useTracks(client, {
    developmentMock,
    onMemberCreated: rawObjects.selectCreated,
    refreshObjects: rawObjects.retry,
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
  const tracks = useMemo(
    () => ({
      ...rawTracks,
      select: (summary: Parameters<typeof rawTracks.select>[0]) =>
        guard(() => rawTracks.select(summary)),
      startCreate: (date: Parameters<typeof rawTracks.startCreate>[0]) =>
        guard(() => rawTracks.startCreate(date)),
    }),
    [guard, rawTracks],
  )
  const objects = useMemo(
    () => ({
      ...rawObjects,
      selectOrdinary: () =>
        guard(() => {
          rawTracks.clearSelection()
          rawObjects.selectOrdinary()
        }),
      selectObject: (object: Parameters<typeof rawObjects.selectObject>[0]) =>
        guard(() => {
          rawTracks.clearSelection()
          rawObjects.selectObject(object)
        }),
      goToObject: (object: Parameters<typeof rawObjects.goToObject>[0]) =>
        guard(() => {
          rawTracks.clearSelection()
          rawObjects.goToObject(object)
        }),
    }),
    [guard, rawObjects, rawTracks],
  )
  return (
    <RecordDraftSessionContext.Provider
      value={{ register: draftSession.register }}
    >
      <RecordDestinationContext.Provider
        value={{
          client,
          developmentMock,
          cursor,
          objects,
          events,
          spans,
          tracks,
          navigationSummary: {
            ordinary: ordinaryNavigation,
            structuredMediaCounts,
            reportOrdinaryText,
            reportMediaCount,
          },
        }}
      >
        {children}
      </RecordDestinationContext.Provider>
    </RecordDraftSessionContext.Provider>
  )
}

/** Record's leading workspace region: where in time and what is selected. */
export function RecordNavigationRegion() {
  const { cursor, objects, events, spans, tracks, navigationSummary } =
    useRecordDestination()
  const { close, toggle } = useWorkspacePanels()
  const date = cursor.state.view?.calendar.focusedDate ?? null
  const finishNavigation = () => {
    close()
    globalThis.queueMicrotask(() =>
      document.getElementById('main-content')?.focus(),
    )
  }
  const showCreationDetails = () => {
    toggle('details')
  }
  return (
    <div className="record-navigation-region">
      <RecordNavigationPanel cursor={cursor} />
      <RecordObjectSwitcher
        scale={cursor.state.scale}
        window={cursor.state.view?.window ?? null}
        objects={objects}
        creatingEvent={events.creating}
        creatingSpan={spans.creating}
        ordinarySummary={
          navigationSummary.ordinary?.windowId === cursor.state.view?.window.id
            ? navigationSummary.ordinary
            : null
        }
        structuredMediaCounts={navigationSummary.structuredMediaCounts}
        navigationStatus={cursor.state.status}
        motion={cursor.state.motion}
        onNavigate={finishNavigation}
        onCreateEvent={() => {
          if (date) {
            tracks.clearSelection()
            events.startCreate(date)
            showCreationDetails()
          }
        }}
        onCreateSpan={() => {
          if (date) {
            tracks.clearSelection()
            spans.startCreate(date)
            showCreationDetails()
          }
        }}
      />
    </div>
  )
}

/** Record's trailing workspace region: what is selected. */
export function RecordDetailsRegion() {
  const { cursor, objects, events, spans, tracks } = useRecordDestination()
  return (
    <RecordObjectDetails
      scale={cursor.state.scale}
      window={cursor.state.view?.window ?? null}
      objects={objects}
      event={events}
      span={spans}
      tracks={tracks}
    />
  )
}
