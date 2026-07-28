/**
 * Which object at the cursor's location is being worked on.
 *
 * Record edits one thing at a time. That thing is either the ordinary entry of
 * the window the temporal cursor is reading, or one structured object named by
 * its exact stable ID. This controller owns that single choice, and four rules
 * shape it:
 *
 * 1. **An object is its ID.** Nothing here identifies an object by its date,
 *    its title, or its position in a list. A list position is where a summary
 *    was drawn, not what it is, and a date can hold several Events and any
 *    number of overlapping Spans.
 * 2. **The core's order is the order.** The objects a window holds arrive in
 *    one page, in the order the core placed them, and are rendered in exactly
 *    that order. Nothing is re-sorted, re-grouped by time, merged across
 *    windows, or counted into an aggregate.
 * 3. **One destination.** Scale, civil location, and the selected ID are one
 *    position. Choosing an object at a broader scale moves the cursor and the
 *    selection together; there is no second competing date or scale state.
 * 4. **A selection the window does not hold is stated, not silently swapped.**
 *    When the selected object is not among the ones the core placed here, the
 *    ordinary entry becomes the selection and a notice names the exact object
 *    and offers to follow it.
 *
 * The exact ID is also the only thing this feature puts in the URL. A stable
 * ID is durable and shareable; a revision is neither, and writing is nobody's
 * business to put in a location bar.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  isStableId,
  stableId,
  type CivilDate,
  type ClientFailure,
  type LifeArchiveClient,
  type StableId,
  type StructuredPlacement,
  type StructuredSummary,
  type TimeWindow,
} from '../../../core/client'
import type { TemporalCursor } from '../navigation/temporalCursor'

/** The search parameter carrying the exact selected object. */
export const OBJECT_PARAMETER = 'object'

/**
 * How many objects one window is asked for. The request is bounded because
 * an unbounded one is a promise the core cannot keep for a wide window; when
 * the core fills the page, {@link RecordObjectsState.bounded} says so rather
 * than letting a page size be read as a total.
 */
export const OBJECT_PAGE_LIMIT = 100

/**
 * The civil date an object is placed at: an Event's date, a Span's start.
 *
 * Both are values the core produced. Choosing between them by the placement's
 * own kind is reading the field that is there, not deciding where in time the
 * object sits — nothing here compares, clamps, or ranges over a date.
 */
export function placementDate(placement: StructuredPlacement): CivilDate {
  return placement.kind === 'event' ? placement.date : placement.startDate
}

export type RecordObjectsStatus = 'loading' | 'ready' | 'failed'

/** Why the object a reader asked for is not the one now selected. */
export type RecordObjectNotice =
  /** It exists, but the core did not place it in the window on screen. */
  | { readonly reason: 'elsewhere'; readonly object: StructuredSummary }
  /** The core answered with a tombstone. */
  | { readonly reason: 'deleted'; readonly object: StructuredSummary }
  /** The core has no object with that ID. */
  | { readonly reason: 'missing'; readonly id: StableId }
  | {
      readonly reason: 'unavailable'
      readonly id: StableId
      readonly failure: ClientFailure
    }

export interface RecordObjectsState {
  readonly status: RecordObjectsStatus
  readonly failure: ClientFailure | null
  /** Exactly the objects the core placed in this window, in its order. */
  readonly objects: readonly StructuredSummary[]
  /** True when the core filled the requested page, so more may exist. */
  readonly bounded: boolean
  /** The selected object, or `null` while the ordinary entry is selected. */
  readonly selected: StructuredSummary | null
  readonly notice: RecordObjectNotice | null
}

export interface RecordObjects {
  readonly state: RecordObjectsState
  readonly selectOrdinary: () => void
  /** Selects an object the core placed in the window now on screen. */
  readonly selectObject: (object: StructuredSummary) => void
  /** Moves the cursor to the object's own civil location and selects it. */
  readonly goToObject: (object: StructuredSummary) => void
  /** Selects a just-created object by its core-returned stable identity. */
  readonly selectCreated: (object: StructuredSummary) => void
  /** Replaces the selected/listed summary after a confirmed core mutation. */
  readonly replaceObject: (object: StructuredSummary) => void
  /** Removes only the exact core-confirmed soft-delete target. */
  readonly removeObject: (id: StableId) => void
  readonly dismissNotice: () => void
  readonly retry: () => void
}

type Action =
  | { readonly type: 'requested' }
  | {
      readonly type: 'listed'
      readonly objects: readonly StructuredSummary[]
      readonly bounded: boolean
    }
  | { readonly type: 'failed'; readonly failure: ClientFailure }
  | { readonly type: 'select'; readonly object: StructuredSummary }
  | { readonly type: 'created'; readonly object: StructuredSummary }
  | { readonly type: 'replace'; readonly object: StructuredSummary }
  | { readonly type: 'remove'; readonly id: StableId }
  | { readonly type: 'selectOrdinary' }
  | { readonly type: 'notice'; readonly notice: RecordObjectNotice }
  | { readonly type: 'dismiss' }

const INITIAL: RecordObjectsState = {
  status: 'loading',
  failure: null,
  objects: [],
  bounded: false,
  selected: null,
  notice: null,
}

function reduce(state: RecordObjectsState, action: Action): RecordObjectsState {
  switch (action.type) {
    case 'requested':
      /*
       * The objects of the window being left are not the objects of the one
       * being asked about, so they go rather than lingering under a new date.
       * The selection stays: it is the reader's, and whether this window holds
       * it is what the answer will say.
       */
      return { ...state, status: 'loading', failure: null, objects: [] }

    case 'listed': {
      const selected = state.selected
        ? (action.objects.find((object) => object.id === state.selected?.id) ??
          null)
        : null
      return {
        status: 'ready',
        failure: null,
        objects: action.objects,
        bounded: action.bounded,
        /*
         * The summary the core just returned replaces the remembered one, so
         * a title or placement the archive has moved on from is never what a
         * reader is shown.
         */
        selected,
        notice:
          state.selected && !selected
            ? { reason: 'elsewhere', object: state.selected }
            : state.notice,
      }
    }

    case 'failed':
      /*
       * The selection survives a failure. The reader still asked for that
       * exact object, and forgetting it would turn an unreadable window into
       * a silent change of what is being edited.
       */
      return {
        ...state,
        status: 'failed',
        failure: action.failure,
        objects: [],
      }

    case 'select':
      return { ...state, selected: action.object, notice: null }

    case 'created':
      return {
        ...state,
        objects: state.objects.some((object) => object.id === action.object.id)
          ? state.objects.map((object) =>
              object.id === action.object.id ? action.object : object,
            )
          : [...state.objects, action.object],
        selected: action.object,
        notice: null,
      }

    case 'replace':
      return {
        ...state,
        objects: state.objects.map((object) =>
          object.id === action.object.id ? action.object : object,
        ),
        selected:
          state.selected?.id === action.object.id
            ? action.object
            : state.selected,
      }

    case 'remove':
      return {
        ...state,
        objects: state.objects.filter((object) => object.id !== action.id),
        selected: state.selected?.id === action.id ? null : state.selected,
        notice: null,
      }

    case 'selectOrdinary':
      return { ...state, selected: null, notice: null }

    case 'notice':
      return { ...state, selected: null, notice: action.notice }

    case 'dismiss':
      return { ...state, notice: null }
  }
}

export interface RecordObjectsOptions {
  /** The window the cursor is reading, or `null` while it has none. */
  readonly window: TimeWindow | null
  /** Moves the temporal cursor. Stable across renders. */
  readonly goTo: TemporalCursor['goTo']
  readonly limit?: number
}

/** Reads the exact object a location asks for, ignoring malformed text. */
function requestedObjectId(parameters: URLSearchParams): StableId | null {
  const raw = parameters.get(OBJECT_PARAMETER)
  return raw !== null && isStableId(raw) ? stableId(raw) : null
}

export function useRecordObjects(
  client: LifeArchiveClient,
  { window, goTo, limit = OBJECT_PAGE_LIMIT }: RecordObjectsOptions,
): RecordObjects {
  const [state, dispatch] = useReducer(reduce, INITIAL)
  const [parameters, setParameters] = useSearchParams()
  const [reload, setReload] = useState(0)

  /**
   * The exact ID a location asked for, read once. Later changes to the search
   * parameters are this controller's own, so re-reading them would answer its
   * own writing as though a reader had asked again.
   */
  const [request, setRequest] = useState<StableId | null>(() =>
    requestedObjectId(parameters),
  )

  /* The generation every list request carries; see `temporalCursor.ts`. */
  const listing = useRef(0)
  const resolving = useRef(0)

  useEffect(() => {
    if (!window) {
      dispatch({ type: 'requested' })
      return
    }
    const requested = (listing.current += 1)
    dispatch({ type: 'requested' })
    void client.record.listObjects({ window, limit }).then((result) => {
      if (requested !== listing.current) return
      dispatch(
        result.status === 'ok'
          ? {
              type: 'listed',
              objects: result.value.objects,
              bounded: result.value.objects.length >= limit,
            }
          : { type: 'failed', failure: result.failure },
      )
    })
  }, [client, limit, reload, window])

  const selectOrdinary = useCallback(() => {
    dispatch({ type: 'selectOrdinary' })
  }, [])

  const selectObject = useCallback((object: StructuredSummary) => {
    dispatch({ type: 'select', object })
  }, [])

  const goToObject = useCallback(
    (object: StructuredSummary) => {
      /*
       * A list answering for the window being left must not land here and
       * conclude that the object just chosen is missing, so it stops counting
       * before the cursor moves.
       */
      listing.current += 1
      dispatch({ type: 'select', object })
      goTo({ scale: 'day', anchor: placementDate(object.placement) })
    },
    [goTo],
  )

  /**
   * Resolving the exact ID a location asked for. It is asked of the core by
   * ID rather than looked for in whatever window happens to be on screen, so
   * a link to an object opens that object wherever in time it lives.
   */
  useEffect(() => {
    if (request === null) return
    const requested = (resolving.current += 1)
    void client.structured
      .load({ id: request, includeDeleted: true })
      .then((result) => {
        if (requested !== resolving.current) return
        setRequest(null)
        if (result.status !== 'ok') {
          dispatch({
            type: 'notice',
            notice: {
              reason: 'unavailable',
              id: request,
              failure: result.failure,
            },
          })
          return
        }
        const found = result.value
        if (found.presence === 'present') {
          goToObject(found.object.summary)
        } else if (found.presence === 'deleted') {
          dispatch({
            type: 'notice',
            notice: { reason: 'deleted', object: found.object.summary },
          })
        } else {
          dispatch({
            type: 'notice',
            notice: { reason: 'missing', id: found.id },
          })
        }
      })
  }, [client, goToObject, request])

  /**
   * The location follows the selection, by replacement rather than by a new
   * history entry: choosing a tab is not a page a reader wants to step back
   * through, but it is a place they may want to return to or send someone.
   */
  useEffect(() => {
    if (request !== null) return
    const current = parameters.get(OBJECT_PARAMETER)
    const wanted = state.selected?.id ?? null
    if (current === wanted) return
    const next = new URLSearchParams(parameters)
    if (wanted === null) next.delete(OBJECT_PARAMETER)
    else next.set(OBJECT_PARAMETER, wanted)
    setParameters(next, { replace: true })
  }, [parameters, request, setParameters, state.selected])

  return {
    state,
    selectOrdinary,
    selectObject,
    goToObject,
    selectCreated: useCallback(
      (object: StructuredSummary) => dispatch({ type: 'created', object }),
      [],
    ),
    replaceObject: useCallback(
      (object: StructuredSummary) => dispatch({ type: 'replace', object }),
      [],
    ),
    removeObject: useCallback(
      (id: StableId) => dispatch({ type: 'remove', id }),
      [],
    ),
    dismissNotice: useCallback(() => dispatch({ type: 'dismiss' }), []),
    retry: useCallback(() => setReload((count) => count + 1), []),
  }
}
