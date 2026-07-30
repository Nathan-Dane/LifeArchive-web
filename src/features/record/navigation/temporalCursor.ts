/**
 * One temporal cursor over core-owned time navigation.
 *
 * The cursor is two values — a scale and an anchor civil date — and everything
 * a reader sees is what the core answered for that pair. The controller keeps
 * no derived calendar of its own: it holds the request, and the window, the
 * week strip, and the surrounding month are all values that came back.
 *
 * Four rules shape it:
 *
 * 1. **The core traverses.** Previous and next are `time.step`, and the new
 *    anchor is the exact civil start the core returned for the neighbouring
 *    window. Nothing here adds a day, a week, or a month to anything.
 * 2. **Changing scale preserves the anchor.** A scale is a different view of
 *    the same civil location, so the anchor is passed back unchanged and the
 *    core decides which window at that scale contains it.
 * 3. **Only the newest request may land.** Each request takes a generation;
 *    an answer from a superseded one is discarded rather than painted over a
 *    newer view, so a slow window can never redate the panel.
 * 4. **A failure is a state, not an empty calendar.** When the core cannot
 *    answer, the cursor says so and shows no cells, rather than presenting a
 *    grid this repository worked out for itself.
 *
 * Loading is derived rather than stored: an answer remembers the request it
 * belongs to, so "still loading" is simply an answer that does not yet match
 * the request on screen.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  civilDate,
  isCivilDate,
  type CalendarContext,
  type CivilDate,
  type ClientFailure,
  type LifeArchiveClient,
  type TimeScale,
  type TimeWindow,
  type WindowStep,
} from '../../../core/client'
import { deviceCalendar, type DeviceCalendar } from './deviceCalendar'

export type TemporalStatus = 'loading' | 'ready' | 'failed'

export interface TemporalMotion {
  readonly id: number
  readonly kind: 'horizontal' | 'scale'
  readonly direction: 'forward' | 'backward' | 'coarser' | 'finer'
}

/** What the core answered for one cursor position. */
export interface TemporalView {
  readonly window: TimeWindow
  readonly calendar: CalendarContext
}

export interface TemporalCursorState {
  readonly scale: TimeScale
  /** The civil location the cursor asks about. An input, never a display. */
  readonly anchor: CivilDate
  /** The device's civil day, as last observed. */
  readonly today: CivilDate
  readonly status: TemporalStatus
  /**
   * The core's answer. It stays on screen while a newer one is in flight, so
   * stepping never blanks the panel, and it is dropped when the core says it
   * cannot answer at all.
   */
  readonly view: TemporalView | null
  /**
   * The core-returned periods around the settled window. Week and Month keep
   * two on either side; Year keeps one. Every boundary still comes from a
   * `time.step` answer rather than browser date arithmetic.
   */
  readonly periods: readonly TimeWindow[]
  readonly failure: ClientFailure | null
  readonly expanded: boolean
  /** Presentation intent only; core-owned traversal still chooses every date. */
  readonly motion: TemporalMotion | null
}

/** One cursor position: a scale and the civil location read at that scale. */
export interface TemporalDestination {
  readonly scale: TimeScale
  readonly anchor: CivilDate
}

export interface TemporalCursor {
  readonly state: TemporalCursorState
  /** Views the same civil location at another scale. */
  readonly chooseScale: (scale: TimeScale) => void
  /** Asks the core for the neighbouring window and follows it. */
  readonly step: (step: WindowStep) => void
  /** Re-reads the device's civil day and moves there. */
  readonly goToToday: () => void
  /** Moves to a civil date the core placed in the calendar. */
  readonly selectDate: (date: CivilDate) => void
  /**
   * Moves scale and civil location together, as one cursor position.
   *
   * A handoff — an Event chosen at a broader scale, a notice pointing at an
   * object's own dates — lands somewhere the reader did not step to, and both
   * halves of that landing are one move. Setting them separately would ask the
   * core about an intermediate position nobody asked to see.
   */
  readonly goTo: (destination: TemporalDestination) => void
  readonly setExpanded: (expanded: boolean) => void
  readonly retry: () => void
}

/** The request the cursor is currently asking about. */
interface Target {
  readonly scale: TimeScale
  readonly anchor: CivilDate
  /** Bumped whenever the same pair must be asked again. */
  readonly load: number
}

/** One settled answer, and the request it answers. */
interface Answer {
  readonly to: Target | null
  readonly view: TemporalView | null
  readonly failure: ClientFailure | null
}

interface PeriodAnswer {
  readonly toWindowId: string | null
  readonly periods: readonly TimeWindow[]
}

const NOTHING_YET: Answer = { to: null, view: null, failure: null }
const NO_PERIODS: PeriodAnswer = { toWindowId: null, periods: [] }
export const RECORD_CURSOR_STORAGE_KEY = 'lifearchive:record-time-cursor:v1'
const TIME_SCALES: readonly TimeScale[] = ['day', 'week', 'month', 'year']

function restoredCursor(): TemporalDestination | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(RECORD_CURSOR_STORAGE_KEY) ?? 'null',
    )
    if (
      typeof value !== 'object' ||
      value === null ||
      !TIME_SCALES.includes(value.scale) ||
      typeof value.anchor !== 'string' ||
      !isCivilDate(value.anchor)
    ) {
      return null
    }
    return { scale: value.scale, anchor: civilDate(value.anchor) }
  } catch {
    return null
  }
}

function rememberCursor(cursor: TemporalDestination): void {
  try {
    localStorage.setItem(RECORD_CURSOR_STORAGE_KEY, JSON.stringify(cursor))
  } catch {
    // Navigation remains usable when browser preference storage is unavailable.
  }
}

export interface TemporalCursorOptions {
  readonly device?: DeviceCalendar
  /** The scale a fresh Record opens at. */
  readonly initialScale?: TimeScale
  /** Whether a previously used scale takes precedence over `initialScale`. */
  readonly restoreScale?: boolean
}

export function resetRememberedRecordCursor(): void {
  try {
    localStorage.removeItem(RECORD_CURSOR_STORAGE_KEY)
  } catch {
    // The active cursor remains usable when browser storage is unavailable.
  }
}

export function useTemporalCursor(
  client: LifeArchiveClient,
  {
    device = deviceCalendar(),
    initialScale = 'day',
    restoreScale = true,
  }: TemporalCursorOptions = {},
): TemporalCursor {
  const [today, setToday] = useState<CivilDate>(() => device.today())
  const [target, setTarget] = useState<Target>(() => {
    const restored = restoredCursor()
    return {
      scale: restoreScale ? (restored?.scale ?? initialScale) : initialScale,
      anchor: restored?.anchor ?? device.today(),
      load: 0,
    }
  })
  const [answer, setAnswer] = useState<Answer>(NOTHING_YET)
  /**
   * The request a traversal in flight started from. Holding the request rather
   * than a flag is what makes a superseded traversal stop counting as work in
   * progress: once the reader has asked something else, the answer it is
   * waiting for is no longer an answer to anything on screen.
   */
  const [steppingFrom, setSteppingFrom] = useState<Target | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [motion, setMotion] = useState<TemporalMotion | null>(null)
  const [periodAnswer, setPeriodAnswer] = useState<PeriodAnswer>(NO_PERIODS)

  /*
   * The generation every in-flight request carries. A step and a load share
   * it, because a step resolving after the reader has already moved on is
   * exactly as stale as a window that does.
   */
  const generation = useRef(0)
  const periodGeneration = useRef(0)
  const motionGeneration = useRef(0)

  const announceMotion = useCallback(
    (kind: TemporalMotion['kind'], direction: TemporalMotion['direction']) => {
      setMotion({
        id: (motionGeneration.current += 1),
        kind,
        direction,
      })
    },
    [],
  )

  useEffect(() => {
    rememberCursor({ scale: target.scale, anchor: target.anchor })
  }, [target.anchor, target.scale])

  useEffect(() => {
    const requested = (generation.current += 1)
    void Promise.all([
      client.time.window({
        scale: target.scale,
        containing: target.anchor,
        timeZoneId: device.timeZoneId,
        weekRules: device.weekRules,
      }),
      client.time.calendarContext({
        focusedDate: target.anchor,
        timeZoneId: device.timeZoneId,
        weekRules: device.weekRules,
      }),
    ]).then(([window, calendar]) => {
      if (requested !== generation.current) return
      if (window.status !== 'ok') {
        setAnswer({ to: target, view: null, failure: window.failure })
        return
      }
      if (calendar.status !== 'ok') {
        setAnswer({ to: target, view: null, failure: calendar.failure })
        return
      }
      setAnswer({
        to: target,
        view: { window: window.value, calendar: calendar.value },
        failure: null,
      })
    })
  }, [client, device, target])

  /** Moves the anchor and asks again, keeping the scale as it is. */
  const moveTo = useCallback((anchor: CivilDate) => {
    setTarget((current) => ({ ...current, anchor, load: current.load + 1 }))
  }, [])

  /*
   * These handlers announce only spatial intent. They do not calculate or
   * traverse dates: ordering comes from core-returned calendar cells, and
   * previous/next still call the core.
   */
  const chooseScale = useCallback(
    (scale: TimeScale) => {
      if (target.scale === scale) return
      announceMotion(
        'scale',
        TIME_SCALES.indexOf(scale) > TIME_SCALES.indexOf(target.scale)
          ? 'coarser'
          : 'finer',
      )
      setExpanded(false)
      setTarget((current) => ({
        ...current,
        scale,
        load: current.load + 1,
      }))
    },
    [announceMotion, target.scale],
  )

  const selectDate = useCallback(
    (date: CivilDate) => {
      if (target.anchor === date) return
      const calendar = answer.view?.calendar
      const ordered =
        calendar && calendar.month.length > 0 ? calendar.month : calendar?.week
      const from = ordered?.findIndex(
        ({ date: item }) => item === target.anchor,
      )
      const to = ordered?.findIndex(({ date: item }) => item === date)
      announceMotion(
        'horizontal',
        typeof from === 'number' &&
          typeof to === 'number' &&
          from >= 0 &&
          to >= 0 &&
          to < from
          ? 'backward'
          : 'forward',
      )
      setTarget((current) => ({
        ...current,
        anchor: date,
        load: current.load + 1,
      }))
    },
    [announceMotion, answer.view?.calendar, target.anchor],
  )

  const goTo = useCallback(
    ({ scale, anchor }: TemporalDestination) => {
      if (target.scale === scale && target.anchor === anchor) return
      if (target.scale !== scale) {
        announceMotion(
          'scale',
          TIME_SCALES.indexOf(scale) > TIME_SCALES.indexOf(target.scale)
            ? 'coarser'
            : 'finer',
        )
      } else {
        announceMotion('horizontal', 'forward')
      }
      setExpanded(false)
      setTarget((current) => ({
        scale,
        anchor,
        load: current.load + 1,
      }))
    },
    [announceMotion, target.anchor, target.scale],
  )

  const goToToday = useCallback(() => {
    const observed = device.today()
    setToday(observed)
    if (target.anchor !== observed) {
      announceMotion('horizontal', 'forward')
      moveTo(observed)
    }
  }, [announceMotion, device, moveTo, target.anchor])

  const settled = answer.to === target
  const window = answer.view?.window ?? null

  useEffect(() => {
    const requested = (periodGeneration.current += 1)
    if (
      !settled ||
      !window ||
      target.scale === 'day' ||
      window.scale !== target.scale
    ) {
      return
    }

    void (async () => {
      const [previous, next] = await Promise.all([
        client.time.step({
          window,
          step: 'previous',
          weekRules: device.weekRules,
        }),
        client.time.step({
          window,
          step: 'next',
          weekRules: device.weekRules,
        }),
      ])
      if (
        requested !== periodGeneration.current ||
        previous.status !== 'ok' ||
        next.status !== 'ok'
      ) {
        return
      }

      let periods: readonly TimeWindow[] = [previous.value, window, next.value]
      if (target.scale === 'week' || target.scale === 'month') {
        const [earlier, later] = await Promise.all([
          client.time.step({
            window: previous.value,
            step: 'previous',
            weekRules: device.weekRules,
          }),
          client.time.step({
            window: next.value,
            step: 'next',
            weekRules: device.weekRules,
          }),
        ])
        if (
          requested !== periodGeneration.current ||
          earlier.status !== 'ok' ||
          later.status !== 'ok'
        ) {
          return
        }
        periods = [
          earlier.value,
          previous.value,
          window,
          next.value,
          later.value,
        ]
      }

      setPeriodAnswer({ toWindowId: window.id, periods })
    })()
  }, [client, device, settled, target.scale, window])

  const step = useCallback(
    (direction: WindowStep) => {
      if (!window) return
      announceMotion(
        'horizontal',
        direction === 'next' ? 'forward' : 'backward',
      )
      const requested = (generation.current += 1)
      setSteppingFrom(target)
      void client.time
        .step({ window, step: direction, weekRules: device.weekRules })
        .then((result) => {
          setSteppingFrom((current) => (current === target ? null : current))
          if (requested !== generation.current) return
          if (result.status !== 'ok') {
            setAnswer({ to: target, view: null, failure: result.failure })
            return
          }
          /*
           * The neighbour's own inclusive civil start becomes the anchor, so
           * the next request is asked in the core's terms rather than in a
           * date this repository worked out.
           */
          moveTo(result.value.startDate)
        })
    },
    [announceMotion, client, device, moveTo, target, window],
  )

  const retry = useCallback(() => {
    setTarget((current) => ({ ...current, load: current.load + 1 }))
  }, [])

  const stepping = steppingFrom === target
  const status: TemporalStatus =
    stepping || !settled ? 'loading' : answer.failure ? 'failed' : 'ready'
  const periods =
    settled && window && periodAnswer.toWindowId === window.id
      ? periodAnswer.periods
      : []

  return {
    state: {
      scale: target.scale,
      anchor: target.anchor,
      today,
      status,
      view: answer.view,
      periods,
      failure: status === 'failed' ? answer.failure : null,
      expanded,
      motion,
    },
    chooseScale,
    step,
    goToToday,
    selectDate,
    goTo,
    setExpanded,
    retry,
  }
}
