import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, type Location } from 'react-router-dom'
import type { StableId } from '../core/client'
import {
  type OpenRecordPerson,
  type RecordPersonOriginNavigation,
} from '../ui/navigation/recordPersonOrigin'

const STATE_KEY = 'lifeArchiveRecordPersonOrigin'
const STATE_VERSION = 1
const MAX_PERSON_ROUTE_DEPTH = 32
const FOCUS_WAIT_MS = 4_000

interface RecordPersonLocationState {
  readonly version: typeof STATE_VERSION
  readonly token: string
  readonly depth: number
}

interface RecordPersonOrigin {
  readonly token: string
  readonly recordLocation: {
    readonly pathname: string
    readonly search: string
    readonly hash: string
  }
  readonly scroll: {
    readonly windowX: number
    readonly windowY: number
    readonly mainLeft: number
    readonly mainTop: number
  }
  readonly personId: StableId
  readonly openerKey: string
}

/**
 * Coordinates a temporary Record -> Person route handoff.
 *
 * Router state contains only an opaque token and history depth. Record scroll
 * and focus live in this app-memory registry and disappear on reload; no
 * archive content or presentation snapshot is written to browser storage.
 */
export function useRecordPersonOriginCoordinator(): RecordPersonOriginNavigation {
  const location = useLocation()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<
    ReadonlyMap<string, RecordPersonOrigin>
  >(() => new Map())
  const previousLocation = useRef<Location | null>(null)
  const sequence = useRef(0)
  const restoration = useRef<(() => void) | null>(null)

  const currentState = readLocationState(location.state)
  const currentOrigin = currentState
    ? (entries.get(currentState.token) ?? null)
    : null
  const expiredOrigin = currentState !== null && currentOrigin === null

  const openPerson = useCallback<OpenRecordPerson>(
    (personId, mode, opener) => {
      if (location.pathname !== '/record') return
      const main = document.getElementById('main-content')
      const token = `record-person-${Date.now().toString(36)}-${(sequence.current += 1).toString(
        36,
      )}`
      const openerKey = opener.dataset.recordPersonOpenerKey ?? token
      opener.dataset.recordPersonOpenerKey = openerKey
      setEntries((current) => {
        const next = new Map(current)
        next.set(token, {
          token,
          recordLocation: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
          scroll: {
            windowX: globalThis.window.scrollX,
            windowY: globalThis.window.scrollY,
            mainLeft: main?.scrollLeft ?? 0,
            mainTop: main?.scrollTop ?? 0,
          },
          personId,
          openerKey,
        })
        return next
      })
      const state = locationState(token, 1)
      navigate(`/index/people/${personId}${mode === 'edit' ? '/edit' : ''}`, {
        state: { [STATE_KEY]: state },
      })
    },
    [location, navigate],
  )

  const stateForPersonRoute = useCallback((): unknown => {
    const current = readLocationState(location.state)
    if (!current || !entries.has(current.token)) return undefined
    const depth = Math.min(current.depth + 1, MAX_PERSON_ROUTE_DEPTH)
    return { [STATE_KEY]: locationState(current.token, depth) }
  }, [entries, location.state])

  const returnToRecord = useCallback(() => {
    const current = readLocationState(location.state)
    if (!current || !entries.has(current.token)) return false
    navigate(-current.depth)
    return true
  }, [entries, location.state, navigate])

  useEffect(() => {
    const previous = previousLocation.current
    previousLocation.current = location
    if (location.pathname !== '/record' || !previous) return
    const state = readLocationState(previous.state)
    if (!state) return
    const origin = entries.get(state.token)
    if (!origin || !sameLocation(location, origin.recordLocation)) return
    setEntries((current) => {
      const next = new Map(current)
      next.delete(state.token)
      return next
    })
    restoration.current?.()
    restoration.current = restoreRecordPresentation(origin)
  }, [entries, location])

  useEffect(
    () => () => {
      restoration.current?.()
    },
    [],
  )

  return useMemo(
    () => ({
      hasOrigin: currentOrigin !== null,
      expiredOrigin,
      openPerson,
      stateForPersonRoute,
      returnToRecord,
    }),
    [
      currentOrigin,
      expiredOrigin,
      openPerson,
      returnToRecord,
      stateForPersonRoute,
    ],
  )
}

function locationState(
  token: string,
  depth: number,
): RecordPersonLocationState {
  return { version: STATE_VERSION, token, depth }
}

function readLocationState(value: unknown): RecordPersonLocationState | null {
  if (!isObject(value)) return null
  const candidate = value[STATE_KEY]
  if (!isObject(candidate)) return null
  return candidate.version === STATE_VERSION &&
    typeof candidate.token === 'string' &&
    candidate.token.startsWith('record-person-') &&
    Number.isInteger(candidate.depth) &&
    typeof candidate.depth === 'number' &&
    candidate.depth >= 1 &&
    candidate.depth <= MAX_PERSON_ROUTE_DEPTH
    ? {
        version: STATE_VERSION,
        token: candidate.token,
        depth: candidate.depth,
      }
    : null
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function sameLocation(
  current: Pick<Location, 'pathname' | 'search' | 'hash'>,
  expected: RecordPersonOrigin['recordLocation'],
): boolean {
  return (
    current.pathname === expected.pathname &&
    current.search === expected.search &&
    current.hash === expected.hash
  )
}

function restoreRecordPresentation(origin: RecordPersonOrigin): () => void {
  const main = document.getElementById('main-content')
  const restoreScroll = () => {
    if (origin.scroll.windowX !== 0 || origin.scroll.windowY !== 0) {
      globalThis.window.scrollTo(origin.scroll.windowX, origin.scroll.windowY)
    }
    if (main) {
      main.scrollLeft = origin.scroll.mainLeft
      main.scrollTop = origin.scroll.mainTop
    }
  }
  let focused: HTMLButtonElement | null = null
  let deadlineTimeout = 0
  const focusOpener = () => {
    const exact = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '[data-record-person-opener-key]',
      ),
    ].find(
      (candidate) =>
        candidate.dataset.recordPersonOpenerKey === origin.openerKey,
    )
    const button =
      exact ??
      [
        ...document.querySelectorAll<HTMLButtonElement>(
          '[data-record-person-id]',
        ),
      ].find(
        (candidate) => candidate.dataset.recordPersonId === origin.personId,
      )
    if (!button) return false
    if (!exact) button.dataset.recordPersonOpenerKey = origin.openerKey
    restoreScroll()
    button.focus({ preventScroll: true })
    focused = button
    return true
  }

  restoreScroll()
  const observer = new MutationObserver(() => {
    if (
      !focused?.isConnected ||
      document.activeElement === document.body ||
      document.activeElement === null
    ) {
      focusOpener()
    }
  })
  observer.observe(main ?? document.body, { childList: true, subtree: true })
  deadlineTimeout = globalThis.window.setTimeout(cleanup, FOCUS_WAIT_MS)
  focusOpener()
  function cleanup() {
    observer.disconnect()
    globalThis.window.clearTimeout(deadlineTimeout)
  }
  return cleanup
}
