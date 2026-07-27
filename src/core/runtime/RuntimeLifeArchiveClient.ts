import {
  clientFailure,
  failed,
  isRevision,
  isStableId,
  ok,
  operationId,
  revision,
  stableId,
  type ArchiveChange,
  type ArchiveSession,
  type ClientFailure,
  type ClientResult,
  type LifeArchiveClient,
  type OpenArchive,
  type RuntimeFacts,
  type RuntimeStatus,
  type Unsubscribe,
} from '../client'
import type {
  ArchiveCloseResult,
  ArchiveEraseRequest,
  ArchiveEraseResult,
  ArchiveExportRequest,
  ArchiveExportResult,
  ArchiveIdentity,
  ArchiveIdentitySaveResult,
  ArchiveIdentityState,
  ArchiveImportIdentityOutcome,
  ArchiveImportIssue,
  ArchiveImportRequest,
  ArchiveImportResult,
  ArchiveOverview,
  ArchiveVerification,
  ArchiveVerifyRequest,
  CalendarContext,
  CalendarContextRequest,
  CancellationRequestResult,
  InvalidationToken,
  MediaContent,
  MediaContentRequest,
  MediaDeleteRequest,
  MediaDeleteResult,
  MediaImportRequest,
  MediaImportResult,
  MediaListRequest,
  MediaListing,
  OrdinaryDeleteRequest,
  OrdinaryDeleteResult,
  OrdinaryEntryState,
  OrdinarySaveRequest,
  OrdinarySaveResult,
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
  WindowStepRequest,
} from '../client'
import {
  WorkerTransportError,
  type WorkerTransport,
} from './worker/WorkerTransport'
import { mayMutateDurableState } from './worker/durableOperations'

interface WireSuccess {
  readonly outcome: 'success'
  readonly result: unknown
}

interface WireFailure {
  readonly outcome: 'failure'
  readonly failure: {
    readonly code?: unknown
    readonly details?: unknown
  }
}

type WireEnvelope = WireSuccess | WireFailure

interface WireResponse {
  readonly envelope: unknown
  readonly transfers: readonly ArrayBuffer[]
}

interface PreparedRequest {
  readonly request: unknown
  readonly transfers: ArrayBuffer[]
  readonly archive?: File
}

export interface RuntimeClientOptions {
  readonly transport: Pick<WorkerTransport, 'request' | 'close'> &
    Partial<Pick<WorkerTransport, 'observeFatal'>>
  readonly runtime: RuntimeFacts
  readonly requiredCapabilities?: readonly string[]
}

/**
 * The one handwritten mapping boundary between generated/wire values and the
 * ergonomic public client. It preserves values and ordering; it never derives,
 * retries, merges, or substitutes a product outcome.
 */
export class RuntimeLifeArchiveClient implements LifeArchiveClient {
  private readonly options: RuntimeClientOptions
  private runtimeState: RuntimeStatus
  private archiveState: ArchiveSession = { state: 'no-archive' }
  private readonly statusListeners = new Set<(status: RuntimeStatus) => void>()
  private readonly sessionListeners = new Set<
    (session: ArchiveSession) => void
  >()
  private readonly changeListeners = new Set<(change: ArchiveChange) => void>()
  private readonly cancellableOperations = new Map<string, AbortController>()
  private archiveOperationActive = false

  constructor(options: RuntimeClientOptions) {
    this.options = options
    this.runtimeState = { state: 'available', runtime: options.runtime }
    options.transport.observeFatal?.((error) => {
      this.recordWorkerLoss(error.durableOutcome)
    })
  }

  readonly runtime: LifeArchiveClient['runtime'] = {
    status: () => this.runtimeState,
    observeStatus: (listener) => subscribe(this.statusListeners, listener),
    storage: () => this.invoke<StorageFacts>('runtime.storage', null),
  }

  readonly archive: LifeArchiveClient['archive'] = {
    session: () => this.archiveState,
    observeSession: (listener) => subscribe(this.sessionListeners, listener),
    create: () =>
      this.runExclusiveArchiveOperation(async () => {
        this.setArchiveState({ state: 'opening' })
        const result = await this.invoke<OpenArchive>(
          'store.open',
          this.openRequest('create'),
        )
        this.finishOpen(result)
        return result
      }),
    open: () =>
      this.runExclusiveArchiveOperation(async () => {
        this.setArchiveState({ state: 'opening' })
        const result = await this.invoke<OpenArchive>(
          'store.open',
          this.openRequest('existing'),
        )
        this.finishOpen(result)
        return result
      }),
    close: () =>
      this.runExclusiveArchiveOperation(async () => {
        const previousState = this.archiveState
        this.setArchiveState({ state: 'closing' })
        const result = await this.invoke<ArchiveCloseResult>(
          'store.close',
          null,
        )
        if (result.status === 'ok') {
          this.setArchiveState({ state: 'closed' })
          try {
            await this.options.transport.close()
          } catch {
            // Product close completion is definitive. At this point its
            // handle and root ownership are gone, so transport teardown
            // cannot truthfully turn the result into a failed close.
          }
        } else if (this.archiveState.state !== 'lost') {
          this.setArchiveState(previousState)
        }
        return result
      }),
    overview: () => this.invoke<ArchiveOverview>('archive.overview', {}),
    verify: (request: ArchiveVerifyRequest) =>
      this.runExclusiveArchiveOperation(() =>
        this.invoke<ArchiveVerification>('archive.verify', request),
      ),
    import: (request: ArchiveImportRequest) =>
      this.runExclusiveArchiveOperation(async () => {
        const controller = new AbortController()
        this.cancellableOperations.set(request.operationId, controller)
        try {
          return await this.invoke<ArchiveImportResult>(
            'archive.apply',
            request,
            controller.signal,
          )
        } finally {
          this.cancellableOperations.delete(request.operationId)
        }
      }),
    export: (request: ArchiveExportRequest) =>
      this.runExclusiveArchiveOperation(async () => {
        const controller = new AbortController()
        this.cancellableOperations.set(request.operationId, controller)
        try {
          return await this.invoke<ArchiveExportResult>(
            'archive.export',
            request,
            controller.signal,
          )
        } finally {
          this.cancellableOperations.delete(request.operationId)
        }
      }),
    erase: (request: ArchiveEraseRequest) =>
      this.runExclusiveArchiveOperation(() =>
        this.invoke<ArchiveEraseResult>('archive.erase', request),
      ),
  }

  readonly identity: LifeArchiveClient['identity'] = {
    load: () =>
      this.invoke<ArchiveIdentityState>('archive.identity.load', null),
    save: (identity: ArchiveIdentity) =>
      this.invoke<ArchiveIdentitySaveResult>('archive.identity.save', identity),
  }

  readonly time: LifeArchiveClient['time'] = {
    window: (request: TimeWindowRequest) =>
      this.invoke<TimeWindow>('time.window', request),
    step: (request: WindowStepRequest) =>
      this.invoke<TimeWindow>('time.step', request),
    calendarContext: (request: CalendarContextRequest) =>
      this.invoke<CalendarContext>('time.calendarContext', request),
  }

  readonly record: LifeArchiveClient['record'] = {
    load: (window: TimeWindow) =>
      this.invoke<OrdinaryEntryState>('record.loadSpan', window),
    save: (request: OrdinarySaveRequest) =>
      this.invoke<OrdinarySaveResult>('record.saveDraft', request),
    delete: (request: OrdinaryDeleteRequest) =>
      this.invoke<OrdinaryDeleteResult>('record.deleteEntry', request),
    listObjects: (request: StructuredListRequest) =>
      this.invoke<StructuredListPage>('record.listObjects', request),
  }

  readonly structured: LifeArchiveClient['structured'] = {
    load: (request: StructuredLoadRequest) =>
      this.invoke<StructuredObjectState>('structured.load', request),
    create: (request: StructuredCreateRequest) =>
      this.invoke<StructuredMutationResult>('structured.create', request),
    save: (request: StructuredSaveRequest) =>
      this.invoke<StructuredMutationResult>('structured.save', request),
    delete: (request: StructuredDeleteRequest) =>
      this.invoke<StructuredDeleteResult>('structured.delete', request),
    convertSpanToEvent: (request: StructuredConvertRequest) =>
      this.invoke<StructuredMutationResult>(
        'structured.convertSpanToEvent',
        request,
      ),
  }

  readonly tracks: LifeArchiveClient['tracks'] = {
    list: (request: TrackListRequest) =>
      this.invoke<TrackListPage>('track.list', request),
    load: (id: StableId) => this.invoke<TrackState>('track.load', { id }),
    create: (request: TrackCreateRequest) =>
      this.invoke<TrackMutationResult>('track.create', request),
    save: (request: TrackSaveRequest) =>
      this.invoke<TrackMutationResult>('track.save', request),
    delete: (request: TrackDeleteRequest) =>
      this.invoke<TrackMutationResult>('track.delete', request),
    createWithFirstMember: (request: TrackWithFirstMemberRequest) =>
      this.invoke<TrackWithFirstMember>('track.createWithFirstMember', request),
    history: (request: TrackHistoryRequest) =>
      this.invoke<TrackHistoryPage>('track.history', request),
    attachMember: (request: TrackMembershipRequest) =>
      this.invoke<StructuredMutationResult>('track.attachMember', request),
    detachMember: (request: TrackDetachRequest) =>
      this.invoke<StructuredMutationResult>('track.detachMember', request),
    createMember: (request: TrackMemberCreateRequest) =>
      this.invoke<StructuredMutationResult>('track.createMember', request),
  }

  readonly timeline: LifeArchiveClient['timeline'] = {
    index: (request: TimelineIndexRequest) =>
      this.invoke<TimelinePage>('timeline.index', request),
    focus: (request: TimelineFocusRequest) =>
      this.invoke<TimelineFocusResult>('timeline.focusedDetail', request),
    structuredDetail: (request: TimelineStructuredDetailRequest) =>
      this.invoke<TimelineStructuredDetailResult>(
        'timeline.structuredDetail',
        request,
      ),
    structuredList: (request: TimelineStructuredListRequest) =>
      this.invoke<TimelineStructuredListResult>(
        'timeline.structuredList',
        request,
      ),
  }

  readonly media: LifeArchiveClient['media'] = {
    list: (request: MediaListRequest) =>
      this.invoke<MediaListing>('media.listForEntry', request),
    content: (request: MediaContentRequest) =>
      this.invoke<MediaContent>('media.resolveContent', request),
    import: (request: MediaImportRequest) =>
      this.invoke<MediaImportResult>('media.import', request),
    delete: (request: MediaDeleteRequest) =>
      this.invoke<MediaDeleteResult>('media.delete', request),
  }

  readonly operations: LifeArchiveClient['operations'] = {
    newStableId: () => stableId(newIdentifierText()),
    newOperationId: () => operationId(newIdentifierText()),
    requestCancel: (id) => {
      const controller = this.cancellableOperations.get(id)
      if (!controller) {
        return Promise.resolve(
          ok<CancellationRequestResult>({
            operationId: id,
            outcome: 'not-active',
          }),
        )
      }
      controller.abort()
      return Promise.resolve(
        ok<CancellationRequestResult>({
          operationId: id,
          outcome: 'requested',
        }),
      )
    },
    observeChanges: (listener) => subscribe(this.changeListeners, listener),
  }

  private async invoke<Value>(
    operation: string,
    request: unknown,
    signal?: AbortSignal,
  ): Promise<ClientResult<Value>> {
    let requestDispatched = false
    let completionEvidence = false
    try {
      const prepared = await prepareRequest(operation, request)
      requestDispatched = true
      const payload = await this.options.transport.request({
        operation,
        payload: {
          request: prepared.request,
          transfers: prepared.transfers,
          ...(prepared.archive ? { archive: prepared.archive } : {}),
        },
        transfer: prepared.transfers,
        signal,
      })
      const response = unwrapWireResponse(payload)
      const envelope = parseWireEnvelope(response.envelope)
      if (
        isRecord(response.envelope) &&
        typeof response.envelope.operation === 'string' &&
        response.envelope.operation !== operation
      ) {
        throw new TypeError('Mismatched runtime response operation')
      }
      completionEvidence = true
      if (envelope.outcome === 'failure') {
        return failed(mapWireFailure(envelope.failure))
      }
      const value = deepFreeze(
        mapWireResult(operation, envelope.result, response.transfers),
      ) as Value
      this.publishMutationChange(operation, value)
      return ok(value)
    } catch (error) {
      const failure = mapTransportFailure(error, {
        operation,
        requestDispatched,
        completionEvidence,
      })
      if (failure.code === 'worker-lost') {
        this.recordWorkerLoss(failure.durableOutcome)
      }
      return failed(failure)
    }
  }

  private recordWorkerLoss(
    durableOutcome: Extract<
      ArchiveSession,
      { state: 'lost' }
    >['durableOutcome'],
  ): void {
    if (this.archiveState.state === 'closed') {
      // Product close completion already proved that the handle and root
      // ownership ended. Loss during the following transport teardown cannot
      // make that closed archive an unknown open session.
      return
    }
    if (
      this.runtimeState.state !== 'unavailable' ||
      this.runtimeState.reason !== 'worker-lost'
    ) {
      this.runtimeState = {
        state: 'unavailable',
        reason: 'worker-lost',
      }
      notify(this.statusListeners, this.runtimeState)
    }
    const currentOutcome =
      this.archiveState.state === 'lost'
        ? this.archiveState.durableOutcome
        : 'not-started'
    if (
      this.archiveState.state === 'lost' &&
      durableOutcomeRisk(currentOutcome) >= durableOutcomeRisk(durableOutcome)
    ) {
      return
    }
    this.setArchiveState({
      state: 'lost',
      durableOutcome,
    })
  }

  private publishMutationChange(operation: string, value: unknown): void {
    if (
      !mayMutateDurableState(operation) ||
      operation === 'store.open' ||
      operation === 'store.close' ||
      this.archiveState.state !== 'open' ||
      !isRecord(value) ||
      isNoChangeMutation(value)
    ) {
      return
    }
    notify(this.changeListeners, {
      storeId: this.archiveState.archive.storeId,
      invalidation: mapInvalidation(value.invalidation),
    })
  }

  /**
   * Lifecycle and package operations share one fail-fast admission boundary.
   * Concurrent intent is not queued because running it later could apply a
   * stale import after erase or reopen a definitively closed transport.
   * Cancellation remains out of band through `operations.requestCancel`.
   */
  private async runExclusiveArchiveOperation<Value>(
    operation: () => Promise<ClientResult<Value>>,
  ): Promise<ClientResult<Value>> {
    if (this.archiveOperationActive) {
      return failed(
        clientFailure({
          area: 'concurrency',
          code: 'busyRetryable',
          phase: 'lock',
          retryable: true,
          durableOutcome: 'not-started',
        }),
      )
    }
    this.archiveOperationActive = true
    try {
      return await operation()
    } finally {
      this.archiveOperationActive = false
    }
  }

  private finishOpen(result: ClientResult<OpenArchive>): void {
    if (this.archiveState.state === 'lost') {
      return
    }
    if (result.status === 'ok') {
      this.setArchiveState({ state: 'open', archive: result.value })
      return
    }
    if (result.failure.code === 'storeAlreadyOpen') {
      this.setArchiveState({ state: 'open-in-another-tab' })
      return
    }
    if (result.failure.code === 'archiveNotFound') {
      this.setArchiveState({ state: 'no-archive' })
      return
    }
    if (
      result.failure.code === 'corruptStore' ||
      result.failure.code === 'recoveryIncomplete'
    ) {
      this.setArchiveState({ state: 'needs-recovery' })
      return
    }
    if (
      result.failure.code === 'unsupportedSchema' ||
      result.failure.code === 'unsupportedLayout'
    ) {
      this.setArchiveState({ state: 'incompatible' })
      return
    }
    this.setArchiveState({ state: 'closed' })
  }

  private openRequest(disposition: 'create' | 'existing'): object {
    return {
      minimumContractVersion: this.options.runtime.productContract,
      maximumContractVersion: this.options.runtime.productContract,
      requiredCapabilities: this.options.requiredCapabilities ?? [],
      logicalRoot: 'lifearchive:archive-root:v1:primary',
      disposition,
    }
  }

  private setArchiveState(state: ArchiveSession): void {
    this.archiveState = state
    notify(this.sessionListeners, state)
  }
}

async function prepareRequest(
  operation: string,
  request: unknown,
): Promise<PreparedRequest> {
  if (operation === 'archive.export' && isRecord(request)) {
    const application = request.application
    if (
      !isRecord(application) ||
      typeof application.name !== 'string' ||
      typeof application.version !== 'string'
    ) {
      throw new TypeError('Archive export application facts are missing')
    }
    return {
      request: {
        operationId: request.operationId,
        contractVersion: '5',
        archiveId: request.archiveId,
        createdAtMs: request.createdAtMs,
        createdBy: {
          appName: application.name,
          appVersion: application.version,
        },
        archiveName: 'LifeArchive.lifearchive',
      },
      transfers: [],
    }
  }
  if (operation === 'media.import' && isRecord(request)) {
    const bytes = request.bytes
    if (!(bytes instanceof ArrayBuffer)) {
      throw new TypeError('Media import bytes are missing')
    }
    return {
      request: {
        attachmentId: request.newMediaId,
        entryId: request.parentEntryId,
        expectedRevision: request.expectedParentRevision,
        fileName: request.fileName,
        createdAtMs: request.createdAtMs,
        mimeTypeHint: request.mimeTypeHint,
        kindHint: request.kindHint,
        sourceTransferId: 'media-source',
      },
      transfers: [bytes],
    }
  }
  if (
    (operation === 'archive.verify' || operation === 'archive.apply') &&
    isRecord(request) &&
    request.archive instanceof File
  ) {
    const { archive, ...runtimeRequest } = request
    return {
      request: runtimeRequest,
      transfers: [],
      archive,
    }
  }
  return { request, transfers: [] }
}

/**
 * Mints identifier text in the canonical casing the runtime round-trips.
 * `crypto.randomUUID` returns lowercase, which the runtime rejects because it
 * does not match the value it would echo back.
 */
function newIdentifierText(): string {
  return crypto.randomUUID().toUpperCase()
}

function unwrapWireResponse(value: unknown): WireResponse {
  if (
    isRecord(value) &&
    'envelope' in value &&
    Array.isArray(value.transfers) &&
    value.transfers.every((transfer) => transfer instanceof ArrayBuffer)
  ) {
    return {
      envelope: value.envelope,
      transfers: value.transfers,
    }
  }
  return { envelope: value, transfers: [] }
}

function mapWireResult(
  operation: string,
  result: unknown,
  transfers: readonly ArrayBuffer[],
): unknown {
  if (operation === 'archive.overview' && isRecord(result)) {
    return mapArchiveOverview(result)
  }
  if (
    operation === 'media.resolveContent' &&
    isRecord(result) &&
    transfers.length === 1
  ) {
    return { ...result, bytes: new Uint8Array(transfers[0]) }
  }
  if (
    operation === 'archive.export' &&
    isRecord(result) &&
    transfers.length === 1
  ) {
    return mapArchiveExport(result, transfers[0])
  }
  if (operation === 'archive.apply' && isRecord(result)) {
    return mapImportResult(result)
  }
  return result
}

function mapArchiveOverview(result: Record<string, unknown>): ArchiveOverview {
  const storeId = requiredStableId(result.storeId, 'archive overview store ID')
  const entryCounts = requiredRecord(
    result.entryCounts,
    'archive overview entry counts',
  )
  const structuredCounts = requiredRecord(
    result.structuredCounts,
    'archive overview structured counts',
  )
  const trackCounts = requiredRecord(
    result.trackCounts,
    'archive overview track counts',
  )
  const health = requiredRecord(result.health, 'archive overview health')

  return {
    storeId,
    storeSchemaVersion: requiredIntegerText(
      result.schemaVersion,
      'archive overview schema version',
    ),
    storeContract: requiredIntegerText(
      result.storeContractVersion,
      'archive overview store contract',
    ),
    visibleEntryCount: requiredCount(
      result.visibleEntryCount,
      'archive overview visible entry count',
    ),
    entryCounts: {
      moment: requiredCount(entryCounts.moment, 'moment entry count'),
      day: requiredCount(entryCounts.day, 'day entry count'),
      week: requiredCount(entryCounts.week, 'week entry count'),
      month: requiredCount(entryCounts.month, 'month entry count'),
      year: requiredCount(entryCounts.year, 'year entry count'),
      custom: requiredCount(entryCounts.custom, 'custom entry count'),
    },
    structuredCounts: {
      events: requiredCount(structuredCounts.events, 'event count'),
      spans: requiredCount(structuredCounts.spans, 'span count'),
    },
    trackCounts: {
      active: requiredCount(trackCounts.active, 'active track count'),
      archived: requiredCount(trackCounts.archived, 'archived track count'),
      ongoingMembers: requiredCount(
        trackCounts.ongoingMembers,
        'ongoing track member count',
      ),
    },
    mediaCount: requiredCount(
      result.attachmentCount,
      'archive overview attachment count',
    ),
    mediaByteTotal: requiredCount(
      result.attachmentByteTotal,
      'archive overview attachment byte total',
    ),
    health: {
      readable: requiredBoolean(health.storeReadable, 'store readability'),
      schemaCompatible: requiredBoolean(
        health.schemaCompatible,
        'schema compatibility',
      ),
      recovery: requiredLiteral(
        health.recoveryState,
        'clean',
        'recovery state',
      ),
      integrity: mapDatabaseIntegrity(health.databaseIntegrity),
      referenceViolationCount: requiredCount(
        health.foreignKeyViolationCount,
        'reference violation count',
      ),
      overall: requiredLiteral(health.status, 'healthy', 'archive health'),
    },
    invalidation: mapInvalidation(result.token),
  }
}

function mapArchiveExport(
  result: Record<string, unknown>,
  transfer: ArrayBuffer,
): ArchiveExportResult {
  const transport = requiredRecord(
    result.browserTransport,
    'archive browser transport',
  )
  const counts = requiredRecord(result.counts, 'archive export counts')
  const fileName = requiredString(transport.fileName, 'archive export filename')
  const mimeType = requiredString(
    transport.mimeType,
    'archive export MIME type',
  )
  const range =
    result.dateRange === null || result.dateRange === undefined
      ? null
      : requiredRecord(result.dateRange, 'archive export date range')

  return {
    archive: new File([transfer], fileName, { type: mimeType }),
    archiveId: requiredStableId(result.archiveId, 'archive export ID'),
    createdAt: requiredString(result.createdAt, 'archive creation time'),
    counts: {
      entries: requiredCount(counts.entries, 'exported entry count'),
      media: requiredCount(counts.attachments, 'exported attachment count'),
      summaries: requiredCount(counts.summaries, 'exported summary count'),
    },
    dateRange: range
      ? {
          start: requiredString(range.start, 'archive date range start'),
          end: requiredString(range.end, 'archive date range end'),
        }
      : null,
    filesWritten: requiredCount(
      result.filesWritten,
      'archive files written count',
    ),
    checkedFiles: requiredCount(
      result.checkedFiles,
      'archive checked files count',
    ),
    checksumAlgorithm: requiredLiteral(
      result.checksumAlgorithm,
      'sha256',
      'archive checksum algorithm',
    ),
    invalidation: mapInvalidation(result.token),
  }
}

/**
 * Renames the runtime's application vocabulary into the client's. It chooses
 * nothing: every count, identifier, and identity outcome is the one the
 * runtime decided, only under the name feature code reads.
 */
function mapImportResult(result: Record<string, unknown>): ArchiveImportResult {
  return {
    importedEntries: count(result.importedEntries),
    importedMedia: count(result.importedAttachments),
    skippedEntries: count(result.skippedEntries),
    skippedMedia: count(result.skippedAttachments),
    skippedEntryIds: identifiers(result.skippedEntryIds),
    skippedMediaIds: identifiers(result.skippedAttachmentIds),
    issues: Array.isArray(result.issues)
      ? result.issues.filter(isRecord).map(mapImportIssue)
      : [],
    identity: mapImportIdentity(result),
    invalidation: mapInvalidation(result.token),
  }
}

function mapImportIssue(issue: Record<string, unknown>): ArchiveImportIssue {
  const kind = issue.recordKind
  return {
    code: typeof issue.code === 'string' ? issue.code : 'unknown',
    recordKind:
      kind === 'entry'
        ? 'entry'
        : kind === 'attachment'
          ? 'media'
          : kind === 'track'
            ? 'track'
            : null,
    id:
      typeof issue.id === 'string' && isStableId(issue.id)
        ? stableId(issue.id)
        : null,
  }
}

function mapImportIdentity(
  result: Record<string, unknown>,
): ArchiveImportIdentityOutcome {
  switch (result.identityOutcome) {
    case 'adopted':
      return { outcome: 'adopted' }
    case 'filled':
      return { outcome: 'filled', unchangedFields: [] }
    case 'conflicts':
      return {
        outcome: 'filled',
        unchangedFields: Array.isArray(result.identityConflicts)
          ? result.identityConflicts
              .filter(isRecord)
              .map((conflict) => conflict.field)
              .filter((field) => typeof field === 'string')
          : [],
      }
    default:
      return { outcome: 'preserved' }
  }
}

function mapInvalidation(value: unknown): InvalidationToken {
  if (
    !isRecord(value) ||
    typeof value.storeInstanceId !== 'string' ||
    typeof value.revision !== 'string' ||
    !isRevision(value.revision)
  ) {
    throw new TypeError('Malformed runtime invalidation token')
  }
  return {
    storeInstanceId: value.storeInstanceId,
    revision: revision(value.revision),
  }
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0
}

function requiredRecord(
  value: unknown,
  description: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return value
}

function requiredString(value: unknown, description: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`Malformed ${description}`)
  }
  return value
}

function requiredStableId(value: unknown, description: string): StableId {
  if (typeof value !== 'string' || !isStableId(value)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return stableId(value)
}

function requiredCount(value: unknown, description: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`Malformed ${description}`)
  }
  return value
}

function requiredIntegerText(value: unknown, description: string): string {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`Malformed ${description}`)
  }
  return String(value)
}

function requiredBoolean(value: unknown, description: string): boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`Malformed ${description}`)
  }
  return value
}

function mapDatabaseIntegrity(value: unknown): 'verified' {
  requiredLiteral(value, 'ok', 'database integrity')
  return 'verified'
}

function requiredLiteral<Value extends string>(
  value: unknown,
  expected: Value,
  description: string,
): Value {
  if (value !== expected) {
    throw new TypeError(`Malformed ${description}`)
  }
  return expected
}

function identifiers(value: unknown): readonly StableId[] {
  return Array.isArray(value)
    ? value
        .filter((entry) => typeof entry === 'string' && isStableId(entry))
        .map((entry) => stableId(entry))
    : []
}

function parseWireEnvelope(value: unknown): WireEnvelope {
  if (!isRecord(value)) {
    throw new TypeError('Malformed runtime response')
  }
  if (value.outcome === 'success' && 'result' in value) {
    return value as unknown as WireSuccess
  }
  if (value.outcome === 'failure' && isRecord(value.failure)) {
    return value as unknown as WireFailure
  }
  throw new TypeError('Malformed runtime response')
}

function mapWireFailure(failure: WireFailure['failure']): ClientFailure {
  const details = isRecord(failure.details) ? failure.details : {}
  return clientFailure({
    area: failureArea(details.area),
    code: typeof failure.code === 'string' ? failure.code : 'runtimeFailure',
    phase: failurePhase(details.phase),
    retryable: details.retryable === true,
    durableOutcome:
      details.durableOutcome === 'known' || details.durableOutcome === 'unknown'
        ? details.durableOutcome
        : 'not-started',
  })
}

function mapTransportFailure(
  error: unknown,
  context: {
    readonly operation: string
    readonly requestDispatched: boolean
    readonly completionEvidence: boolean
  } = {
    operation: '',
    requestDispatched: false,
    completionEvidence: false,
  },
): ClientFailure {
  if (error instanceof WorkerTransportError) {
    if (error.code === 'ArchiveAcquisitionCancelled') {
      return clientFailure({
        area: 'cancelled',
        code: 'cancelled',
        phase: 'cancellation',
        retryable: true,
        durableOutcome: 'not-started',
      })
    }
    return clientFailure({
      area: 'transport',
      code: error.code,
      phase: 'transport',
      retryable: false,
      durableOutcome: error.durableOutcome,
    })
  }
  return clientFailure({
    area: 'transport',
    code: 'invalidRuntimeResponse',
    phase: 'transport',
    retryable: false,
    durableOutcome: mayMutateDurableState(context.operation)
      ? context.completionEvidence
        ? 'known'
        : context.requestDispatched
          ? 'unknown'
          : 'not-started'
      : context.requestDispatched
        ? 'known'
        : 'not-started',
  })
}

function durableOutcomeRisk(
  outcome: Extract<ArchiveSession, { state: 'lost' }>['durableOutcome'],
): number {
  switch (outcome) {
    case 'unknown':
      return 2
    case 'known':
      return 1
    case 'not-started':
      return 0
  }
}

function isNoChangeMutation(value: Record<string, unknown>): boolean {
  return (
    value.outcome === 'absent-unchanged' ||
    value.outcome === 'conflict' ||
    value.outcome === 'unchanged'
  )
}

function failureArea(value: unknown): ClientFailure['area'] {
  const allowed: readonly ClientFailure['area'][] = [
    'request',
    'compatibility',
    'lifecycle',
    'storage',
    'concurrency',
    'record',
    'timeline',
    'media',
    'archive',
    'cancelled',
    'cleanup',
    'transport',
  ]
  return allowed.includes(value as ClientFailure['area'])
    ? (value as ClientFailure['area'])
    : 'transport'
}

function failurePhase(value: unknown): ClientFailure['phase'] {
  const allowed: readonly ClientFailure['phase'][] = [
    'negotiation',
    'rootValidation',
    'lock',
    'open',
    'recovery',
    'snapshot',
    'mutation',
    'cancellation',
    'close',
    'transport',
  ]
  return allowed.includes(value as ClientFailure['phase'])
    ? (value as ClientFailure['phase'])
    : 'transport'
}

function subscribe<Value>(
  listeners: Set<(value: Value) => void>,
  listener: (value: Value) => void,
): Unsubscribe {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify<Value>(
  listeners: ReadonlySet<(value: Value) => void>,
  value: Value,
): void {
  for (const listener of listeners) {
    listener(value)
  }
}

function deepFreeze<Value>(value: Value): Value {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value
  }
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return value
  }
  Object.freeze(value)
  for (const child of Object.values(value)) {
    deepFreeze(child)
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
