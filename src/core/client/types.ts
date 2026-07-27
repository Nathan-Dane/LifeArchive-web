/**
 * Ergonomic public value types for the LifeArchive web client.
 *
 * These are handwritten presentation-facing values, not generated runtime
 * declarations. Wire envelopes, generated bindings, and transport records stay
 * beneath `LifeArchiveClient` and never appear here or in component props.
 *
 * Three rules shape every type in this file:
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
/* Ordinary Record                                                            */
/* -------------------------------------------------------------------------- */

/** One ordinary entry addressed by its exact core-produced window. */
export interface OrdinaryEntry {
  readonly id: StableId
  readonly revision: Revision
  readonly window: TimeWindow
  /** The exact stored Markdown. Never trimmed or rebuilt by the client. */
  readonly markdown: string
  /** The core's plain-text projection of the same writing. */
  readonly plainText: string
  readonly createdAtMs: Instant
  readonly updatedAtMs: Instant
  readonly isPinned: boolean
  readonly privacy: PrivacyLevel
  readonly source: ContentSource
}

export type OrdinaryEntryState =
  | {
      readonly presence: 'absent'
      readonly window: TimeWindow
      readonly invalidation: InvalidationToken
    }
  | {
      readonly presence: 'present'
      readonly window: TimeWindow
      readonly entry: OrdinaryEntry
      readonly invalidation: InvalidationToken
    }

/** Which entry a save expects to modify. Absence is stated, never inferred. */
export type OrdinaryTarget =
  | { readonly expectation: 'absent'; readonly newEntryId: StableId }
  | {
      readonly expectation: 'existing'
      readonly entryId: StableId
      readonly expectedRevision: Revision
    }

export interface OrdinarySaveRequest {
  readonly window: TimeWindow
  /** The exact buffer to store, byte for byte. */
  readonly markdown: string
  readonly nowMs: Instant
  readonly target: OrdinaryTarget
}

/**
 * The core's save decision. `removed-as-empty` and `absent-unchanged` are core
 * outcomes for empty writing; the client never decides that an entry should
 * disappear.
 */
export type OrdinarySaveResult =
  | {
      readonly outcome: 'created' | 'updated' | 'unchanged'
      readonly entry: OrdinaryEntry
      readonly invalidation: InvalidationToken
    }
  | {
      readonly outcome: 'removed-as-empty'
      readonly removedEntryId: StableId
      readonly removedRevision: Revision
      readonly invalidation: InvalidationToken
    }
  | {
      readonly outcome: 'absent-unchanged'
      readonly invalidation: InvalidationToken
    }
  | {
      readonly outcome: 'conflict'
      readonly conflict: RevisionConflict<OrdinaryEntryState>
    }

export interface OrdinaryDeleteRequest {
  readonly entryId: StableId
  readonly expectedRevision: Revision
  readonly nowMs: Instant
}

export type OrdinaryDeleteResult =
  | {
      readonly outcome: 'deleted'
      readonly deletedEntryId: StableId
      readonly deletedRevision: Revision
      readonly invalidation: InvalidationToken
    }
  | {
      readonly outcome: 'conflict'
      readonly conflict: RevisionConflict<OrdinaryEntryState>
    }

/* -------------------------------------------------------------------------- */
/* Structured Record                                                          */
/* -------------------------------------------------------------------------- */

export type StructuredKind = 'event' | 'span'

/** A Span boundary marker configuration. Markers are derived presentations. */
export interface MarkerConfiguration {
  readonly enabled: boolean
  readonly titleOverride: string | null
}

/**
 * Where a structured object sits in civil time. A Span with `endDate: null` is
 * ongoing; the client presents that as Present and never substitutes a derived
 * end date.
 */
export type StructuredPlacement =
  | { readonly kind: 'event'; readonly date: CivilDate }
  | {
      readonly kind: 'span'
      readonly startDate: CivilDate
      readonly endDate: CivilDate | null
      readonly beginMarker: MarkerConfiguration
      readonly endMarker: MarkerConfiguration
    }

/**
 * Ordered tags plus the single display tag. Compact surfaces use the display
 * tag alone; the complete ordered collection belongs to editors and details.
 */
export interface StructuredTags {
  readonly ordered: readonly SemanticId[]
  readonly display: SemanticId | null
}

export interface StructuredSummary {
  readonly id: StableId
  readonly revision: Revision
  readonly title: string
  readonly placement: StructuredPlacement
  readonly iconId: SemanticId
  readonly tags: StructuredTags
  readonly trackId: StableId | null
}

export interface StructuredObject {
  readonly summary: StructuredSummary
  readonly markdown: string
  readonly createdAtMs: Instant
  readonly updatedAtMs: Instant
  readonly privacy: PrivacyLevel
  readonly media: readonly MediaItem[]
  readonly hasMoreMedia: boolean
}

export type StructuredObjectState =
  | { readonly presence: 'absent'; readonly id: StableId }
  | {
      readonly presence: 'present'
      readonly object: StructuredObject
      readonly invalidation: InvalidationToken
    }
  | {
      readonly presence: 'deleted'
      readonly object: StructuredObject
      readonly deletedAtMs: Instant
      readonly invalidation: InvalidationToken
    }

export interface StructuredDraft {
  readonly title: string
  readonly markdown: string
  readonly placement: StructuredPlacement
  readonly iconId: SemanticId
  readonly tags: StructuredTags
  readonly trackId: StableId | null
  readonly privacy: PrivacyLevel
}

export interface StructuredLoadRequest {
  readonly id: StableId
  readonly includeDeleted: boolean
}

export interface StructuredCreateRequest {
  readonly newObjectId: StableId
  readonly draft: StructuredDraft
  readonly nowMs: Instant
}

export interface StructuredSaveRequest {
  readonly id: StableId
  readonly expectedRevision: Revision
  readonly draft: StructuredDraft
  readonly nowMs: Instant
}

export interface StructuredDeleteRequest {
  readonly id: StableId
  readonly expectedRevision: Revision
  readonly nowMs: Instant
}

export interface StructuredConvertRequest {
  readonly spanId: StableId
  readonly expectedRevision: Revision
  readonly nowMs: Instant
}

export type StructuredMutationResult =
  | {
      readonly outcome: 'created' | 'updated' | 'unchanged' | 'converted'
      readonly object: StructuredObject
      readonly invalidation: InvalidationToken
    }
  | {
      readonly outcome: 'conflict'
      readonly conflict: RevisionConflict<StructuredObjectState>
    }

export type StructuredDeleteResult =
  | {
      readonly outcome: 'deleted'
      readonly deletedId: StableId
      readonly deletedRevision: Revision
      readonly invalidation: InvalidationToken
    }
  | {
      readonly outcome: 'conflict'
      readonly conflict: RevisionConflict<StructuredObjectState>
    }

export interface StructuredListRequest {
  readonly window: TimeWindow
  readonly limit: number
}

/** Objects in the core's order. The client does not re-sort or re-window. */
export interface StructuredListPage {
  readonly objects: readonly StructuredSummary[]
  readonly invalidation: InvalidationToken
}

/* -------------------------------------------------------------------------- */
/* Tracks                                                                     */
/* -------------------------------------------------------------------------- */

export interface Track {
  readonly id: StableId
  readonly revision: Revision
  readonly name: string
  readonly iconId: SemanticId
  readonly suggestedTagId: SemanticId | null
  readonly isArchived: boolean
  readonly createdAtMs: Instant
  readonly updatedAtMs: Instant
}

export interface TrackSummary {
  readonly track: Track
  readonly memberCount: number
  readonly ongoingMemberCount: number
}

export type TrackState =
  | { readonly presence: 'absent'; readonly id: StableId }
  | {
      readonly presence: 'present'
      readonly track: Track
      readonly invalidation: InvalidationToken
    }
  | {
      readonly presence: 'deleted'
      readonly track: Track
      readonly invalidation: InvalidationToken
    }

export interface TrackDraft {
  readonly name: string
  readonly iconId: SemanticId
  readonly suggestedTagId: SemanticId | null
  readonly isArchived: boolean
}

export interface TrackListRequest {
  readonly includeArchived: boolean
  readonly limit: number
}

export interface TrackListPage {
  readonly tracks: readonly TrackSummary[]
  readonly invalidation: InvalidationToken
}

export interface TrackCreateRequest {
  readonly newTrackId: StableId
  readonly draft: TrackDraft
  readonly nowMs: Instant
}

export interface TrackSaveRequest {
  readonly id: StableId
  readonly expectedRevision: Revision
  readonly draft: TrackDraft
  readonly nowMs: Instant
}

/**
 * Deleting a populated Track requires the explicit detach decision. There is
 * no client-side default for what happens to members.
 */
export interface TrackDeleteRequest {
  readonly id: StableId
  readonly expectedRevision: Revision
  readonly detachMembers: boolean
  readonly nowMs: Instant
}

export type TrackMutationResult =
  | {
      readonly outcome: 'created' | 'updated' | 'unchanged' | 'deleted'
      readonly track: Track
      readonly detachedMemberCount: number
      readonly invalidation: InvalidationToken
    }
  | {
      readonly outcome: 'conflict'
      readonly conflict: RevisionConflict<TrackState>
    }

export interface TrackWithFirstMemberRequest {
  readonly newTrackId: StableId
  readonly newMemberId: StableId
  readonly track: TrackDraft
  readonly member: StructuredDraft
  readonly nowMs: Instant
}

export interface TrackWithFirstMember {
  readonly track: Track
  readonly member: StructuredObject
  readonly invalidation: InvalidationToken
}

export interface TrackMemberCreateRequest {
  readonly trackId: StableId
  readonly expectedTrackRevision: Revision
  readonly expectedInvalidation: InvalidationToken
  readonly newMemberId: StableId
  readonly member: StructuredDraft
  readonly nowMs: Instant
}

/** Attaching moves a member; detaching passes no Track. */
export interface TrackMembershipRequest {
  readonly memberId: StableId
  readonly expectedMemberRevision: Revision
  readonly expectedInvalidation: InvalidationToken
  readonly trackId: StableId
  readonly nowMs: Instant
}

export interface TrackDetachRequest {
  readonly memberId: StableId
  readonly expectedMemberRevision: Revision
  readonly expectedInvalidation: InvalidationToken
  readonly nowMs: Instant
}

/** One Track member in the core's history order. */
export interface TrackMember {
  readonly id: StableId
  readonly revision: Revision
  readonly kind: StructuredKind
  readonly title: string
  readonly primaryDate: CivilDate
  readonly endDate: CivilDate | null
  readonly iconId: SemanticId
  readonly displayTagId: SemanticId | null
  readonly beginMarkerTitleOverride: string | null
  readonly endMarkerTitleOverride: string | null
}

/** An opaque core-owned history position. */
export type TrackHistoryCursor = Branded<string, 'TrackHistoryCursor'>

/** Marks a core-produced history cursor. Client implementations only. */
export function coreTrackHistoryCursor(value: string): TrackHistoryCursor {
  return value as TrackHistoryCursor
}

export interface TrackHistoryRequest {
  readonly trackId: StableId
  readonly expectedTrackRevision: Revision
  readonly expectedInvalidation: InvalidationToken
  readonly limit: number
  readonly cursor: TrackHistoryCursor | null
}

export interface TrackHistoryPage {
  readonly track: Track
  readonly members: readonly TrackMember[]
  readonly nextCursor: TrackHistoryCursor | null
  readonly invalidation: InvalidationToken
}

/* -------------------------------------------------------------------------- */
/* Timeline                                                                   */
/* -------------------------------------------------------------------------- */

export interface TimelineEntryReference {
  readonly id: StableId
  readonly revision: Revision
}

/**
 * A boundary marker candidate derived from its parent Span. It has no identity
 * of its own and is never written.
 */
export interface BoundaryMarker {
  readonly boundary: 'begin' | 'end'
  readonly date: CivilDate
  readonly parentSpanId: StableId
  readonly parentSpanRevision: Revision
  readonly parentStartDate: CivilDate
  readonly parentEndDate: CivilDate | null
  readonly trackId: StableId | null
  readonly titleMode: 'automatic' | 'override'
  readonly titleOverride: string | null
  readonly iconId: SemanticId
  readonly displayTagId: SemanticId | null
}

/** One lightweight row per requested window, counted by the core. */
export interface TimelineRow {
  readonly window: TimeWindow
  readonly exactEntry: TimelineEntryReference | null
  readonly exactEntryHasWriting: boolean
  readonly mediaCount: number
  readonly containedEntryCounts: {
    readonly day: number
    readonly week: number
    readonly month: number
  }
  readonly coverage: { readonly filled: number; readonly total: number } | null
  readonly hasContent: boolean
}

/**
 * One bounded, ordered, contiguous request. The caller asks once for the whole
 * visible window; a request per row is a boundary defect.
 */
export interface TimelineIndexRequest {
  readonly windows: readonly TimeWindow[]
  readonly weekRules: WeekRules
  /** The observed civil date used for ongoing presentation facts only. */
  readonly asOf: CivilDate
}

export interface TimelinePage {
  readonly rows: readonly TimelineRow[]
  readonly scene: readonly StructuredSummary[]
  readonly markerCandidates: readonly BoundaryMarker[]
  readonly contentBounds: {
    readonly startMs: Instant
    readonly endMs: Instant
  } | null
  readonly structuredContentEndDate: CivilDate | null
  readonly invalidation: InvalidationToken
}

export interface TimelineFocusRequest {
  readonly window: TimeWindow
  readonly entry: TimelineEntryReference | null
  readonly expectedInvalidation: InvalidationToken
}

export interface TimelineFocusedEntry {
  readonly reference: TimelineEntryReference
  readonly text: string
  readonly preview: string
}

/**
 * `stale` means the index snapshot moved on. It is an ordinary state, not an
 * error, and the caller re-reads the index rather than patching a row.
 */
export type TimelineFocusResult =
  | {
      readonly outcome: 'focused'
      readonly window: TimeWindow
      readonly entry: TimelineFocusedEntry | null
      readonly media: readonly MediaItem[]
      readonly invalidation: InvalidationToken
    }
  | { readonly outcome: 'stale' }

export interface TimelineStructuredDetailRequest {
  readonly id: StableId
  readonly expectedRevision: Revision
  readonly expectedInvalidation: InvalidationToken
}

export type TimelineStructuredDetailResult =
  | {
      readonly outcome: 'detail'
      readonly object: StructuredObject
      readonly invalidation: InvalidationToken
    }
  | { readonly outcome: 'stale' }

export interface TimelineStructuredListRequest {
  readonly ids: readonly StableId[]
  readonly limit: number
  readonly expectedInvalidation: InvalidationToken
}

export type TimelineStructuredListResult =
  | {
      readonly outcome: 'listed'
      readonly objects: readonly StructuredSummary[]
      readonly invalidation: InvalidationToken
    }
  | { readonly outcome: 'stale' }

/* -------------------------------------------------------------------------- */
/* Media                                                                      */
/* -------------------------------------------------------------------------- */

export type MediaKind =
  'image' | 'video' | 'audio' | 'document' | 'text' | 'other'

/**
 * Durable media metadata. There is no resolved path here: the browser never
 * learns the core's internal media layout.
 */
export interface MediaItem {
  readonly id: StableId
  readonly parentEntryId: StableId
  readonly fileName: string
  readonly kind: MediaKind
  readonly mimeType: string
  readonly byteSize: number
  readonly createdAtMs: Instant
  readonly capturedAtMs: Instant | null
  readonly durationMs: number | null
  readonly width: number | null
  readonly height: number | null
  readonly caption: string | null
}

export interface MediaListRequest {
  readonly parentEntryId: StableId
}

export interface MediaListing {
  readonly parentEntryId: StableId
  readonly parentRevision: Revision
  readonly items: readonly MediaItem[]
  readonly invalidation: InvalidationToken
}

export interface MediaContentRequest {
  readonly mediaId: StableId
}

/** Bytes the core validated and delivered for preview. */
export interface MediaContent {
  readonly mediaId: StableId
  readonly bytes: Uint8Array
  readonly byteSize: number
  readonly sha256: string | null
}

/**
 * A picker handle or object URL is an acquisition input only. Media is durable
 * once the core owns these bytes.
 */
export interface MediaImportRequest {
  readonly newMediaId: StableId
  readonly parentEntryId: StableId
  readonly expectedParentRevision: Revision
  readonly fileName: string
  readonly bytes: ArrayBuffer
  readonly createdAtMs: Instant
  /** Hints only. The core owns durable classification and placement. */
  readonly mimeTypeHint: string | null
  readonly kindHint: MediaKind | null
}

export type MediaImportResult =
  | {
      readonly outcome: 'imported'
      readonly item: MediaItem
      readonly invalidation: InvalidationToken
    }
  | {
      readonly outcome: 'conflict'
      readonly conflict: RevisionConflict<MediaListing>
    }

export interface MediaDeleteRequest {
  readonly mediaId: StableId
  readonly parentEntryId: StableId
  readonly expectedParentRevision: Revision
}

export type MediaDeleteResult =
  | {
      readonly outcome: 'deleted'
      readonly deletedMediaId: StableId
      readonly invalidation: InvalidationToken
    }
  | {
      readonly outcome: 'conflict'
      readonly conflict: RevisionConflict<MediaListing>
    }

/* -------------------------------------------------------------------------- */
/* Archive identity                                                           */
/* -------------------------------------------------------------------------- */

export type LifeStatus = 'unspecified' | 'living' | 'deceased'

export interface ArchiveSubject {
  readonly id: StableId
  readonly displayName: string | null
  readonly shortName: string | null
  readonly lifeStatus: LifeStatus
  readonly dateOfBirth: CivilDate | null
  readonly dateOfDeath: CivilDate | null
}

/**
 * The complete portable identity. Both stable IDs are preserved on save; the
 * client never replaces one or invents a fallback title.
 */
export interface ArchiveIdentity {
  readonly id: StableId
  readonly title: string | null
  readonly subject: ArchiveSubject
}

export interface ArchiveIdentityState {
  readonly identity: ArchiveIdentity
  readonly invalidation: InvalidationToken
}

export interface ArchiveIdentitySaveResult {
  readonly outcome: 'updated' | 'unchanged'
  readonly identity: ArchiveIdentity
  readonly invalidation: InvalidationToken
}

/* -------------------------------------------------------------------------- */
/* Runtime and storage facts                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Which client implementation is answering. A development mock is explicit and
 * visible; production never selects one.
 */
export type ClientMode = 'runtime' | 'development-mock'

/**
 * Runtime durability as the runtime itself reports it. `best-effort` and
 * `unproven` must never be presented as backed up.
 */
export type StorageDurability = 'durable' | 'best-effort' | 'unproven'

/** The browser's persistence decision, which the browser owns. */
export type PersistenceGrant = 'granted' | 'denied' | 'unknown' | 'unsupported'

/** Browser quota figures, which are approximate by definition. */
export interface StorageEstimate {
  readonly usedBytes: number
  readonly quotaBytes: number
  readonly approximate: true
}

/**
 * The four separate storage facts the UI may state. Runtime durability, the
 * current archive state, the persistence grant, and the estimate are distinct
 * claims and are never collapsed into one badge.
 */
export interface StorageFacts {
  readonly backend: string
  readonly durability: StorageDurability
  readonly archiveOpen: boolean
  readonly grant: PersistenceGrant
  readonly estimate: StorageEstimate | null
}

export interface RuntimeFacts {
  readonly mode: ClientMode
  readonly runtimeVersion: string
  readonly buildId: string
  readonly productContract: string
  readonly browserAbi: string
  readonly backend: string
  readonly durability: StorageDurability
}

export type RuntimeIncompatibleReason =
  | 'not-pinned'
  | 'checksum-mismatch'
  | 'manifest-mismatch'
  | 'contract-mismatch'
  | 'abi-mismatch'
  | 'capability-inventory-mismatch'
  | 'environment-unsupported'

export type RuntimeUnavailableReason =
  | 'not-integrated'
  | 'download-failed'
  | 'load-failed'
  | 'worker-unsupported'
  | 'insecure-context'
  | 'worker-lost'

/**
 * There is no partial runtime and no quiet degradation: a runtime either
 * negotiated the whole approved surface or the client says why it did not.
 */
export type RuntimeStatus =
  | { readonly state: 'checking' }
  | {
      readonly state: 'available'
      readonly runtime: RuntimeFacts
    }
  | {
      readonly state: 'incompatible'
      readonly reason: RuntimeIncompatibleReason
    }
  | {
      readonly state: 'unavailable'
      readonly reason: RuntimeUnavailableReason
    }

/* -------------------------------------------------------------------------- */
/* Archive lifecycle and management                                           */
/* -------------------------------------------------------------------------- */

/** Whether started durable work is known to have completed. */
export type DurableOutcome = 'known' | 'not-started' | 'unknown'

export interface OpenArchive {
  readonly storeId: StableId
  readonly productContract: string
  readonly storeSchemaVersion: string
  readonly rootLayoutVersion: string
  readonly invalidation: InvalidationToken
}

/**
 * The archive lifecycle as the UI may present it. A failed open never becomes
 * an empty replacement archive, and lost ownership is stated, not hidden.
 */
export type ArchiveSession =
  | { readonly state: 'no-archive' }
  | { readonly state: 'opening' }
  | { readonly state: 'open'; readonly archive: OpenArchive }
  | { readonly state: 'closing' }
  | { readonly state: 'closed' }
  | { readonly state: 'open-in-another-tab' }
  | { readonly state: 'needs-recovery' }
  | { readonly state: 'incompatible' }
  | {
      readonly state: 'lost'
      readonly durableOutcome: DurableOutcome
    }

/**
 * Close is definitive. `already-closed` is the idempotent outcome, and a
 * failed close is never presented as closed.
 */
export interface ArchiveCloseResult {
  readonly outcome: 'closed' | 'already-closed'
}

/** Ordinary entry scales the core counts, including ones v0.1 does not edit. */
export type CountedEntryScale =
  'moment' | 'day' | 'week' | 'month' | 'year' | 'custom'

/**
 * Health facts as the current product surface reports them on success. A new
 * reported value is a capability change, not something the client invents.
 */
export interface ArchiveHealthFacts {
  readonly readable: boolean
  readonly schemaCompatible: boolean
  readonly recovery: 'clean'
  readonly integrity: 'verified'
  readonly referenceViolationCount: number
  readonly overall: 'healthy'
}

export interface ArchiveOverview {
  readonly storeId: StableId
  readonly storeSchemaVersion: string
  readonly storeContract: string
  readonly visibleEntryCount: number
  readonly entryCounts: Readonly<Record<CountedEntryScale, number>>
  readonly structuredCounts: {
    readonly events: number
    readonly spans: number
  }
  readonly trackCounts: {
    readonly active: number
    readonly archived: number
    readonly ongoingMembers: number
  }
  readonly mediaCount: number
  readonly mediaByteTotal: number
  readonly health: ArchiveHealthFacts
  readonly invalidation: InvalidationToken
}

/**
 * The opaque archive package as the platform hands it over. The client moves
 * it; only the core reads or writes what is inside.
 */
export type ArchivePackage = File

export interface ArchiveVerifyRequest {
  readonly archive: ArchivePackage
}

export interface ArchiveVerificationIssue {
  readonly code: string
  readonly path: string | null
}

/**
 * A read-only integrity report. Verification never implies a backup, a sync,
 * or that the archive is stored anywhere in particular.
 */
export interface ArchiveVerification {
  readonly valid: boolean
  readonly issues: readonly ArchiveVerificationIssue[]
  readonly checkedFiles: number
}

export interface ArchiveExportRequest {
  readonly operationId: OperationId
  readonly archiveId: StableId
  readonly createdAtMs: Instant
  readonly application: { readonly name: string; readonly version: string }
}

export interface ArchiveExportResult {
  readonly archive: ArchivePackage
  readonly archiveId: StableId
  /** The exact core-produced creation timestamp text. */
  readonly createdAt: string
  readonly counts: {
    readonly entries: number
    readonly media: number
    readonly summaries: number
  }
  readonly dateRange: { readonly start: string; readonly end: string } | null
  readonly filesWritten: number
  readonly checkedFiles: number
  readonly checksumAlgorithm: 'sha256'
  readonly invalidation: InvalidationToken
}

export interface ArchiveImportRequest {
  readonly operationId: OperationId
  readonly archive: ArchivePackage
}

export interface ArchiveImportIssue {
  readonly code: string
  /** Absent when the issue is about the package rather than one record. */
  readonly recordKind: 'entry' | 'media' | 'track' | null
  readonly id: StableId | null
}

/**
 * What import did to identity. An empty archive may adopt identity; a matching
 * archive only fills empty fields and reports the fields it did not overwrite.
 *
 * The outcome carries no identity value: application reports what it did, and
 * the resulting identity is read through `identity.load` rather than inferred
 * here from a partial echo.
 */
export type ArchiveImportIdentityOutcome =
  | { readonly outcome: 'preserved' }
  | { readonly outcome: 'adopted' }
  | {
      readonly outcome: 'filled'
      readonly unchangedFields: readonly string[]
    }

/**
 * Import merges and skips; it never overwrites or replaces. Skipped stable IDs
 * are reported so the user can be told exactly what was already present.
 */
export interface ArchiveImportResult {
  readonly importedEntries: number
  readonly importedMedia: number
  readonly skippedEntries: number
  readonly skippedMedia: number
  readonly skippedEntryIds: readonly StableId[]
  readonly skippedMediaIds: readonly StableId[]
  readonly issues: readonly ArchiveImportIssue[]
  readonly identity: ArchiveImportIdentityOutcome
  readonly invalidation: InvalidationToken
}

/** Erase is deliberate. The confirmation is part of the request, not a flag. */
export interface ArchiveEraseRequest {
  readonly confirmation: 'erase-this-archive'
}

export interface ArchiveEraseResult {
  readonly outcome: 'erased'
  readonly invalidation: InvalidationToken
}

/* -------------------------------------------------------------------------- */
/* Cancellation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The result of asking the core to cancel one active export or import.
 * Requesting cancellation does not settle the awaiting call: that call still
 * receives the core's one definitive outcome, so no durable result becomes
 * unknowable because a view was disposed.
 */
export interface CancellationRequestResult {
  readonly operationId: OperationId
  readonly outcome: 'requested' | 'not-active'
}
