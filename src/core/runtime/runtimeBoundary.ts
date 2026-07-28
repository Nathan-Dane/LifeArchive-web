import packageMetadata from '../../../package.json'
import {
  civilDate,
  coreTimeWindow,
  coreTrackHistoryCursor,
  isCivilDate,
  isRevision,
  isStableId,
  revision,
  stableId,
  type ArchiveCloseResult,
  type ArchiveEraseRequest,
  type ArchiveEraseResult,
  type ArchiveExportRequest,
  type ArchiveExportResult,
  type ArchiveIdentity,
  type ArchiveIdentitySaveResult,
  type ArchiveIdentityState,
  type ArchiveImportIssue,
  type ArchiveImportRequest,
  type ArchiveImportResult,
  type ArchiveOverview,
  type ArchiveVerification,
  type ArchiveVerifyRequest,
  type BoundaryMarker,
  type CalendarContext,
  type CalendarContextRequest,
  type CalendarDay,
  type InvalidationToken,
  type MediaContent,
  type MediaContentRequest,
  type MediaDeleteRequest,
  type MediaDeleteResult,
  type MediaImportRequest,
  type MediaImportResult,
  type MediaItem,
  type MediaKind,
  type MediaListRequest,
  type MediaListing,
  type OpenArchive,
  type OrdinaryDeleteRequest,
  type OrdinaryDeleteResult,
  type OrdinaryConflictState,
  type OrdinaryEntry,
  type OrdinaryEntryState,
  type OrdinarySaveRequest,
  type OrdinarySaveResult,
  type PrivacyLevel,
  type StableId,
  type StructuredConvertRequest,
  type StructuredConflictState,
  type StructuredCreateRequest,
  type StructuredDeleteRequest,
  type StructuredDeleteResult,
  type StructuredDraft,
  type StructuredListPage,
  type StructuredListRequest,
  type StructuredLoadRequest,
  type StructuredMutationResult,
  type StructuredObject,
  type StructuredObjectState,
  type StructuredPlacement,
  type StructuredSaveRequest,
  type StructuredSummary,
  type TimeWindow,
  type TimeWindowRequest,
  type TimelineFocusRequest,
  type TimelineFocusResult,
  type TimelineIndexRequest,
  type TimelinePage,
  type TimelineRow,
  type TimelineStructuredDetailRequest,
  type TimelineStructuredDetailResult,
  type TimelineStructuredListRequest,
  type TimelineStructuredListResult,
  type Track,
  type TrackConflictState,
  type TrackCreateRequest,
  type TrackDeleteRequest,
  type TrackDetachRequest,
  type TrackHistoryPage,
  type TrackHistoryRequest,
  type TrackListPage,
  type TrackListRequest,
  type TrackMember,
  type TrackMemberCreateRequest,
  type TrackMembershipRequest,
  type TrackMutationResult,
  type TrackSaveRequest,
  type TrackState,
  type TrackSummary,
  type TrackWithFirstMember,
  type TrackWithFirstMemberRequest,
  type WindowStepRequest,
} from '../client'

export interface PreparedRuntimeRequest {
  readonly request: unknown
  readonly transfers: ArrayBuffer[]
  readonly archive?: File
}

export interface RuntimeBoundary<Request, Result> {
  readonly operation: string
  prepare(request: Request): PreparedRuntimeRequest
  map(
    result: unknown,
    transfers: readonly ArrayBuffer[],
    request: Request,
  ): Result
  mapFailure?(failure: RuntimeFailure, request: Request): Result | null
}

export interface RuntimeFailure {
  readonly category?: unknown
  readonly code?: unknown
  readonly details?: unknown
  readonly currentState?: unknown
}

function boundary<Request, Result>(
  operation: string,
  prepare: (request: Request) => PreparedRuntimeRequest,
  map: (
    result: unknown,
    transfers: readonly ArrayBuffer[],
    request: Request,
  ) => Result,
  mapFailure?: (failure: RuntimeFailure, request: Request) => Result | null,
): RuntimeBoundary<Request, Result> {
  return { operation, prepare, map, ...(mapFailure ? { mapFailure } : {}) }
}

const noTransfers = (request: unknown): PreparedRuntimeRequest => ({
  request,
  transfers: [],
})

export interface ArchiveImportBoundaryRequest {
  readonly input: ArchiveImportRequest
  readonly previousInvalidation: InvalidationToken
}

export const runtimeBoundary = {
  storeOpen: boundary<object, OpenArchive>('store.open', noTransfers, (value) =>
    mapOpenArchive(record(value, 'store open result')),
  ),
  storeClose: boundary<null, ArchiveCloseResult>(
    'store.close',
    noTransfers,
    (value) => {
      const result = record(value, 'store close result')
      return {
        outcome: literal(
          result.outcome,
          ['closed', 'already-closed'] as const,
          'store close outcome',
        ),
      }
    },
  ),
  archiveOverview: boundary<object, ArchiveOverview>(
    'archive.overview',
    noTransfers,
    (value) => mapArchiveOverview(record(value, 'archive overview result')),
  ),
  archiveVerify: boundary<ArchiveVerifyRequest, ArchiveVerification>(
    'archive.verify',
    ({ archive }) => ({ request: {}, transfers: [], archive }),
    (value) => mapArchiveVerification(record(value, 'archive verification')),
  ),
  archiveImport: boundary<ArchiveImportBoundaryRequest, ArchiveImportResult>(
    'archive.apply',
    ({ input }) => ({
      request: { operationId: input.operationId },
      transfers: [],
      archive: input.archive,
    }),
    (value, _transfers, request) =>
      mapArchiveImport(
        record(value, 'archive import result'),
        request.previousInvalidation,
      ),
  ),
  archiveExport: boundary<ArchiveExportRequest, ArchiveExportResult>(
    'archive.export',
    (request) => ({
      request: mapArchiveExportRequest(request),
      transfers: [],
    }),
    (value, transfers, request) => {
      if (transfers.length !== 1) {
        throw new TypeError('Malformed archive export transfer count')
      }
      return mapArchiveExport(
        record(value, 'archive export result'),
        transfers[0],
        request,
      )
    },
  ),
  archiveErase: boundary<ArchiveEraseRequest, ArchiveEraseResult>(
    'archive.erase',
    (request) => {
      literal(
        request.confirmation,
        ['erase-this-archive'] as const,
        'archive erase confirmation',
      )
      return noTransfers({})
    },
    (value) => {
      const result = record(value, 'archive erase result')
      return {
        outcome: literal(
          result.outcome,
          ['erased'] as const,
          'archive erase outcome',
        ),
        invalidation: mapInvalidation(result.token),
      }
    },
  ),
  identityLoad: boundary<null, ArchiveIdentityState>(
    'archive.identity.load',
    () => noTransfers({}),
    (value) => {
      const result = record(value, 'archive identity load result')
      literal(
        result.outcome,
        ['loaded'] as const,
        'archive identity load outcome',
      )
      return {
        identity: mapArchiveIdentity(result.identity),
        invalidation: mapInvalidation(result.token),
      }
    },
  ),
  identitySave: boundary<ArchiveIdentity, ArchiveIdentitySaveResult>(
    'archive.identity.save',
    (identity) =>
      noTransfers({ identity: mapArchiveIdentityRequest(identity) }),
    (value) => {
      const result = record(value, 'archive identity save result')
      return {
        outcome: literal(
          result.outcome,
          ['updated', 'unchanged'] as const,
          'archive identity save outcome',
        ),
        identity: mapArchiveIdentity(result.identity),
        invalidation: mapInvalidation(result.token),
      }
    },
  ),
  timeWindow: boundary<TimeWindowRequest, TimeWindow>(
    'time.window',
    ({ scale, containing, timeZoneId, weekRules }) =>
      noTransfers({
        contractVersion: 1,
        scale,
        anchorDate: containing,
        calendarIdentifier: 'gregorian',
        timeZoneIdentifier: timeZoneId,
        firstWeekday: weekRules.firstWeekday,
        minimumDaysInFirstWeek: weekRules.minimumDaysInFirstWeek,
      }),
    (value) => mapTimeWindow(record(value, 'time window result')),
  ),
  timeStep: boundary<WindowStepRequest, TimeWindow>(
    'time.step',
    ({ window, step, weekRules }) =>
      noTransfers({
        contractVersion: 1,
        scale: window.scale,
        anchorDate: window.startDate,
        step,
        calendarIdentifier: window.calendarId,
        timeZoneIdentifier: window.timeZoneId,
        firstWeekday: weekRules.firstWeekday,
        minimumDaysInFirstWeek: weekRules.minimumDaysInFirstWeek,
      }),
    (value) => mapTimeWindow(record(value, 'time step result')),
  ),
  timeCalendarContext: boundary<CalendarContextRequest, CalendarContext>(
    'time.calendarContext',
    ({ focusedDate, timeZoneId, weekRules }) =>
      noTransfers({
        contractVersion: 1,
        focusedDate,
        calendarIdentifier: 'gregorian',
        timeZoneIdentifier: timeZoneId,
        firstWeekday: weekRules.firstWeekday,
        minimumDaysInFirstWeek: weekRules.minimumDaysInFirstWeek,
      }),
    (value) => {
      const result = record(value, 'time calendar context result')
      return {
        focused: mapTimeWindow(record(result.focused, 'focused time window')),
        focusedDate: requiredCivilDate(
          result.focusedDate,
          'focused civil date',
        ),
        week: array(result.week, 'calendar week').map(mapCalendarDay),
        month: array(result.month, 'calendar month').map(mapCalendarDay),
      }
    },
  ),
  recordLoad: boundary<TimeWindow, OrdinaryEntryState>(
    'record.loadSpan',
    (window) =>
      noTransfers({ contractVersion: 1, span: mapRecordSpan(window) }),
    (value, _transfers, window) =>
      mapRecordLoad(record(value, 'record load result'), window),
  ),
  recordSave: boundary<OrdinarySaveRequest, OrdinarySaveResult>(
    'record.saveDraft',
    (request) => noTransfers(mapRecordSaveRequest(request)),
    (value, _transfers, request) =>
      mapRecordSave(record(value, 'record save result'), request.window),
    (failure, request) =>
      mapOrdinaryConflict(failure, request.window, 'record save'),
  ),
  recordDelete: boundary<OrdinaryDeleteRequest, OrdinaryDeleteResult>(
    'record.deleteEntry',
    ({ entryId, expectedRevision, nowMs }) =>
      noTransfers({
        contractVersion: 1,
        entryId,
        expectedRevision,
        nowMs,
      }),
    (value) => mapRecordDelete(record(value, 'record delete result')),
    (failure, request) =>
      mapOrdinaryConflict(failure, request.window, 'record delete'),
  ),
  recordListObjects: boundary<StructuredListRequest, StructuredListPage>(
    'record.listObjects',
    ({ window, limit }) =>
      noTransfers({
        span: mapRecordSpan(window),
        limit: count(limit, 'limit'),
      }),
    (value) => {
      const result = record(value, 'record object list result')
      literal(result.outcome, ['listed'] as const, 'record list outcome')
      return {
        objects: array(result.summaries, 'record object summaries').map(
          mapStructuredSummary,
        ),
        invalidation: mapInvalidation(result.token),
      }
    },
  ),
  structuredLoad: boundary<StructuredLoadRequest, StructuredObjectState>(
    'structured.load',
    ({ id, includeDeleted }) => noTransfers({ id, includeDeleted }),
    (value) => mapStructuredLoad(record(value, 'structured load result')),
  ),
  structuredCreate: boundary<StructuredCreateRequest, StructuredMutationResult>(
    'structured.create',
    ({ newObjectId, draft, nowMs }) =>
      noTransfers({
        id: newObjectId,
        expectation: 'absent',
        draft: mapStructuredDraft(draft),
        nowMs,
      }),
    (value) => mapStructuredMutation(record(value, 'structured create result')),
  ),
  structuredSave: boundary<StructuredSaveRequest, StructuredMutationResult>(
    'structured.save',
    ({ id, expectedRevision, draft, nowMs }) =>
      noTransfers({
        id,
        expectedRevision,
        draft: mapStructuredDraft(draft),
        nowMs,
      }),
    (value) => mapStructuredMutation(record(value, 'structured save result')),
    (failure) => mapStructuredConflict(failure, 'structured save'),
  ),
  structuredDelete: boundary<StructuredDeleteRequest, StructuredDeleteResult>(
    'structured.delete',
    ({ id, expectedRevision, nowMs }) =>
      noTransfers({
        contractVersion: 2,
        id,
        expectedRevision,
        nowMs,
      }),
    (value) => mapStructuredDelete(record(value, 'structured delete result')),
    (failure) => mapStructuredConflict(failure, 'structured delete'),
  ),
  structuredConvert: boundary<
    StructuredConvertRequest,
    StructuredMutationResult
  >(
    'structured.convertSpanToEvent',
    ({
      spanId,
      expectedRevision,
      requestedStartDate,
      requestedEndDate,
      nowMs,
    }) =>
      noTransfers({
        contractVersion: 2,
        id: spanId,
        expectedRevision,
        requestedStartDate,
        requestedEndDate,
        nowMs,
      }),
    (value) =>
      mapStructuredMutation(record(value, 'structured conversion result')),
    (failure) => mapStructuredConflict(failure, 'structured conversion'),
  ),
  trackList: boundary<TrackListRequest, TrackListPage>(
    'track.list',
    ({ includeArchived, limit }) =>
      noTransfers({ archived: includeArchived, limit: count(limit, 'limit') }),
    (value) => {
      const result = record(value, 'track list result')
      return {
        tracks: array(result.tracks, 'track summaries').map(mapTrackSummary),
        invalidation: mapInvalidation(result.token),
      }
    },
  ),
  trackLoad: boundary<StableId, TrackState>(
    'track.load',
    (id) => noTransfers({ id, includeDeleted: true }),
    (value) => mapTrackLoad(record(value, 'track load result')),
  ),
  trackCreate: boundary<TrackCreateRequest, TrackMutationResult>(
    'track.create',
    ({ newTrackId, draft, nowMs }) =>
      noTransfers({
        id: newTrackId,
        expectation: 'absent',
        draft: mapTrackDraft(draft),
        nowMs,
      }),
    (value) => mapTrackMutation(record(value, 'track create result')),
  ),
  trackSave: boundary<TrackSaveRequest, TrackMutationResult>(
    'track.save',
    ({ id, expectedRevision, draft, nowMs }) =>
      noTransfers({
        id,
        expectedRevision,
        draft: mapTrackDraft(draft),
        nowMs,
      }),
    (value) => mapTrackMutation(record(value, 'track save result')),
    (failure) => mapTrackConflict(failure, 'track save'),
  ),
  trackDelete: boundary<TrackDeleteRequest, TrackMutationResult>(
    'track.delete',
    ({ id, expectedRevision, detachMembers, nowMs }) =>
      noTransfers({
        id,
        expectedRevision,
        detachMembers,
        nowMs,
      }),
    (value) => mapTrackMutation(record(value, 'track delete result')),
    (failure) => mapTrackConflict(failure, 'track delete'),
  ),
  trackCreateWithFirstMember: boundary<
    TrackWithFirstMemberRequest,
    TrackWithFirstMember
  >(
    'track.createWithFirstMember',
    ({ newTrackId, newMemberId, track, member, tagStateOmitted, nowMs }) =>
      noTransfers({
        trackId: newTrackId,
        memberId: newMemberId,
        track: mapTrackDraft(track),
        member: mapStructuredDraft(member),
        tagStateOmitted: tagStateOmitted ?? false,
        nowMs,
      }),
    (value) => {
      const result = record(value, 'track and first member result')
      return {
        track: mapTrackSnapshot(result.track),
        member: mapStructuredSnapshot(result.member),
        invalidation: mapInvalidation(result.token),
      }
    },
  ),
  trackHistory: boundary<TrackHistoryRequest, TrackHistoryPage>(
    'track.history',
    ({ trackId, expectedTrackRevision, expectedInvalidation, limit, cursor }) =>
      noTransfers({
        trackId,
        expectedTrackRevision,
        expectedToken: mapInvalidationRequest(expectedInvalidation),
        limit: count(limit, 'limit'),
        cursor,
      }),
    (value) => mapTrackHistory(record(value, 'track history result')),
  ),
  trackAttachMember: boundary<TrackMembershipRequest, StructuredMutationResult>(
    'track.attachMember',
    ({
      memberId,
      memberKind,
      trackId,
      expectedMemberRevision,
      expectedInvalidation,
      nowMs,
    }) =>
      noTransfers({
        memberId,
        memberKind,
        trackId,
        expectedMemberRevision,
        expectedToken: mapInvalidationRequest(expectedInvalidation),
        nowMs,
      }),
    (value) =>
      mapStructuredMutation(record(value, 'track attach member result')),
    (failure) => mapStructuredConflict(failure, 'track attach member'),
  ),
  trackDetachMember: boundary<TrackDetachRequest, StructuredMutationResult>(
    'track.detachMember',
    ({
      memberId,
      memberKind,
      expectedMemberRevision,
      expectedInvalidation,
      nowMs,
    }) =>
      noTransfers({
        memberId,
        memberKind,
        expectedMemberRevision,
        expectedToken: mapInvalidationRequest(expectedInvalidation),
        nowMs,
      }),
    (value) =>
      mapStructuredMutation(record(value, 'track detach member result')),
    (failure) => mapStructuredConflict(failure, 'track detach member'),
  ),
  trackCreateMember: boundary<
    TrackMemberCreateRequest,
    StructuredMutationResult
  >(
    'track.createMember',
    ({
      trackId,
      expectedTrackRevision,
      expectedInvalidation,
      newMemberId,
      member,
      tagStateOmitted,
      nowMs,
    }) =>
      noTransfers({
        trackId,
        expectedTrackRevision,
        expectedToken: mapInvalidationRequest(expectedInvalidation),
        memberId: newMemberId,
        member: mapStructuredDraft(member),
        tagStateOmitted: tagStateOmitted ?? false,
        nowMs,
      }),
    (value) =>
      mapStructuredMutation(record(value, 'track create member result')),
    (failure) => mapStructuredConflict(failure, 'track create member'),
  ),
  timelineIndex: boundary<TimelineIndexRequest, TimelinePage>(
    'timeline.index',
    (request) => noTransfers(mapTimelineIndexRequest(request)),
    (value, _transfers, request) =>
      mapTimelineIndex(record(value, 'timeline index result'), request.windows),
  ),
  timelineFocus: boundary<TimelineFocusRequest, TimelineFocusResult>(
    'timeline.focusedDetail',
    ({ window, weekRules, entry, expectedInvalidation }) =>
      noTransfers({
        contractVersion: 1,
        span: mapTimelineSpan(window),
        firstWeekday: weekRules.firstWeekday,
        minimumDaysInFirstWeek: weekRules.minimumDaysInFirstWeek,
        expectedEntry: entry
          ? { id: entry.id, mutationRevision: entry.revision }
          : null,
        expectedToken: mapInvalidationRequest(expectedInvalidation),
      }),
    (value, _transfers, request) =>
      mapTimelineFocus(record(value, 'timeline focus result'), request.window),
    mapTimelineStale,
  ),
  timelineStructuredDetail: boundary<
    TimelineStructuredDetailRequest,
    TimelineStructuredDetailResult
  >(
    'timeline.structuredDetail',
    ({ id, expectedRevision, expectedInvalidation }) =>
      noTransfers({
        id,
        expectedRevision,
        token: mapInvalidationRequest(expectedInvalidation),
      }),
    (value) => {
      const result = record(value, 'timeline structured detail result')
      literal(
        result.outcome,
        ['detail'] as const,
        'timeline structured detail outcome',
      )
      return {
        outcome: 'detail',
        object: mapStructuredSnapshot(result.detail),
        invalidation: mapInvalidation(result.token),
      }
    },
    mapTimelineStale,
  ),
  timelineStructuredList: boundary<
    TimelineStructuredListRequest,
    TimelineStructuredListResult
  >(
    'timeline.structuredList',
    ({ ids, limit, expectedInvalidation }) =>
      noTransfers({
        ids: ids.map((id) => requiredStableId(id, 'structured list ID')),
        limit: count(limit, 'limit'),
        token: mapInvalidationRequest(expectedInvalidation),
      }),
    (value) => {
      const result = record(value, 'timeline structured list result')
      literal(
        result.outcome,
        ['listed'] as const,
        'timeline structured list outcome',
      )
      return {
        outcome: 'listed',
        objects: array(result.summaries, 'structured list summaries').map(
          mapStructuredSummary,
        ),
        invalidation: mapInvalidation(result.token),
      }
    },
    mapTimelineStale,
  ),
  mediaList: boundary<MediaListRequest, MediaListing>(
    'media.listForEntry',
    ({ parentEntryId }) => noTransfers({ entryId: parentEntryId }),
    (value) => mapMediaListing(record(value, 'media list result')),
  ),
  mediaContent: boundary<MediaContentRequest, MediaContent>(
    'media.resolveContent',
    ({ mediaId }) => noTransfers({ attachmentId: mediaId }),
    (value, transfers) => {
      if (transfers.length !== 1) {
        throw new TypeError('Malformed media content transfer count')
      }
      const result = record(value, 'media content result')
      literal(result.outcome, ['resolved'] as const, 'media content outcome')
      const byteSize = count(result.byteSize, 'media content byte size')
      if (transfers[0].byteLength !== byteSize) {
        throw new TypeError('Malformed media content byte size')
      }
      return {
        mediaId: requiredStableId(
          result.attachmentId,
          'resolved media identifier',
        ),
        bytes: new Uint8Array(transfers[0]),
        byteSize,
        sha256: nullableString(result.sha256, 'media content checksum'),
      }
    },
  ),
  mediaImport: boundary<MediaImportRequest, MediaImportResult>(
    'media.import',
    (request) => ({
      request: {
        attachmentId: request.newMediaId,
        entryId: request.parentEntryId,
        expectedRevision: request.expectedParentRevision,
        fileName: request.fileName,
        mediaType: request.kindHint,
        mimeType: request.mimeTypeHint,
        declaredSha256: null,
        createdAtMs: request.createdAtMs,
        capturedAtMs: null,
        durationMs: null,
        width: null,
        height: null,
        cloudAssetId: null,
        transcription: null,
        caption: null,
        aiCaption: null,
        sourceTransferId: 'media-source',
      },
      transfers: [request.bytes],
    }),
    (value) => {
      const result = record(value, 'media import result')
      literal(result.outcome, ['imported'] as const, 'media import outcome')
      return {
        outcome: 'imported',
        item: mapMediaItem(result.attachment),
        invalidation: mapInvalidation(result.token),
      }
    },
  ),
  mediaDelete: boundary<MediaDeleteRequest, MediaDeleteResult>(
    'media.delete',
    ({ mediaId, parentEntryId, expectedParentRevision }) =>
      noTransfers({
        attachmentId: mediaId,
        entryId: parentEntryId,
        expectedRevision: expectedParentRevision,
      }),
    (value) => {
      const result = record(value, 'media delete result')
      literal(result.outcome, ['deleted'] as const, 'media delete outcome')
      return {
        outcome: 'deleted',
        deletedMediaId: requiredStableId(
          result.attachmentId,
          'deleted media identifier',
        ),
        invalidation: mapInvalidation(result.token),
      }
    },
  ),
} as const

function mapOpenArchive(result: Record<string, unknown>): OpenArchive {
  literal(result.outcome, ['opened'] as const, 'store open outcome')
  if (result.ready !== true) {
    throw new TypeError('Malformed store readiness')
  }
  return {
    storeId: requiredStableId(result.storeId, 'store identifier'),
    productContract: string(
      result.productContractVersion,
      'product contract version',
    ),
    storeSchemaVersion: string(result.schemaVersion, 'store schema version'),
    rootLayoutVersion: string(result.rootLayoutVersion, 'root layout version'),
    invalidation: mapInvalidation(result.token),
  }
}

function mapTimeWindow(result: Record<string, unknown>): TimeWindow {
  return coreTimeWindow({
    id: string(result.id, 'time window identifier'),
    scale: literal(
      result.scale,
      ['day', 'week', 'month', 'year'] as const,
      'time window scale',
    ),
    startMs: integer(result.startMs, 'time window start'),
    endMs: integer(result.endMs, 'time window end'),
    startDate: requiredCivilDate(result.startDate, 'time window start date'),
    endDate: requiredCivilDate(result.endDate, 'time window end date'),
    calendarId: string(result.calendarId, 'time window calendar'),
    timeZoneId: string(result.timeZoneId, 'time window time zone'),
  })
}

function mapCalendarDay(value: unknown): CalendarDay {
  const day = record(value, 'calendar day')
  return {
    date: requiredCivilDate(day.date, 'calendar day date'),
    window: mapTimeWindow(record(day.window, 'calendar day window')),
    withinFocusedMonth: boolean(
      day.withinFocusedMonth,
      'calendar day month membership',
    ),
  }
}

function mapRecordSpan(window: TimeWindow): Record<string, unknown> {
  return {
    entryType: window.scale,
    startMs: integer(window.startMs, 'time window start'),
    endMs: integer(window.endMs, 'time window end'),
    calendarIdentifier: string(window.calendarId, 'calendar identifier'),
    timeZoneIdentifier: string(window.timeZoneId, 'time zone identifier'),
  }
}

function mapTimelineSpan(window: TimeWindow): Record<string, unknown> {
  return {
    id: string(window.id, 'time window identifier'),
    scale: window.scale,
    startMs: integer(window.startMs, 'time window start'),
    endMs: integer(window.endMs, 'time window end'),
    calendarIdentifier: string(window.calendarId, 'calendar identifier'),
    timeZoneIdentifier: string(window.timeZoneId, 'time zone identifier'),
  }
}

function mapRecordSaveRequest(
  request: OrdinarySaveRequest,
): Record<string, unknown> {
  const base = {
    contractVersion: 1,
    span: mapRecordSpan(request.window),
    draft: string(request.markdown, 'record draft'),
    nowMs: integer(request.nowMs, 'record save time'),
  }
  return request.target.expectation === 'absent'
    ? { ...base, newEntryId: request.target.newEntryId }
    : {
        ...base,
        entryId: request.target.entryId,
        expectedRevision: request.target.expectedRevision,
      }
}

function mapRecordLoad(
  result: Record<string, unknown>,
  window: TimeWindow,
): OrdinaryEntryState {
  const token = mapInvalidation(result.token)
  if (result.outcome === 'absent') {
    return {
      presence: 'absent',
      window,
      invalidation: token,
    }
  }
  literal(result.outcome, ['loaded'] as const, 'record load outcome')
  const current = record(result.current, 'loaded record current state')
  const entry = mapOrdinaryVersionedEntry(current, window)
  return {
    presence: 'present',
    window,
    entry,
    invalidation: token,
  }
}

function mapRecordSave(
  result: Record<string, unknown>,
  window: TimeWindow,
): OrdinarySaveResult {
  const token = mapInvalidation(result.token)
  switch (result.outcome) {
    case 'created':
    case 'updated':
    case 'unchanged':
      return {
        outcome: result.outcome,
        entry: mapOrdinaryVersionedEntry(
          record(result.current, 'record mutation current state'),
          window,
        ),
        invalidation: token,
      }
    case 'deletedEmpty':
      return {
        outcome: 'removed-as-empty',
        removedEntryId: requiredStableId(
          result.deletedEntryId,
          'removed entry identifier',
        ),
        removedRevision: requiredRevision(
          result.deletedRevision,
          'removed entry revision',
        ),
        invalidation: token,
      }
    case 'unchangedAbsent':
      return { outcome: 'absent-unchanged', invalidation: token }
    default:
      throw new TypeError('Malformed record save outcome')
  }
}

function mapRecordDelete(
  result: Record<string, unknown>,
): OrdinaryDeleteResult {
  literal(result.outcome, ['softDeleted'] as const, 'record delete outcome')
  return {
    outcome: 'deleted',
    deletedEntryId: requiredStableId(
      result.deletedEntryId,
      'deleted entry identifier',
    ),
    deletedRevision: requiredRevision(
      result.deletedRevision,
      'deleted entry revision',
    ),
    invalidation: mapInvalidation(result.token),
  }
}

function mapOrdinaryConflict(
  failure: RuntimeFailure,
  window: TimeWindow,
  description: string,
): Extract<OrdinarySaveResult, { readonly outcome: 'conflict' }> | null {
  const revisions = conflictRevisions(failure, description)
  if (!revisions) {
    return null
  }
  const current = record(
    failure.currentState,
    `${description} conflict current state`,
  )
  const entry = mapOrdinaryVersionedEntry(current, window)
  const runtimeEntry = record(current.entry, `${description} current entry`)
  const state: OrdinaryConflictState =
    runtimeEntry.deletedAtMs === null || runtimeEntry.deletedAtMs === undefined
      ? { presence: 'present', window, entry }
      : {
          presence: 'deleted',
          window,
          entry,
          deletedAtMs: integer(
            runtimeEntry.deletedAtMs,
            `${description} deletion time`,
          ),
        }
  return {
    outcome: 'conflict',
    conflict: { ...revisions, current: state },
  }
}

export function mapOrdinaryVersionedEntry(
  value: unknown,
  window: TimeWindow,
): OrdinaryEntry {
  const current = record(value, 'versioned ordinary entry')
  const entry = record(current.entry, 'ordinary entry')
  assertEntryMatchesWindow(entry, window)
  return {
    id: requiredStableId(entry.id, 'ordinary entry identifier'),
    revision: requiredRevision(
      current.mutationRevision,
      'ordinary entry revision',
    ),
    window,
    markdown: string(entry.bodyMarkdown, 'ordinary entry markdown'),
    plainText: string(entry.plainTextCache, 'ordinary entry plain text'),
    createdAtMs: integer(entry.createdAtMs, 'ordinary entry creation time'),
    updatedAtMs: integer(entry.updatedAtMs, 'ordinary entry update time'),
    isPinned: boolean(entry.isPinned, 'ordinary entry pinned state'),
    privacy: privacy(entry.privacyLevel),
    source: literal(
      entry.source,
      ['manual', 'imported', 'recovered'] as const,
      'ordinary entry source',
    ),
  }
}

function assertEntryMatchesWindow(
  entry: Record<string, unknown>,
  window: TimeWindow,
): void {
  if (
    entry.entryType !== window.scale ||
    entry.startMs !== window.startMs ||
    entry.endMs !== window.endMs ||
    entry.calendarIdentifier !== window.calendarId ||
    entry.timeZoneIdentifier !== window.timeZoneId
  ) {
    throw new TypeError('Runtime entry does not match requested window')
  }
}

function mapStructuredDraft(draft: StructuredDraft): Record<string, unknown> {
  return {
    title: string(draft.title, 'structured title'),
    bodyMarkdown: string(draft.markdown, 'structured markdown'),
    metadata: mapPlacementRequest(
      draft.placement,
      draft.iconId,
      draft.tags.ordered,
      draft.tags.display,
      draft.trackId,
    ),
    privacyLevel: privacy(draft.privacy),
  }
}

function mapPlacementRequest(
  placement: StructuredPlacement,
  iconId: string,
  orderedTags: readonly string[],
  displayTag: string | null,
  trackId: StableId | null,
): Record<string, unknown> {
  const shared = {
    iconId: string(iconId, 'structured icon identifier'),
    tagIds: orderedTags.map((tag) => string(tag, 'structured tag identifier')),
    displayTagId: displayTag,
    trackId,
  }
  return placement.kind === 'event'
    ? { kind: 'event', date: placement.date, ...shared }
    : {
        kind: 'span',
        startDate: placement.startDate,
        endDate: placement.endDate,
        beginMarker: mapMarkerConfiguration(placement.beginMarker),
        endMarker: mapMarkerConfiguration(placement.endMarker),
        ...shared,
      }
}

function mapMarkerConfiguration(value: {
  readonly enabled: boolean
  readonly titleOverride: string | null
}): Record<string, unknown> {
  return {
    enabled: boolean(value.enabled, 'marker enabled state'),
    titleOverride: value.titleOverride,
  }
}

function mapStructuredLoad(
  result: Record<string, unknown>,
): StructuredObjectState {
  literal(result.outcome, ['loaded'] as const, 'structured load outcome')
  const current = record(result.current, 'structured current state')
  const object = mapStructuredSnapshot(current)
  const deletedAt = current.deletedAtMs
  return deletedAt === null || deletedAt === undefined
    ? {
        presence: 'present',
        object,
        invalidation: mapInvalidation(result.token),
      }
    : {
        presence: 'deleted',
        object,
        deletedAtMs: integer(deletedAt, 'structured deletion time'),
        invalidation: mapInvalidation(result.token),
      }
}

function mapStructuredMutation(
  result: Record<string, unknown>,
): StructuredMutationResult {
  const outcome = literal(
    result.outcome,
    ['created', 'updated', 'unchanged', 'converted'] as const,
    'structured mutation outcome',
  )
  return {
    outcome,
    object: mapStructuredSnapshot(result.current),
    invalidation: mapInvalidation(result.token),
  }
}

function mapStructuredDelete(
  result: Record<string, unknown>,
): StructuredDeleteResult {
  literal(result.outcome, ['softDeleted'] as const, 'structured delete outcome')
  return {
    outcome: 'deleted',
    deletedId: requiredStableId(
      result.deletedEntryId,
      'deleted structured identifier',
    ),
    deletedRevision: requiredRevision(
      result.deletedRevision,
      'deleted structured revision',
    ),
    invalidation: mapInvalidation(result.token),
  }
}

function mapStructuredConflict(
  failure: RuntimeFailure,
  description: string,
): Extract<StructuredMutationResult, { readonly outcome: 'conflict' }> | null {
  const revisions = conflictRevisions(failure, description)
  if (!revisions) {
    return null
  }
  const current = record(
    failure.currentState,
    `${description} conflict current state`,
  )
  const object = mapStructuredSnapshot(current)
  const state: StructuredConflictState =
    current.deletedAtMs === null || current.deletedAtMs === undefined
      ? { presence: 'present', object }
      : {
          presence: 'deleted',
          object,
          deletedAtMs: integer(
            current.deletedAtMs,
            `${description} deletion time`,
          ),
        }
  return {
    outcome: 'conflict',
    conflict: { ...revisions, current: state },
  }
}

export function mapStructuredSnapshot(value: unknown): StructuredObject {
  const snapshot = record(value, 'structured snapshot')
  return {
    summary: mapStructuredSummary(snapshot.summary),
    markdown: string(snapshot.bodyMarkdown, 'structured markdown'),
    createdAtMs: integer(snapshot.createdAtMs, 'structured creation time'),
    updatedAtMs: integer(snapshot.updatedAtMs, 'structured update time'),
    privacy: privacy(snapshot.privacyLevel),
    media: array(snapshot.attachments, 'structured media').map(mapMediaItem),
    hasMoreMedia: boolean(
      snapshot.hasMoreAttachments,
      'structured media continuation',
    ),
  }
}

function mapStructuredSummary(value: unknown): StructuredSummary {
  const summary = record(value, 'structured summary')
  const metadata = record(summary.metadata, 'structured metadata')
  return {
    id: requiredStableId(summary.id, 'structured identifier'),
    revision: requiredRevision(summary.mutationRevision, 'structured revision'),
    title: string(summary.title, 'structured title'),
    placement: mapStructuredPlacement(metadata),
    iconId: string(metadata.iconId, 'structured icon identifier'),
    tags: {
      ordered: array(metadata.tagIds, 'structured tags').map((tag) =>
        string(tag, 'structured tag identifier'),
      ),
      display: nullableString(
        metadata.displayTagId,
        'structured display tag identifier',
      ),
    },
    trackId: nullableStableId(metadata.trackId, 'structured track identifier'),
  }
}

function mapStructuredPlacement(
  metadata: Record<string, unknown>,
): StructuredPlacement {
  if (metadata.kind === 'event') {
    return {
      kind: 'event',
      date: requiredCivilDate(metadata.date, 'event date'),
    }
  }
  literal(metadata.kind, ['span'] as const, 'structured kind')
  return {
    kind: 'span',
    startDate: requiredCivilDate(metadata.startDate, 'span start date'),
    endDate: nullableCivilDate(metadata.endDate, 'span end date'),
    beginMarker: mapMarker(metadata.beginMarker, 'begin marker'),
    endMarker: mapMarker(metadata.endMarker, 'end marker'),
  }
}

function mapMarker(value: unknown, description: string) {
  const marker = record(value, description)
  return {
    enabled: boolean(marker.enabled, `${description} enabled state`),
    titleOverride: nullableString(
      marker.titleOverride,
      `${description} title override`,
    ),
  }
}

function mapTrackDraft(value: {
  readonly name: string
  readonly iconId: string
  readonly suggestedTagId: string | null
  readonly isArchived: boolean
}): Record<string, unknown> {
  return {
    name: string(value.name, 'track name'),
    iconId: string(value.iconId, 'track icon identifier'),
    suggestedTagId: value.suggestedTagId,
    isArchived: boolean(value.isArchived, 'track archived state'),
  }
}

function mapTrack(value: unknown, mutationRevision: unknown): Track {
  const track = record(value, 'track')
  return {
    id: requiredStableId(track.id, 'track identifier'),
    revision: requiredRevision(mutationRevision, 'track revision'),
    name: string(track.name, 'track name'),
    iconId: string(track.iconId, 'track icon identifier'),
    suggestedTagId: nullableString(
      track.suggestedTagId,
      'track suggested tag identifier',
    ),
    isArchived: boolean(track.isArchived, 'track archived state'),
    createdAtMs: timestampMillis(track.createdAt, 'track creation time'),
    updatedAtMs: timestampMillis(track.updatedAt, 'track update time'),
  }
}

export function mapTrackSnapshot(value: unknown): Track {
  const snapshot = record(value, 'track snapshot')
  return mapTrack(snapshot.track, snapshot.mutationRevision)
}

function mapTrackSummary(value: unknown): TrackSummary {
  const summary = record(value, 'track summary')
  return {
    track: mapTrackSnapshot(summary.current),
    memberCount: count(summary.memberCount, 'track member count'),
    ongoingMemberCount: count(
      summary.ongoingMemberCount,
      'ongoing track member count',
    ),
  }
}

function mapTrackLoad(result: Record<string, unknown>): TrackState {
  const snapshot = record(result.current, 'track current state')
  const runtimeTrack = record(snapshot.track, 'track')
  const track = mapTrackSnapshot(snapshot)
  return runtimeTrack.deletedAt === null || runtimeTrack.deletedAt === undefined
    ? {
        presence: 'present',
        track,
        invalidation: mapInvalidation(result.token),
      }
    : {
        presence: 'deleted',
        track,
        invalidation: mapInvalidation(result.token),
      }
}

function mapTrackMutation(
  result: Record<string, unknown>,
): TrackMutationResult {
  return {
    outcome: literal(
      result.outcome,
      ['created', 'updated', 'unchanged', 'deleted'] as const,
      'track mutation outcome',
    ),
    track: mapTrackSnapshot(result.current),
    detachedMemberCount:
      result.detachedMemberCount === undefined
        ? 0
        : count(result.detachedMemberCount, 'detached track member count'),
    invalidation: mapInvalidation(result.token),
  }
}

function mapTrackConflict(
  failure: RuntimeFailure,
  description: string,
): TrackMutationResult | null {
  const revisions = conflictRevisions(failure, description)
  if (!revisions) {
    return null
  }
  const current = record(
    failure.currentState,
    `${description} conflict current state`,
  )
  const runtimeTrack = record(
    current.track,
    `${description} conflict current track`,
  )
  const track = mapTrackSnapshot(current)
  const state: TrackConflictState =
    runtimeTrack.deletedAt === null || runtimeTrack.deletedAt === undefined
      ? { presence: 'present', track }
      : { presence: 'deleted', track }
  return {
    outcome: 'conflict',
    conflict: { ...revisions, current: state },
  }
}

function mapTrackHistory(result: Record<string, unknown>): TrackHistoryPage {
  return {
    track: mapTrackSnapshot(result.track),
    members: array(result.members, 'track history members').map(mapTrackMember),
    nextCursor:
      result.nextCursor === null || result.nextCursor === undefined
        ? null
        : coreTrackHistoryCursor(
            string(result.nextCursor, 'track history cursor'),
          ),
    invalidation: mapInvalidation(result.token),
  }
}

function mapTrackMember(value: unknown): TrackMember {
  const member = record(value, 'track history member')
  return {
    id: requiredStableId(member.id, 'track member identifier'),
    revision: requiredRevision(
      member.mutationRevision,
      'track member revision',
    ),
    kind: literal(member.kind, ['event', 'span'] as const, 'track member kind'),
    title: string(member.title, 'track member title'),
    primaryDate: requiredCivilDate(
      member.primaryDate,
      'track member primary date',
    ),
    endDate: nullableCivilDate(member.endDate, 'track member end date'),
    iconId: string(member.iconId, 'track member icon identifier'),
    displayTagId: nullableString(
      member.displayTagId,
      'track member display tag identifier',
    ),
    beginMarkerTitleOverride: nullableString(
      member.beginMarkerTitleOverride,
      'begin marker title override',
    ),
    endMarkerTitleOverride: nullableString(
      member.endMarkerTitleOverride,
      'end marker title override',
    ),
  }
}

function mapTimelineIndexRequest(
  request: TimelineIndexRequest,
): Record<string, unknown> {
  if (request.windows.length === 0) {
    throw new TypeError('Timeline windows are missing')
  }
  const first = request.windows[0]
  const last = request.windows.at(-1)
  if (!last) {
    throw new TypeError('Timeline windows are missing')
  }
  return {
    contractVersion: 1,
    spans: request.windows.map(mapTimelineSpan),
    firstWeekday: count(
      request.weekRules.firstWeekday,
      'timeline first weekday',
    ),
    minimumDaysInFirstWeek: count(
      request.weekRules.minimumDaysInFirstWeek,
      'timeline minimum days in first week',
    ),
    sceneStartDate: first.startDate,
    sceneEndDate: last.endDate,
    asOfCivilDate: request.asOf,
  }
}

function mapTimelineIndex(
  result: Record<string, unknown>,
  requestedWindows: readonly TimeWindow[],
): TimelinePage {
  return {
    rows: array(result.rows, 'timeline rows').map((row) =>
      mapTimelineRow(row, requestedWindows),
    ),
    scene: array(result.structuredScene, 'timeline structured scene').map(
      mapStructuredSummary,
    ),
    markerCandidates: array(
      result.derivedMarkers,
      'timeline marker candidates',
    ).map(mapBoundaryMarker),
    contentBounds:
      result.contentBounds === null || result.contentBounds === undefined
        ? null
        : mapContentBounds(result.contentBounds),
    structuredContentEndDate: nullableCivilDate(
      result.structuredContentEndDate,
      'timeline structured content end date',
    ),
    invalidation: mapInvalidation(result.token),
  }
}

function mapTimelineRow(
  value: unknown,
  requestedWindows: readonly TimeWindow[],
): TimelineRow {
  const row = record(value, 'timeline row')
  const span = record(row.span, 'timeline row span')
  const exact =
    row.exactEntry === null || row.exactEntry === undefined
      ? null
      : record(row.exactEntry, 'timeline exact entry')
  const coverage =
    row.coverage === null || row.coverage === undefined
      ? null
      : record(row.coverage, 'timeline coverage')
  return {
    window: matchReturnedWindow(span, requestedWindows),
    exactEntry: exact
      ? {
          id: requiredStableId(exact.id, 'timeline entry identifier'),
          revision: requiredRevision(
            exact.mutationRevision,
            'timeline entry revision',
          ),
        }
      : null,
    exactEntryHasWriting: boolean(
      row.exactEntryHasWriting,
      'timeline writing state',
    ),
    mediaCount: count(row.attachmentCount, 'timeline media count'),
    containedEntryCounts: {
      day: count(row.dayEntryCount, 'timeline day entry count'),
      week: count(row.weekEntryCount, 'timeline week entry count'),
      month: count(row.monthEntryCount, 'timeline month entry count'),
    },
    coverage: coverage
      ? {
          filled: count(coverage.numerator, 'timeline coverage numerator'),
          total: count(coverage.denominator, 'timeline coverage denominator'),
        }
      : null,
    hasContent: boolean(row.hasContent, 'timeline content state'),
  }
}

function mapTimelineFocus(
  result: Record<string, unknown>,
  requestedWindow: TimeWindow,
): TimelineFocusResult {
  const exact =
    result.exactEntry === null || result.exactEntry === undefined
      ? null
      : record(result.exactEntry, 'timeline focused entry')
  return {
    outcome: 'focused',
    window: matchReturnedWindow(record(result.span, 'timeline focused span'), [
      requestedWindow,
    ]),
    entry: exact
      ? {
          reference: {
            id: requiredStableId(
              record(exact.reference, 'focused entry reference').id,
              'focused entry identifier',
            ),
            revision: requiredRevision(
              record(exact.reference, 'focused entry reference')
                .mutationRevision,
              'focused entry revision',
            ),
          },
          text: string(exact.text, 'focused entry text'),
          preview: string(exact.preview, 'focused entry preview'),
        }
      : null,
    media: array(result.attachments, 'focused entry media').map(mapMediaItem),
    invalidation: mapInvalidation(result.token),
  }
}

function mapTimelineStale(
  failure: RuntimeFailure,
): { readonly outcome: 'stale' } | null {
  return failure.code === 'invalidationConflict' ||
    failure.code === 'revisionConflict'
    ? { outcome: 'stale' }
    : null
}

function conflictRevisions(
  failure: RuntimeFailure,
  description: string,
): {
  readonly expectedRevision: ReturnType<typeof revision>
  readonly actualRevision: ReturnType<typeof revision>
} | null {
  if (failure.code !== 'revisionConflict' || failure.category !== 'conflict') {
    return null
  }
  const details = record(failure.details, `${description} conflict details`)
  return {
    expectedRevision: requiredRevision(
      details.expectedRevision,
      `${description} expected revision`,
    ),
    actualRevision: requiredRevision(
      details.actualRevision,
      `${description} actual revision`,
    ),
  }
}

function matchReturnedWindow(
  span: Record<string, unknown>,
  requestedWindows: readonly TimeWindow[],
): TimeWindow {
  const id = string(span.id, 'returned window identifier')
  const window = requestedWindows.find((candidate) => candidate.id === id)
  if (
    !window ||
    span.scale !== window.scale ||
    span.startMs !== window.startMs ||
    span.endMs !== window.endMs ||
    span.calendarIdentifier !== window.calendarId ||
    span.timeZoneIdentifier !== window.timeZoneId
  ) {
    throw new TypeError('Runtime window does not match requested window')
  }
  return window
}

function mapContentBounds(value: unknown) {
  const bounds = record(value, 'timeline content bounds')
  return {
    startMs: integer(bounds.startMs, 'timeline content start'),
    endMs: integer(bounds.endMs, 'timeline content end'),
  }
}

function mapBoundaryMarker(value: unknown): BoundaryMarker {
  const marker = record(value, 'boundary marker')
  return {
    boundary: literal(
      marker.boundary,
      ['begin', 'end'] as const,
      'marker boundary',
    ),
    date: requiredCivilDate(marker.date, 'marker date'),
    parentSpanId: requiredStableId(
      marker.parentSpanId,
      'marker parent span identifier',
    ),
    parentSpanRevision: requiredRevision(
      marker.parentSpanRevision,
      'marker parent span revision',
    ),
    parentStartDate: requiredCivilDate(
      marker.parentStartDate,
      'marker parent start date',
    ),
    parentEndDate: nullableCivilDate(
      marker.parentEndDate,
      'marker parent end date',
    ),
    trackId: nullableStableId(marker.trackId, 'marker track identifier'),
    titleMode: literal(
      marker.titleMode,
      ['automatic', 'override'] as const,
      'marker title mode',
    ),
    titleOverride: nullableString(
      marker.titleOverride,
      'marker title override',
    ),
    iconId: string(marker.iconId, 'marker icon identifier'),
    displayTagId: nullableString(
      marker.displayTagId,
      'marker display tag identifier',
    ),
  }
}

function mapMediaListing(result: Record<string, unknown>): MediaListing {
  literal(result.outcome, ['listed'] as const, 'media list outcome')
  return {
    parentEntryId: requiredStableId(
      result.entryId,
      'media parent entry identifier',
    ),
    parentRevision: requiredRevision(
      result.entryRevision,
      'media parent revision',
    ),
    items: array(result.attachments, 'media items').map(mapMediaItem),
    invalidation: mapInvalidation(result.token),
  }
}

function mapMediaItem(value: unknown): MediaItem {
  const item = record(value, 'media item')
  return {
    id: requiredStableId(item.id, 'media identifier'),
    parentEntryId: requiredStableId(item.entryId, 'media parent identifier'),
    fileName: string(item.fileName, 'media filename'),
    kind: mediaKind(item.mediaType),
    mimeType: string(item.mimeType, 'media MIME type'),
    byteSize: count(item.byteSize, 'media byte size'),
    createdAtMs: integer(item.createdAtMs, 'media creation time'),
    capturedAtMs: nullableInteger(item.capturedAtMs, 'media capture time'),
    durationMs: nullableCount(item.durationMs, 'media duration'),
    width: nullableCount(item.width, 'media width'),
    height: nullableCount(item.height, 'media height'),
    caption: nullableString(item.caption, 'media caption'),
  }
}

function mapArchiveIdentityRequest(
  identity: ArchiveIdentity,
): Record<string, unknown> {
  return {
    id: identity.id,
    title: identity.title,
    subject: {
      id: identity.subject.id,
      displayName: identity.subject.displayName,
      shortName: identity.subject.shortName,
      lifeStatus: identity.subject.lifeStatus,
      dateOfBirth: identity.subject.dateOfBirth,
      dateOfDeath: identity.subject.dateOfDeath,
    },
  }
}

function mapArchiveIdentity(value: unknown): ArchiveIdentity {
  const identity = record(value, 'archive identity')
  const subject = record(identity.subject, 'archive subject')
  return {
    id: requiredStableId(identity.id, 'archive identity identifier'),
    title: nullableString(identity.title, 'archive title'),
    subject: {
      id: requiredStableId(subject.id, 'archive subject identifier'),
      displayName: nullableString(subject.displayName, 'subject display name'),
      shortName: nullableString(subject.shortName, 'subject short name'),
      lifeStatus: literal(
        subject.lifeStatus,
        ['unspecified', 'living', 'deceased'] as const,
        'subject life status',
      ),
      dateOfBirth: nullableCivilDate(subject.dateOfBirth, 'subject birth date'),
      dateOfDeath: nullableCivilDate(subject.dateOfDeath, 'subject death date'),
    },
  }
}

function mapArchiveVerification(
  result: Record<string, unknown>,
): ArchiveVerification {
  return {
    valid: boolean(result.valid, 'archive verification validity'),
    issues: array(result.issues, 'archive verification issues').map((value) => {
      const issue = record(value, 'archive verification issue')
      return {
        code: string(issue.code, 'archive verification issue code'),
        path: nullableString(issue.path, 'archive verification issue path'),
      }
    }),
    checkedFiles: count(result.checkedFiles, 'archive checked file count'),
  }
}

function mapArchiveOverview(result: Record<string, unknown>): ArchiveOverview {
  const entryCounts = record(result.entryCounts, 'archive entry counts')
  const structuredCounts = record(
    result.structuredCounts,
    'archive structured counts',
  )
  const trackCounts = record(result.trackCounts, 'archive track counts')
  const health = record(result.health, 'archive health')
  return {
    storeId: requiredStableId(result.storeId, 'archive overview store ID'),
    storeSchemaVersion: integerText(
      result.schemaVersion,
      'archive schema version',
    ),
    storeContract: integerText(
      result.storeContractVersion,
      'archive store contract',
    ),
    visibleEntryCount: count(
      result.visibleEntryCount,
      'archive visible entry count',
    ),
    entryCounts: {
      moment: count(entryCounts.moment, 'moment entry count'),
      day: count(entryCounts.day, 'day entry count'),
      week: count(entryCounts.week, 'week entry count'),
      month: count(entryCounts.month, 'month entry count'),
      year: count(entryCounts.year, 'year entry count'),
      custom: count(entryCounts.custom, 'custom entry count'),
    },
    structuredCounts: {
      events: count(structuredCounts.events, 'event count'),
      spans: count(structuredCounts.spans, 'span count'),
    },
    trackCounts: {
      active: count(trackCounts.active, 'active track count'),
      archived: count(trackCounts.archived, 'archived track count'),
      ongoingMembers: count(
        trackCounts.ongoingMembers,
        'ongoing track member count',
      ),
    },
    mediaCount: count(result.attachmentCount, 'archive media count'),
    mediaByteTotal: count(
      result.attachmentByteTotal,
      'archive media byte total',
    ),
    health: {
      readable: boolean(health.storeReadable, 'archive readability'),
      schemaCompatible: boolean(
        health.schemaCompatible,
        'archive schema compatibility',
      ),
      recovery: literal(
        health.recoveryState,
        ['clean'] as const,
        'archive recovery state',
      ),
      integrity:
        literal(
          health.databaseIntegrity,
          ['ok'] as const,
          'archive database integrity',
        ) && 'verified',
      referenceViolationCount: count(
        health.foreignKeyViolationCount,
        'archive reference violation count',
      ),
      overall: literal(
        health.status,
        ['healthy'] as const,
        'archive health status',
      ),
    },
    invalidation: mapInvalidation(result.token),
  }
}

function mapArchiveExportRequest(
  request: ArchiveExportRequest,
): Record<string, unknown> {
  return {
    operationId: request.operationId,
    contractVersion: '5',
    archiveId: request.artifactId,
    createdAtMs: request.createdAtMs,
    createdBy: {
      appName: 'LifeArchive Web',
      appVersion: packageMetadata.version,
    },
    archiveName: 'LifeArchive.lifearchive',
  }
}

function mapArchiveExport(
  result: Record<string, unknown>,
  transfer: ArrayBuffer,
  request: ArchiveExportRequest,
): ArchiveExportResult {
  const transport = record(result.browserTransport, 'archive browser transport')
  const counts = record(result.counts, 'archive export counts')
  const range =
    result.dateRange === null || result.dateRange === undefined
      ? null
      : record(result.dateRange, 'archive export date range')
  const expectedBytes = decimalCount(
    transport.byteLength,
    'archive transfer byte length',
  )
  if (transfer.byteLength !== expectedBytes) {
    throw new TypeError('Malformed archive transfer byte length')
  }
  const artifactId = requiredStableId(
    result.archiveId,
    'archive export artifact identifier',
  )
  if (artifactId !== request.artifactId) {
    throw new TypeError('Archive export artifact ID does not match request')
  }
  return {
    archive: new File(
      [transfer],
      string(transport.fileName, 'archive export filename'),
      { type: string(transport.mimeType, 'archive export MIME type') },
    ),
    artifactId,
    sourceStoreId: request.sourceStoreId,
    createdAt: string(result.createdAt, 'archive creation time'),
    counts: {
      entries: count(counts.entries, 'export entry count'),
      media: count(counts.attachments, 'export media count'),
      summaries: count(counts.summaries, 'export summary count'),
    },
    dateRange: range
      ? {
          start: string(range.start, 'archive date range start'),
          end: string(range.end, 'archive date range end'),
        }
      : null,
    filesWritten: count(result.filesWritten, 'archive files written count'),
    checkedFiles: count(result.checkedFiles, 'archive checked file count'),
    checksumAlgorithm: literal(
      result.checksumAlgorithm,
      ['sha256'] as const,
      'archive checksum algorithm',
    ),
    invalidation: mapInvalidation(result.token),
  }
}

function mapArchiveImport(
  result: Record<string, unknown>,
  previousInvalidation: InvalidationToken,
): ArchiveImportResult {
  literal(result.outcome, ['applied'] as const, 'archive import outcome')
  const invalidation = mapInvalidation(result.token)
  const issues = array(result.issues, 'archive import issues').map((value) => {
    const issue = record(value, 'archive import issue')
    const kind = issue.recordKind
    return {
      code: string(issue.code, 'archive import issue code'),
      field: nullableString(issue.field, 'archive import issue field'),
      recordKind: mapImportRecordKind(kind),
      id: nullableStableId(issue.id, 'archive import issue identifier'),
    }
  })
  const recovery = issues.some((issue) => issue.code === 'recoveryPending')
    ? 'pending'
    : 'clean'
  return {
    changed:
      invalidation.storeInstanceId !== previousInvalidation.storeInstanceId ||
      invalidation.revision !== previousInvalidation.revision ||
      recovery === 'pending',
    recovery,
    importedEntries: count(result.importedEntries, 'imported entry count'),
    importedMedia: count(
      result.importedAttachments,
      'imported attachment count',
    ),
    importedTracks: count(result.importedTracks, 'imported track count'),
    skippedEntries: count(result.skippedEntries, 'skipped entry count'),
    skippedMedia: count(result.skippedAttachments, 'skipped attachment count'),
    skippedTracks: count(result.skippedTracks, 'skipped track count'),
    skippedEntryIds: stableIds(result.skippedEntryIds, 'skipped entry IDs'),
    skippedMediaIds: stableIds(
      result.skippedAttachmentIds,
      'skipped attachment IDs',
    ),
    skippedTrackIds: stableIds(result.skippedTrackIds, 'skipped track IDs'),
    issues,
    identity: mapImportIdentity(result),
    invalidation,
  }
}

function mapImportRecordKind(value: unknown): ArchiveImportIssue['recordKind'] {
  if (value === null || value === undefined) {
    return null
  }
  return value === 'attachment'
    ? 'media'
    : literal(
        value,
        ['entry', 'track'] as const,
        'archive import issue record kind',
      )
}

function mapImportIdentity(
  result: Record<string, unknown>,
): ArchiveImportResult['identity'] {
  switch (result.identityOutcome) {
    case 'adopted':
      return { outcome: 'adopted' }
    case 'matched':
      return { outcome: 'matched' }
    case 'filled':
      return {
        outcome: 'merged',
        filledFields: stableStrings(
          result.identityFilledFields,
          'identity filled fields',
        ),
        conflictingFields: [],
      }
    case 'conflicts':
      return {
        outcome: 'merged',
        filledFields: stableStrings(
          result.identityFilledFields,
          'identity filled fields',
        ),
        conflictingFields: array(
          result.identityConflicts,
          'identity conflicts',
        ).map((value) =>
          string(record(value, 'identity conflict').field, 'identity field'),
        ),
      }
    case 'legacyPreserved':
      return { outcome: 'preserved' }
    default:
      throw new TypeError('Malformed archive import identity outcome')
  }
}

export function mapInvalidation(value: unknown): InvalidationToken {
  const token = record(value, 'runtime invalidation token')
  return {
    storeInstanceId: string(
      token.storeInstanceId,
      'invalidation store instance identifier',
    ),
    revision: requiredRevision(token.revision, 'invalidation revision'),
  }
}

function mapInvalidationRequest(value: InvalidationToken) {
  return {
    storeInstanceId: string(
      value.storeInstanceId,
      'invalidation store instance identifier',
    ),
    revision: requiredRevision(value.revision, 'invalidation revision'),
  }
}

function mediaKind(value: unknown): MediaKind {
  return literal(
    value,
    ['image', 'video', 'audio', 'document', 'text', 'other'] as const,
    'media kind',
  )
}

function privacy(value: unknown): PrivacyLevel {
  return literal(
    value,
    ['normal', 'sensitive', 'locked'] as const,
    'privacy level',
  )
}

function record(value: unknown, description: string): Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    value instanceof ArrayBuffer
  ) {
    throw new TypeError(`Malformed ${description}`)
  }
  return value as Record<string, unknown>
}

function array(value: unknown, description: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return value
}

function string(value: unknown, description: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`Malformed ${description}`)
  }
  return value
}

function boolean(value: unknown, description: string): boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`Malformed ${description}`)
  }
  return value
}

function integer(value: unknown, description: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return value
}

function count(value: unknown, description: string): number {
  const result = integer(value, description)
  if (result < 0) {
    throw new TypeError(`Malformed ${description}`)
  }
  return result
}

function nullableInteger(value: unknown, description: string): number | null {
  return value === null || value === undefined
    ? null
    : integer(value, description)
}

function timestampMillis(value: unknown, description: string): number {
  const timestamp = string(value, description)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(timestamp)) {
    throw new TypeError(`Malformed ${description}`)
  }
  const milliseconds = Date.parse(timestamp)
  if (!Number.isSafeInteger(milliseconds)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return milliseconds
}

function nullableCount(value: unknown, description: string): number | null {
  return value === null || value === undefined
    ? null
    : count(value, description)
}

function nullableString(value: unknown, description: string): string | null {
  return value === null || value === undefined
    ? null
    : string(value, description)
}

function requiredStableId(value: unknown, description: string): StableId {
  if (typeof value !== 'string' || !isStableId(value)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return stableId(value)
}

function nullableStableId(
  value: unknown,
  description: string,
): StableId | null {
  return value === null || value === undefined
    ? null
    : requiredStableId(value, description)
}

function requiredRevision(value: unknown, description: string) {
  if (typeof value !== 'string' || !isRevision(value)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return revision(value)
}

function requiredCivilDate(value: unknown, description: string) {
  if (typeof value !== 'string' || !isCivilDate(value)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return civilDate(value)
}

function nullableCivilDate(value: unknown, description: string) {
  return value === null || value === undefined
    ? null
    : requiredCivilDate(value, description)
}

function literal<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  description: string,
): Values[number] {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return value as Values[number]
}

function stableIds(value: unknown, description: string): readonly StableId[] {
  return array(value, description).map((entry) =>
    requiredStableId(entry, description),
  )
}

function stableStrings(value: unknown, description: string): readonly string[] {
  return array(value, description).map((entry) => string(entry, description))
}

function integerText(value: unknown, description: string): string {
  return String(count(value, description))
}

function decimalCount(value: unknown, description: string): number {
  const text = string(value, description)
  if (!/^(0|[1-9][0-9]*)$/.test(text)) {
    throw new TypeError(`Malformed ${description}`)
  }
  const parsed = Number(text)
  if (!Number.isSafeInteger(parsed)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return parsed
}
