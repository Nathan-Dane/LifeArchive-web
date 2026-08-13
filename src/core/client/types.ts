/**
 * Ergonomic public value types for the LifeArchive web client.
 *
 * These are handwritten presentation-facing values, not generated runtime
 * declarations. Wire envelopes, generated bindings, and transport records stay
 * beneath `LifeArchiveClient` and never appear here or in component props.
 *
 * Three rules shape every client value type:
 *
 * 1. **The core decides, the client maps.** Nothing here validates a civil
 *    date, resolves a window, orders a list, resolves a conflict, or derives a
 *    count. Where a value looks like a decision, the runtime already made it.
 * 2. **Absence is explicit.** Optional durable values are `T | null` or a
 *    dedicated union member. No empty string, zero, or default enum stands in
 *    for "not there".
 * 3. **Exactness survives.** Revisions are lossless canonical decimal strings,
 *    stable IDs keep their exact text, and writing is the exact Markdown the
 *    core stored.
 */

/** Marker used to keep exact identifier and core-produced values distinct. */
export interface Brand<Name extends string> {
  readonly lifearchiveBrand: Name
}

type Branded<Value, Name extends string> = Value & Brand<Name>

/* -------------------------------------------------------------------------- */
/* Exact scalar values                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A durable stable identifier in canonical hyphenated UUID text. Existing IDs
 * are never regenerated, re-cased, or reformatted.
 */
export type StableId = Branded<string, 'StableId'>

/** The identifier a caller attaches to one cancellable archive operation. */
export type OperationId = Branded<string, 'OperationId'>

/**
 * A mutation or invalidation revision as a canonical unsigned 64-bit decimal
 * string. It stays a string at every depth so JavaScript number precision can
 * never change it.
 */
export type Revision = Branded<string, 'Revision'>

/** A Gregorian civil date in canonical `YYYY-MM-DD` text. */
export type CivilDate = Branded<string, 'CivilDate'>

/**
 * A stable semantic identifier owned by the core — an icon or tag ID. The
 * client passes it through; it never invents, defaults, or reorders one.
 */
export type SemanticId = string

/** A signed Unix-millisecond instant. */
export type Instant = number

/** Removes a subscription created by an `observe…` method. */
export type Unsubscribe = () => void

const STABLE_ID =
  /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/
const REVISION = /^(0|[1-9][0-9]{0,19})$/
const MAXIMUM_REVISION = '18446744073709551615'
const CIVIL_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/

export function isStableId(value: string): boolean {
  return STABLE_ID.test(value)
}

/**
 * Accepts canonical revision text without narrowing it to a JavaScript number.
 * Syntax only: whether a revision is current is a core decision.
 */
export function isRevision(value: string): boolean {
  if (!REVISION.test(value)) {
    return false
  }
  return (
    value.length < MAXIMUM_REVISION.length ||
    (value.length === MAXIMUM_REVISION.length && value <= MAXIMUM_REVISION)
  )
}

/**
 * Accepts canonical civil-date syntax. Whether the date exists in the
 * proleptic Gregorian calendar is decided by the core, not here.
 */
export function isCivilDate(value: string): boolean {
  return CIVIL_DATE.test(value)
}

/** Marks exact identifier text. Throws for malformed transport text. */
export function stableId(value: string): StableId {
  if (!isStableId(value)) {
    throw new TypeError('Malformed stable identifier')
  }
  return value as StableId
}

/** Marks a caller-supplied cancellable operation identifier. */
export function operationId(value: string): OperationId {
  if (!isStableId(value)) {
    throw new TypeError('Malformed operation identifier')
  }
  return value as OperationId
}

/** Marks lossless revision text. Throws for malformed transport text. */
export function revision(value: string): Revision {
  if (!isRevision(value)) {
    throw new TypeError('Malformed revision')
  }
  return value as Revision
}

/** Marks canonical civil-date text. Throws for malformed transport text. */
export function civilDate(value: string): CivilDate {
  if (!isCivilDate(value)) {
    throw new TypeError('Malformed civil date')
  }
  return value as CivilDate
}

/* -------------------------------------------------------------------------- */
/* Invalidation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A cache-equality hint. Compare both fields. A reopen produces a new instance
 * ID and restarts the revision. It is not an edit history, event log, sync
 * cursor, or evidence that storage was untampered.
 */
export interface InvalidationToken {
  readonly storeInstanceId: string
  readonly revision: Revision
}

/** One observed change notice for an open archive. */
export interface ArchiveChange {
  readonly storeId: StableId
  readonly invalidation: InvalidationToken
}

/* -------------------------------------------------------------------------- */
/* Time windows                                                               */
/* -------------------------------------------------------------------------- */

/** The navigation scales v0.1 presents. */
export type TimeScale = 'day' | 'week' | 'month' | 'year'

/** Device week settings the caller supplies to core time navigation. */
export interface WeekRules {
  readonly firstWeekday: number
  readonly minimumDaysInFirstWeek: number
}

export interface TimeWindowFields {
  /** Opaque core-assigned window identity, stable for the same window. */
  readonly id: string
  readonly scale: TimeScale
  readonly startMs: Instant
  readonly endMs: Instant
  /** Exact inclusive civil bounds produced by core for boundary requests. */
  readonly startDate: CivilDate
  readonly endDate: CivilDate
  /** Core-produced week ordinal for Day/Week; Month/Year have no single week. */
  readonly weekNumber: number | null
  readonly calendarId: string
  readonly timeZoneId: string
}

/**
 * A bounded time window produced by core time navigation. Feature code
 * receives one and passes it back; it never computes containment, traversal,
 * week numbering, or bounds, and never builds one from a date guess.
 */
export type TimeWindow = Branded<TimeWindowFields, 'TimeWindow'>

/**
 * Marks a core-produced window. Client implementations (runtime adapter and
 * development mock) call this while mapping a core result. Feature code does
 * not: a window it fabricated would be a second time authority.
 */
export function coreTimeWindow(fields: TimeWindowFields): TimeWindow {
  return Object.freeze({ ...fields }) as TimeWindow
}

export interface TimeWindowRequest {
  readonly scale: TimeScale
  readonly containing: CivilDate
  readonly timeZoneId: string
  readonly weekRules: WeekRules
}

export type WindowStep = 'previous' | 'next'

export interface WindowStepRequest {
  readonly window: TimeWindow
  readonly step: WindowStep
  readonly weekRules: WeekRules
}

/** One core-placed calendar cell. */
export interface CalendarDay {
  readonly date: CivilDate
  readonly window: TimeWindow
  readonly withinFocusedMonth: boolean
}

/**
 * The week strip and its surrounding month, both placed by the core so the
 * expandable calendar renders without any browser-side calendar arithmetic.
 */
export interface CalendarContext {
  readonly focused: TimeWindow
  readonly focusedDate: CivilDate
  readonly week: readonly CalendarDay[]
  readonly month: readonly CalendarDay[]
}

export interface CalendarContextRequest {
  readonly focusedDate: CivilDate
  readonly timeZoneId: string
  readonly weekRules: WeekRules
}

/* -------------------------------------------------------------------------- */
/* Shared record values                                                       */
/* -------------------------------------------------------------------------- */

export type PrivacyLevel = 'normal' | 'sensitive' | 'locked'

/** How durable content came to exist, as reported by the core. */
export type ContentSource = 'manual' | 'imported' | 'recovered'

/**
 * A rejected mutation that preserves the caller's unsaved buffer. The client
 * reports current state and chooses nothing: no merge, no retry, no overwrite.
 */
export interface RevisionConflict<Current> {
  readonly expectedRevision: Revision
  readonly actualRevision: Revision
  readonly current: Current
}

/* -------------------------------------------------------------------------- */
/* Opaque product cursors                                                     */
/* -------------------------------------------------------------------------- */

export type TrackHistoryCursor = Branded<string, 'TrackHistoryCursor'>

/** Marks a core-produced history cursor. Client implementations only. */
export function coreTrackHistoryCursor(value: string): TrackHistoryCursor {
  return value as TrackHistoryCursor
}
