import type {
  CivilDate,
  ContentSource,
  Instant,
  InvalidationToken,
  PrivacyLevel,
  Revision,
  RevisionConflict,
  SemanticId,
  StableId,
  TrackHistoryCursor,
  TimeWindow,
  WeekRules,
} from './types'

/** Active Entry kinds counted by archive overview and People memories. */
export type CountedEntryKind =
  'day' | 'week' | 'month' | 'year' | 'event' | 'span'

/** Opaque core-owned identity for one durable Entry section. */
export type EntrySectionId = string

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

/**
 * The current ordinary value returned with a rejected mutation. Conflict
 * evidence is not a cache snapshot, so it deliberately carries no invalidation
 * token.
 */
export type OrdinaryConflictState =
  | {
      readonly presence: 'absent'
      readonly window: TimeWindow
    }
  | {
      readonly presence: 'present'
      readonly window: TimeWindow
      readonly entry: OrdinaryEntry
    }
  | {
      readonly presence: 'deleted'
      readonly window: TimeWindow
      readonly entry: OrdinaryEntry
      readonly deletedAtMs: Instant
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
  /** Optional sections to create with a previously absent Entry. */
  readonly creationSectionIds?: readonly EntrySectionId[]
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
      readonly conflict: RevisionConflict<OrdinaryConflictState>
    }

export interface OrdinaryDeleteRequest {
  readonly window: TimeWindow
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
      readonly conflict: RevisionConflict<OrdinaryConflictState>
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
  /** Core-projected count for compact navigation when the contract provides it. */
  readonly mediaCount?: number
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

/** Tokenless current state returned only as revision-conflict evidence. */
export type StructuredConflictState =
  | { readonly presence: 'absent'; readonly id: StableId }
  | {
      readonly presence: 'present'
      readonly object: StructuredObject
    }
  | {
      readonly presence: 'deleted'
      readonly object: StructuredObject
      readonly deletedAtMs: Instant
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
  readonly creationSectionIds?: readonly EntrySectionId[]
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
  readonly requestedStartDate: CivilDate
  readonly requestedEndDate: CivilDate
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
      readonly conflict: RevisionConflict<StructuredConflictState>
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
      readonly conflict: RevisionConflict<StructuredConflictState>
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

/** Tokenless current state returned only as revision-conflict evidence. */
export type TrackConflictState =
  | { readonly presence: 'absent'; readonly id: StableId }
  | { readonly presence: 'present'; readonly track: Track }
  | { readonly presence: 'deleted'; readonly track: Track }

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
      readonly conflict: RevisionConflict<TrackConflictState>
    }

export interface TrackWithFirstMemberRequest {
  readonly newTrackId: StableId
  readonly newMemberId: StableId
  readonly track: TrackDraft
  readonly member: StructuredDraft
  readonly memberCreationSectionIds?: readonly EntrySectionId[]
  /**
   * True only when the capture UI never supplied tag state. The core may then
   * apply the Track suggestion. An explicit empty collection remains empty.
   */
  readonly tagStateOmitted?: boolean
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
  readonly memberCreationSectionIds?: readonly EntrySectionId[]
  readonly tagStateOmitted?: boolean
  readonly nowMs: Instant
}

/** Attaching moves a member; detaching passes no Track. */
export interface TrackMembershipRequest {
  readonly memberId: StableId
  readonly memberKind: StructuredKind
  readonly expectedMemberRevision: Revision
  readonly expectedInvalidation: InvalidationToken
  readonly trackId: StableId
  readonly nowMs: Instant
}

export interface TrackDetachRequest {
  readonly memberId: StableId
  readonly memberKind: StructuredKind
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
  readonly weekRules: WeekRules
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

export type MediaImportResult = {
  readonly outcome: 'imported'
  readonly item: MediaItem
  readonly invalidation: InvalidationToken
}

export interface MediaDeleteRequest {
  readonly mediaId: StableId
  readonly parentEntryId: StableId
  readonly expectedParentRevision: Revision
}

export type MediaDeleteResult = {
  readonly outcome: 'deleted'
  readonly deletedMediaId: StableId
  readonly invalidation: InvalidationToken
}
