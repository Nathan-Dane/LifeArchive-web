/**
 * The categorized navigation list for the exact objects at this location.
 *
 * Grouping never changes the order within a kind. The core owns Span length
 * and returns Spans from shortest to longest, including the meaning of an
 * ongoing Span; this browser surface only separates that ordered result into
 * Entry, Events, and Spans.
 */

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  StableId,
  StructuredSummary,
  TimeScale,
  TimeWindow,
} from '../../../core/client'
import { failureMessage, useFormat, useLocalisation } from '../../../i18n'
import { RecordSemanticIcon } from '../events'
import { displayAccentClassName } from '../metadata'
import type {
  TemporalMotion,
  TemporalStatus,
} from '../navigation/temporalCursor'
import { RecordControlIcon, RecordOverlay } from '../overlays'
import { objectName, objectWhen } from './objectNames'
import type { RecordObjects, RecordObjectsState } from './recordObjects'
import { RecordObjectNoticeBar } from './RecordObjectNoticeBar'

const ORDINARY_LABEL = {
  day: 'record.objects.ordinaryDay',
  week: 'record.objects.ordinaryWeek',
  month: 'record.objects.ordinaryMonth',
  year: 'record.objects.ordinaryYear',
} as const satisfies Record<TimeScale, string>

const EMPTY_MEDIA_COUNTS: ReadonlyMap<StableId, number> = new Map()
const ROW_TRANSITION_FALLBACK_MS = 300
const ORDINARY_TRANSITION_FALLBACK_MS = 380

function prefersReducedMotion(): boolean {
  return (
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export interface RecordObjectSwitcherProps {
  readonly scale: TimeScale
  readonly window: TimeWindow | null
  readonly objects: RecordObjects
  readonly creatingEvent: boolean
  readonly creatingSpan: boolean
  readonly ordinarySummary?: {
    readonly text: string
    readonly mediaCount: number | null
  } | null
  readonly structuredMediaCounts?: ReadonlyMap<StableId, number>
  readonly navigationStatus?: TemporalStatus
  readonly motion?: TemporalMotion | null
  readonly onCreateEvent: () => void
  readonly onCreateSpan: () => void
  readonly onNavigate?: () => void
}

interface ObjectGroupsSnapshot {
  readonly scale: TimeScale
  readonly state: RecordObjectsState
  readonly creatingEvent: boolean
  readonly creatingSpan: boolean
  readonly ordinarySummary: {
    readonly text: string
    readonly mediaCount: number | null
  } | null
  readonly structuredMediaCounts: ReadonlyMap<StableId, number>
}

interface OrdinarySnapshot {
  readonly scale: TimeScale
  readonly selected: boolean
  readonly summary: {
    readonly text: string
    readonly mediaCount: number | null
  } | null
}

interface OrdinaryTransition {
  readonly currentId: number
  readonly outgoing: OrdinarySnapshot | null
  readonly direction: 'forward' | 'backward'
}

type ObjectPresence = 'stable' | 'entering' | 'exiting'

type PresentedObjectRow =
  | {
      readonly key: string
      readonly kind: 'empty'
      readonly presence: ObjectPresence
    }
  | {
      readonly key: string
      readonly kind: 'object'
      readonly object: StructuredSummary
      readonly presence: ObjectPresence
    }

interface PresentedObjectGroups {
  readonly events: readonly PresentedObjectRow[]
  readonly spans: readonly PresentedObjectRow[]
  readonly motionKind: TemporalMotion['kind'] | 'none'
  readonly direction: 'forward' | 'backward'
  readonly transitionId: number
}

export function RecordObjectSwitcher({
  scale,
  window,
  objects,
  creatingEvent,
  creatingSpan,
  ordinarySummary = null,
  structuredMediaCounts = EMPTY_MEDIA_COUNTS,
  navigationStatus = 'ready',
  motion = null,
  onCreateEvent,
  onCreateSpan,
  onNavigate,
}: RecordObjectSwitcherProps) {
  const localisation = useLocalisation()
  const t = localisation.t
  const { state } = objects
  const [creatingMenuOpen, setCreatingMenuOpen] = useState(false)
  const createButton = useRef<HTMLButtonElement>(null)
  const createEventButton = useRef<HTMLButtonElement>(null)
  const previousNavigationStatus = useRef(navigationStatus)
  const pendingMotion = useRef<TemporalMotion | null>(null)
  const pendingOrdinary = useRef<OrdinarySnapshot | null>(null)
  const transitionGeneration = useRef(0)
  const transitionTimer = useRef<ReturnType<
    typeof globalThis.setTimeout
  > | null>(null)
  const ordinaryTimer = useRef<ReturnType<typeof globalThis.setTimeout> | null>(
    null,
  )
  const createDialogId = useId()
  const createHeadingId = useId()
  const currentGroups = useMemo<ObjectGroupsSnapshot>(
    () => ({
      scale,
      state,
      creatingEvent,
      creatingSpan,
      ordinarySummary,
      structuredMediaCounts,
    }),
    [
      creatingEvent,
      creatingSpan,
      ordinarySummary,
      scale,
      state,
      structuredMediaCounts,
    ],
  )
  const desiredRows = useMemo(
    () => ({
      events: rowsFor(state.objects, 'event'),
      spans: rowsFor(state.objects, 'span'),
    }),
    [state.objects],
  )
  const [presented, setPresented] = useState<PresentedObjectGroups>(() => ({
    ...desiredRows,
    motionKind: 'none',
    direction: 'forward',
    transitionId: 0,
  }))
  const [ordinaryTransition, setOrdinaryTransition] =
    useState<OrdinaryTransition>({
      currentId: 0,
      outgoing: null,
      direction: 'forward',
    })

  useLayoutEffect(() => {
    const previous = previousNavigationStatus.current
    if (navigationStatus === 'loading' && previous !== 'loading') {
      pendingMotion.current = motion
      pendingOrdinary.current = ordinaryFrom(currentGroups)
    } else if (navigationStatus === 'ready' && previous === 'loading') {
      const transitionMotion = pendingMotion.current
      const outgoing = pendingOrdinary.current
      if (transitionMotion?.kind === 'horizontal' && outgoing) {
        const currentId = transitionMotion.id
        setOrdinaryTransition({
          currentId,
          outgoing,
          direction:
            transitionMotion.direction === 'backward' ? 'backward' : 'forward',
        })
        if (ordinaryTimer.current !== null) {
          globalThis.clearTimeout(ordinaryTimer.current)
        }
        ordinaryTimer.current = globalThis.setTimeout(
          () =>
            setOrdinaryTransition((current) =>
              current.currentId === currentId
                ? { ...current, outgoing: null }
                : current,
            ),
          prefersReducedMotion() ? 0 : ORDINARY_TRANSITION_FALLBACK_MS,
        )
      }
      pendingOrdinary.current = null
    }
    previousNavigationStatus.current = navigationStatus
  }, [currentGroups, motion, navigationStatus])

  useLayoutEffect(() => {
    if (state.status !== 'ready') return
    const transitionMotion = pendingMotion.current
    pendingMotion.current = null
    const transitionId = (transitionGeneration.current += 1)
    setPresented((current) => ({
      events: reconcileRows(current.events, desiredRows.events),
      spans: reconcileRows(current.spans, desiredRows.spans),
      motionKind: transitionMotion?.kind ?? 'none',
      direction:
        transitionMotion?.direction === 'backward' ? 'backward' : 'forward',
      transitionId,
    }))

    if (transitionTimer.current !== null) {
      globalThis.clearTimeout(transitionTimer.current)
    }
    transitionTimer.current = globalThis.setTimeout(
      () =>
        setPresented((current) =>
          current.transitionId === transitionId
            ? {
                ...current,
                events: settleRows(current.events),
                spans: settleRows(current.spans),
              }
            : current,
        ),
      prefersReducedMotion() ? 0 : ROW_TRANSITION_FALLBACK_MS,
    )
  }, [desiredRows.events, desiredRows.spans, state.status])

  useEffect(
    () => () => {
      if (transitionTimer.current !== null) {
        globalThis.clearTimeout(transitionTimer.current)
      }
      if (ordinaryTimer.current !== null) {
        globalThis.clearTimeout(ordinaryTimer.current)
      }
    },
    [],
  )

  const choose = (object: StructuredSummary) => {
    if (scale === 'day' || object.placement.kind === 'span') {
      objects.selectObject(object)
    } else {
      objects.goToObject(object)
    }
    onNavigate?.()
  }

  return (
    <div className="record-objects">
      <div
        className="record-objects__transition-stack"
        data-status={navigationStatus}
      >
        <ObjectGroups
          snapshot={currentGroups}
          presented={presented}
          ordinaryTransition={ordinaryTransition}
          inert={
            navigationStatus === 'loading' ||
            currentGroups.state.status === 'loading'
          }
          onSelectOrdinary={() => {
            objects.selectOrdinary()
            onNavigate?.()
          }}
          onSelectObject={choose}
        />
      </div>

      {state.status === 'failed' && state.failure ? (
        <div className="record-objects__unavailable">
          <p role="alert" className="record-objects__message">
            {failureMessage(localisation, state.failure)}
          </p>
          <p className="record-objects__message">
            {t('record.objects.unavailableDetail')}
          </p>
          {state.failure.retryable ? (
            <button
              type="button"
              className="button ui-text"
              onClick={objects.retry}
            >
              {t('app.action.retry')}
            </button>
          ) : null}
        </div>
      ) : null}

      {state.bounded ? (
        <p className="record-objects__message">
          {t('record.objects.bounded', { count: state.objects.length })}
        </p>
      ) : null}

      <RecordObjectNoticeBar objects={objects} />

      <div className="record-objects__footer">
        <button
          ref={createButton}
          type="button"
          className="record-objects__add ui-text"
          aria-haspopup="dialog"
          aria-expanded={creatingMenuOpen}
          aria-controls={createDialogId}
          aria-pressed={creatingEvent || creatingSpan}
          disabled={!window || state.status === 'failed'}
          onClick={() => setCreatingMenuOpen(true)}
        >
          <RecordControlIcon name="add" />
          <span>{t('record.objects.newStructured')}</span>
        </button>
      </div>
      <RecordOverlay
        id={createDialogId}
        open={creatingMenuOpen}
        kind="anchored"
        labelledBy={createHeadingId}
        anchorRef={createButton}
        anchorPlacement="above"
        initialFocusRef={createEventButton}
        onClose={() => setCreatingMenuOpen(false)}
        className="record-create-popup"
      >
        <header className="record-overlay__header">
          <h2 id={createHeadingId} className="ui-heading">
            {t('record.objects.newStructured')}
          </h2>
          <button
            type="button"
            className="record-overlay__close"
            aria-label={t('record.objects.closeCreateMenu')}
            onClick={() => setCreatingMenuOpen(false)}
          >
            <RecordControlIcon name="close" />
          </button>
        </header>
        <div className="record-create-popup__options">
          <button
            ref={createEventButton}
            type="button"
            onClick={() => {
              setCreatingMenuOpen(false)
              onCreateEvent()
            }}
          >
            <RecordSemanticIcon id="life-event" decorative />
            <span>{t('record.event.new')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCreatingMenuOpen(false)
              onCreateSpan()
            }}
          >
            <RecordSemanticIcon id="span" decorative />
            <span>{t('record.span.new')}</span>
          </button>
        </div>
      </RecordOverlay>
    </div>
  )
}

function ObjectGroups({
  snapshot,
  presented,
  ordinaryTransition,
  inert,
  onSelectOrdinary,
  onSelectObject,
}: {
  readonly snapshot: ObjectGroupsSnapshot
  readonly presented: PresentedObjectGroups
  readonly ordinaryTransition: OrdinaryTransition
  readonly inert: boolean
  readonly onSelectOrdinary: () => void
  readonly onSelectObject: (object: StructuredSummary) => void
}) {
  const t = useLocalisation().t
  const {
    scale,
    state,
    creatingEvent,
    creatingSpan,
    ordinarySummary,
    structuredMediaCounts,
  } = snapshot
  return (
    <div
      className="record-objects__groups"
      data-object-status={state.status}
      role="group"
      aria-label={t('record.objects.label')}
      aria-busy={state.status === 'loading' || undefined}
      aria-hidden={inert || undefined}
      inert={inert || undefined}
    >
      <div
        className="record-objects__ordinary-stack"
        data-transition={ordinaryTransition.outgoing ? 'true' : undefined}
        data-motion-direction={ordinaryTransition.direction}
      >
        {ordinaryTransition.outgoing ? (
          <div
            key={`ordinary-outgoing:${ordinaryTransition.currentId}`}
            className="record-objects__ordinary-layer"
            data-layer="outgoing"
            aria-hidden="true"
            inert
          >
            <OrdinaryTab
              snapshot={ordinaryTransition.outgoing}
              onSelect={() => undefined}
            />
          </div>
        ) : null}
        <div
          key={`ordinary-current:${ordinaryTransition.currentId}`}
          className="record-objects__ordinary-layer"
          data-layer="current"
        >
          <OrdinaryTab
            snapshot={{
              scale,
              selected:
                state.selected === null && !creatingEvent && !creatingSpan,
              summary: ordinarySummary,
            }}
            onSelect={onSelectOrdinary}
          />
        </div>
      </div>

      <ObjectGroup
        heading={t('record.objects.groupEvents')}
        count={presented.events.filter(isPresentObject).length}
      >
        {presented.events.map((row) => (
          <ObjectRowShell
            key={row.key}
            row={row}
            motionKind={presented.motionKind}
            direction={presented.direction}
          >
            {row.kind === 'empty' ? (
              <EmptyGroup />
            ) : (
              <ObjectTab
                object={row.object}
                selected={
                  row.object.id === state.selected?.id &&
                  !creatingEvent &&
                  !creatingSpan
                }
                onSelect={() => onSelectObject(row.object)}
                mediaCount={
                  row.object.mediaCount ??
                  structuredMediaCounts.get(row.object.id) ??
                  null
                }
              />
            )}
          </ObjectRowShell>
        ))}
      </ObjectGroup>

      <ObjectGroup
        heading={t('record.objects.groupSpans')}
        count={presented.spans.filter(isPresentObject).length}
      >
        {presented.spans.map((row) => (
          <ObjectRowShell
            key={row.key}
            row={row}
            motionKind={presented.motionKind}
            direction={presented.direction}
          >
            {row.kind === 'empty' ? (
              <EmptyGroup />
            ) : (
              <ObjectTab
                object={row.object}
                selected={
                  row.object.id === state.selected?.id &&
                  !creatingEvent &&
                  !creatingSpan
                }
                onSelect={() => onSelectObject(row.object)}
                mediaCount={
                  row.object.mediaCount ??
                  structuredMediaCounts.get(row.object.id) ??
                  null
                }
              />
            )}
          </ObjectRowShell>
        ))}
      </ObjectGroup>
    </div>
  )
}

function ordinaryFrom(snapshot: ObjectGroupsSnapshot): OrdinarySnapshot {
  return {
    scale: snapshot.scale,
    selected:
      snapshot.state.selected === null &&
      !snapshot.creatingEvent &&
      !snapshot.creatingSpan,
    summary: snapshot.ordinarySummary,
  }
}

function OrdinaryTab({
  snapshot,
  onSelect,
}: {
  readonly snapshot: OrdinarySnapshot
  readonly onSelect: () => void
}) {
  const t = useLocalisation().t
  return (
    <button
      type="button"
      className="record-objects__tab record-objects__tab--ordinary ui-text"
      aria-label={t(ORDINARY_LABEL[snapshot.scale])}
      aria-pressed={snapshot.selected}
      onClick={onSelect}
    >
      <span className="record-objects__ordinary-icon" aria-hidden="true">
        <RecordSemanticIcon id="writing" decorative />
      </span>
      <span className="record-objects__tab-copy">
        <span className="record-objects__tab-title">
          {t(ORDINARY_LABEL[snapshot.scale])}
        </span>
        {snapshot.summary?.text || snapshot.summary?.mediaCount ? (
          <span className="record-objects__tab-meta">
            {snapshot.summary.text ? (
              <span className="record-objects__tab-excerpt">
                {snapshot.summary.text}
              </span>
            ) : null}
            <MediaCount count={snapshot.summary.mediaCount} />
          </span>
        ) : null}
      </span>
    </button>
  )
}

function rowsFor(
  objects: readonly StructuredSummary[],
  kind: 'event' | 'span',
): readonly PresentedObjectRow[] {
  const matching = objects.filter((object) => object.placement.kind === kind)
  return matching.length > 0
    ? matching.map((object) => ({
        key: object.id,
        kind: 'object' as const,
        object,
        presence: 'stable' as const,
      }))
    : [
        {
          key: `${kind}:empty`,
          kind: 'empty',
          presence: 'stable',
        },
      ]
}

function reconcileRows(
  previous: readonly PresentedObjectRow[],
  desired: readonly PresentedObjectRow[],
): readonly PresentedObjectRow[] {
  const previousByKey = new Map(previous.map((row) => [row.key, row]))
  const desiredKeys = new Set(desired.map((row) => row.key))
  const rows = desired.map<PresentedObjectRow>((row) => ({
    ...row,
    presence: previousByKey.has(row.key) ? 'stable' : 'entering',
  }))

  previous.forEach((row, index) => {
    if (desiredKeys.has(row.key)) return
    const following = previous
      .slice(index + 1)
      .find((candidate) => desiredKeys.has(candidate.key))
    const insertion = following
      ? rows.findIndex((candidate) => candidate.key === following.key)
      : rows.length
    rows.splice(insertion, 0, { ...row, presence: 'exiting' })
  })
  return rows
}

function settleRows(
  rows: readonly PresentedObjectRow[],
): readonly PresentedObjectRow[] {
  return rows
    .filter((row) => row.presence !== 'exiting')
    .map((row) => ({ ...row, presence: 'stable' }))
}

function isPresentObject(
  row: PresentedObjectRow,
): row is Extract<PresentedObjectRow, { kind: 'object' }> {
  return row.kind === 'object' && row.presence !== 'exiting'
}

function ObjectRowShell({
  row,
  motionKind,
  direction,
  children,
}: {
  readonly row: PresentedObjectRow
  readonly motionKind: PresentedObjectGroups['motionKind']
  readonly direction: PresentedObjectGroups['direction']
  readonly children: ReactNode
}) {
  return (
    <div
      className="record-objects__item-shell"
      data-object-key={row.key}
      data-presence={row.presence}
      data-motion-kind={motionKind}
      data-motion-direction={direction}
      aria-hidden={row.presence === 'exiting' || undefined}
      inert={row.presence === 'exiting' || undefined}
    >
      <div className="record-objects__item-shell-inner">{children}</div>
    </div>
  )
}

function ObjectGroup({
  heading,
  count,
  children,
}: {
  readonly heading: string
  readonly count?: number
  readonly children: ReactNode
}) {
  return (
    <section className="record-objects__group">
      <div className="record-objects__group-heading">
        <h3 className="record-objects__group-title">{heading}</h3>
        {count === undefined ? null : (
          <span className="record-objects__group-count" aria-hidden="true">
            {count}
          </span>
        )}
      </div>
      <div className="record-objects__group-items">{children}</div>
    </section>
  )
}

function EmptyGroup() {
  const t = useLocalisation().t
  return <p className="record-objects__empty">{t('record.objects.noItems')}</p>
}

function ObjectTab({
  object,
  selected,
  onSelect,
  mediaCount,
}: {
  readonly object: StructuredSummary
  readonly selected: boolean
  readonly onSelect: () => void
  readonly mediaCount: number | null
}) {
  const localisation = useLocalisation()
  const format = useFormat()
  return (
    <button
      type="button"
      className={`record-objects__tab ${displayAccentClassName(object.tags.display)}`}
      data-object-id={object.id}
      data-object-kind={object.placement.kind}
      data-display-tag-id={object.tags.display ?? undefined}
      aria-label={objectName(localisation, format, object)}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <RecordSemanticIcon id={object.iconId} className="record-objects__icon" />
      <span className="record-objects__tab-copy" aria-hidden="true">
        <span className="record-objects__tab-title">{object.title}</span>
        {object.placement.kind === 'span' || mediaCount ? (
          <span className="record-objects__tab-meta">
            {object.placement.kind === 'span' ? (
              <span className="record-objects__tab-when">
                {objectWhen(localisation, format, object)}
              </span>
            ) : null}
            <MediaCount count={mediaCount} />
          </span>
        ) : null}
      </span>
    </button>
  )
}

function MediaCount({ count }: { readonly count: number | null }) {
  const format = useFormat()
  if (!count) return null
  return (
    <span className="record-objects__media-count" aria-hidden="true">
      <RecordControlIcon name="media" />
      <span>{format.number(count)}</span>
    </span>
  )
}
