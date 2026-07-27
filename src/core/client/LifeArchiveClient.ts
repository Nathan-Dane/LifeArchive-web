/**
 * `LifeArchiveClient` — the only door feature code has to durable state.
 *
 * Every method is one coarse, named, product-level operation. There is no
 * generic `execute`, no store handle, no SQL, no path, no schema version to
 * migrate, and no fine-grained CRUD. Feature code holds this interface and
 * nothing below it: the worker transport, the runtime loader, the generated
 * declarations, and the wire envelopes are all private to the implementations.
 *
 * The interface is implemented twice — once over the real worker-hosted runtime
 * and once as an explicit development mock — so features cannot tell them apart
 * and cannot grow a mock-only path.
 *
 * What this interface deliberately does not do:
 *
 * - it decides nothing the core decides (validation, civil dates, window
 *   traversal, ordering, aggregation, empty-entry cleanup, conflict resolution,
 *   migration, archive encoding, media placement);
 * - it never throws to report a product outcome — failures and expected states
 *   are values;
 * - it never produces user-facing text; failures carry stable codes only;
 * - it exposes no AI, Search, sync, or account surface in v0.1.
 */

import type { ClientResult } from './errors'
import type {
  ArchiveChange,
  ArchiveCloseResult,
  ArchiveEraseRequest,
  ArchiveEraseResult,
  ArchiveExportRequest,
  ArchiveExportResult,
  ArchiveIdentity,
  ArchiveIdentitySaveResult,
  ArchiveIdentityState,
  ArchiveImportRequest,
  ArchiveImportResult,
  ArchiveOverview,
  ArchiveSession,
  ArchiveVerification,
  ArchiveVerifyRequest,
  CalendarContext,
  CalendarContextRequest,
  CancellationRequestResult,
  MediaContent,
  MediaContentRequest,
  MediaDeleteRequest,
  MediaDeleteResult,
  MediaImportRequest,
  MediaImportResult,
  MediaListRequest,
  MediaListing,
  OpenArchive,
  OperationId,
  OrdinaryDeleteRequest,
  OrdinaryDeleteResult,
  OrdinaryEntryState,
  OrdinarySaveRequest,
  OrdinarySaveResult,
  RuntimeStatus,
  StableId,
  StorageFacts,
  StructuredConvertRequest,
  StructuredCreateRequest,
  StructuredDeleteRequest,
  StructuredDeleteResult,
  StructuredListPage,
  StructuredListRequest,
  StructuredLoadRequest,
  StructuredMutationResult,
  StructuredObjectState,
  StructuredSaveRequest,
  TimeWindow,
  TimeWindowRequest,
  TimelineFocusRequest,
  TimelineFocusResult,
  TimelineIndexRequest,
  TimelinePage,
  TimelineStructuredDetailRequest,
  TimelineStructuredDetailResult,
  TimelineStructuredListRequest,
  TimelineStructuredListResult,
  TrackCreateRequest,
  TrackDeleteRequest,
  TrackDetachRequest,
  TrackHistoryPage,
  TrackHistoryRequest,
  TrackListPage,
  TrackListRequest,
  TrackMemberCreateRequest,
  TrackMembershipRequest,
  TrackMutationResult,
  TrackSaveRequest,
  TrackState,
  TrackWithFirstMember,
  TrackWithFirstMemberRequest,
  Unsubscribe,
  WindowStepRequest,
} from './types'

/** Runtime availability and the storage facts the UI is allowed to state. */
export interface RuntimeSurface {
  /** The current availability snapshot. Synchronous and always answerable. */
  status(): RuntimeStatus
  observeStatus(listener: (status: RuntimeStatus) => void): Unsubscribe
  /**
   * Real storage facts. Every durability, location, or quota statement in the
   * UI comes from here — never from a constant.
   */
  storage(): Promise<ClientResult<StorageFacts>>
}

/** Archive lifecycle, inspection, portability, and deliberate destruction. */
export interface ArchiveSurface {
  session(): ArchiveSession
  observeSession(listener: (session: ArchiveSession) => void): Unsubscribe
  /** Creates a new empty local archive. Never implied by opening. */
  create(): Promise<ClientResult<OpenArchive>>
  /**
   * Opens the existing local archive. It never creates one, never substitutes
   * an empty replacement, and reports exclusive-ownership denial as a state.
   */
  open(): Promise<ClientResult<OpenArchive>>
  close(): Promise<ClientResult<ArchiveCloseResult>>
  overview(): Promise<ClientResult<ArchiveOverview>>
  /** A read-only integrity check of a selected package. Implies no backup. */
  verify(
    request: ArchiveVerifyRequest,
  ): Promise<ClientResult<ArchiveVerification>>
  /** Validated, atomic, merge-only import. Duplicate stable IDs are skipped. */
  import(
    request: ArchiveImportRequest,
  ): Promise<ClientResult<ArchiveImportResult>>
  export(
    request: ArchiveExportRequest,
  ): Promise<ClientResult<ArchiveExportResult>>
  /** Leaves a usable empty archive and touches no previously written export. */
  erase(request: ArchiveEraseRequest): Promise<ClientResult<ArchiveEraseResult>>
}

export interface IdentitySurface {
  load(): Promise<ClientResult<ArchiveIdentityState>>
  /** Saves the complete identity, preserving both stable IDs. */
  save(
    identity: ArchiveIdentity,
  ): Promise<ClientResult<ArchiveIdentitySaveResult>>
}

/** Core-owned time navigation. The browser performs no calendar arithmetic. */
export interface TimeSurface {
  window(request: TimeWindowRequest): Promise<ClientResult<TimeWindow>>
  step(request: WindowStepRequest): Promise<ClientResult<TimeWindow>>
  calendarContext(
    request: CalendarContextRequest,
  ): Promise<ClientResult<CalendarContext>>
}

/** Ordinary entries, plus the structured objects placed in a window. */
export interface RecordSurface {
  /** Loads the one exact active entry for a window, or reports absence. */
  load(window: TimeWindow): Promise<ClientResult<OrdinaryEntryState>>
  /** A revision-carrying save. A conflict returns current state, not a merge. */
  save(request: OrdinarySaveRequest): Promise<ClientResult<OrdinarySaveResult>>
  delete(
    request: OrdinaryDeleteRequest,
  ): Promise<ClientResult<OrdinaryDeleteResult>>
  listObjects(
    request: StructuredListRequest,
  ): Promise<ClientResult<StructuredListPage>>
}

/** Events and Spans, addressed only by stable ID. */
export interface StructuredSurface {
  load(
    request: StructuredLoadRequest,
  ): Promise<ClientResult<StructuredObjectState>>
  create(
    request: StructuredCreateRequest,
  ): Promise<ClientResult<StructuredMutationResult>>
  save(
    request: StructuredSaveRequest,
  ): Promise<ClientResult<StructuredMutationResult>>
  delete(
    request: StructuredDeleteRequest,
  ): Promise<ClientResult<StructuredDeleteResult>>
  /** In-place conversion decided by the core, not rebuilt as a new object. */
  convertSpanToEvent(
    request: StructuredConvertRequest,
  ): Promise<ClientResult<StructuredMutationResult>>
}

export interface TrackSurface {
  list(request: TrackListRequest): Promise<ClientResult<TrackListPage>>
  load(id: StableId): Promise<ClientResult<TrackState>>
  create(
    request: TrackCreateRequest,
  ): Promise<ClientResult<TrackMutationResult>>
  save(request: TrackSaveRequest): Promise<ClientResult<TrackMutationResult>>
  delete(
    request: TrackDeleteRequest,
  ): Promise<ClientResult<TrackMutationResult>>
  createWithFirstMember(
    request: TrackWithFirstMemberRequest,
  ): Promise<ClientResult<TrackWithFirstMember>>
  history(request: TrackHistoryRequest): Promise<ClientResult<TrackHistoryPage>>
  attachMember(
    request: TrackMembershipRequest,
  ): Promise<ClientResult<StructuredMutationResult>>
  detachMember(
    request: TrackDetachRequest,
  ): Promise<ClientResult<StructuredMutationResult>>
  createMember(
    request: TrackMemberCreateRequest,
  ): Promise<ClientResult<StructuredMutationResult>>
}

/**
 * Bounded read-only browsing. One request covers the whole visible window;
 * detail is guarded by the snapshot it came from.
 */
export interface TimelineSurface {
  index(request: TimelineIndexRequest): Promise<ClientResult<TimelinePage>>
  focus(
    request: TimelineFocusRequest,
  ): Promise<ClientResult<TimelineFocusResult>>
  structuredDetail(
    request: TimelineStructuredDetailRequest,
  ): Promise<ClientResult<TimelineStructuredDetailResult>>
  structuredList(
    request: TimelineStructuredListRequest,
  ): Promise<ClientResult<TimelineStructuredListResult>>
}

/** Durable media. Bytes become durable only once the core owns them. */
export interface MediaSurface {
  list(request: MediaListRequest): Promise<ClientResult<MediaListing>>
  content(request: MediaContentRequest): Promise<ClientResult<MediaContent>>
  import(request: MediaImportRequest): Promise<ClientResult<MediaImportResult>>
  delete(request: MediaDeleteRequest): Promise<ClientResult<MediaDeleteResult>>
}

/** Identifier minting, cancellation, and change observation. */
export interface OperationSurface {
  /** A new stable ID for an object the caller is about to create. */
  newStableId(): StableId
  /** A new identifier for one cancellable export or import. */
  newOperationId(): OperationId
  /**
   * Asks the core to cancel one active export or import. The awaiting call
   * still settles with the core's definitive outcome, so disposing a view can
   * never make a durable result unknowable.
   */
  requestCancel(
    id: OperationId,
  ): Promise<ClientResult<CancellationRequestResult>>
  /**
   * Observes archive changes as an invalidation hint. It is not an event log,
   * and a notice for another archive or an earlier runtime is discarded before
   * it reaches the listener.
   */
  observeChanges(listener: (change: ArchiveChange) => void): Unsubscribe
}

export interface LifeArchiveClient {
  readonly runtime: RuntimeSurface
  readonly archive: ArchiveSurface
  readonly identity: IdentitySurface
  readonly time: TimeSurface
  readonly record: RecordSurface
  readonly structured: StructuredSurface
  readonly tracks: TrackSurface
  readonly timeline: TimelineSurface
  readonly media: MediaSurface
  readonly operations: OperationSurface
}
