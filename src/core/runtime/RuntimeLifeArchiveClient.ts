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
  ArchiveEraseRequest,
  ArchiveExportRequest,
  ArchiveIdentity,
  ArchiveImportRequest,
  ArchiveVerifyRequest,
  CalendarContext,
  CancellationRequestResult,
  MediaContentRequest,
  MediaDeleteRequest,
  MediaImportRequest,
  MediaListRequest,
  OrdinaryDeleteRequest,
  OrdinarySaveRequest,
  StableId,
  StorageFacts,
  StructuredConvertRequest,
  StructuredCreateRequest,
  StructuredDeleteRequest,
  StructuredListRequest,
  StructuredLoadRequest,
  StructuredSaveRequest,
  TimeWindow,
  TimelineFocusRequest,
  TimelineIndexRequest,
  TimelineStructuredDetailRequest,
  TimelineStructuredListRequest,
  TrackCreateRequest,
  TrackDeleteRequest,
  TrackDetachRequest,
  TrackHistoryRequest,
  TrackListRequest,
  TrackMemberCreateRequest,
  TrackMembershipRequest,
  TrackSaveRequest,
  TrackWithFirstMemberRequest,
} from '../client'
import {
  WorkerTransportError,
  type WorkerTransport,
} from './worker/WorkerTransport'
import { mayMutateDurableState } from './worker/durableOperations'
import {
  mapInvalidation,
  runtimeBoundary,
  type RuntimeBoundary,
} from './runtimeBoundary'

interface WireSuccess {
  readonly outcome: 'success'
  readonly result: unknown
}

interface WireFailure {
  readonly outcome: 'failure'
  readonly failure: {
    readonly category?: unknown
    readonly code?: unknown
    readonly details?: unknown
    readonly currentState?: unknown
  }
}

type WireEnvelope = WireSuccess | WireFailure

interface WireResponse {
  readonly envelope: unknown
  readonly transfers: readonly ArrayBuffer[]
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
    storage: () =>
      Promise.resolve(
        ok<StorageFacts>({
          backend: this.options.runtime.backend,
          durability: this.options.runtime.durability,
          archiveOpen: this.archiveState.state === 'open',
          grant: 'unknown',
          estimate: null,
        }),
      ),
  }

  readonly archive: LifeArchiveClient['archive'] = {
    session: () => this.archiveState,
    observeSession: (listener) => subscribe(this.sessionListeners, listener),
    create: () =>
      this.runExclusiveArchiveOperation(async () => {
        this.setArchiveState({ state: 'opening' })
        const result = await this.invoke(
          runtimeBoundary.storeOpen,
          this.openRequest('create'),
        )
        this.finishOpen(result)
        return result
      }),
    open: () =>
      this.runExclusiveArchiveOperation(async () => {
        this.setArchiveState({ state: 'opening' })
        const result = await this.invoke(
          runtimeBoundary.storeOpen,
          this.openRequest('existing'),
        )
        this.finishOpen(result)
        return result
      }),
    close: () =>
      this.runExclusiveArchiveOperation(async () => {
        const previousState = this.archiveState
        this.setArchiveState({ state: 'closing' })
        const result = await this.invoke(runtimeBoundary.storeClose, null)
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
    overview: () => this.invoke(runtimeBoundary.archiveOverview, {}),
    verify: (request: ArchiveVerifyRequest) =>
      this.runExclusiveArchiveOperation(() =>
        this.invoke(runtimeBoundary.archiveVerify, request),
      ),
    import: (request: ArchiveImportRequest) =>
      this.runExclusiveArchiveOperation(async () => {
        const controller = new AbortController()
        this.cancellableOperations.set(request.operationId, controller)
        try {
          if (this.archiveState.state !== 'open') {
            return failed(
              clientFailure({
                area: 'lifecycle',
                code: 'closed',
                phase: 'mutation',
                retryable: false,
                durableOutcome: 'not-started',
              }),
            )
          }
          return await this.invoke(
            runtimeBoundary.archiveImport,
            {
              input: request,
              previousInvalidation: this.archiveState.archive.invalidation,
            },
            controller.signal,
          )
        } finally {
          this.cancellableOperations.delete(request.operationId)
        }
      }),
    export: (request: ArchiveExportRequest) =>
      this.runExclusiveArchiveOperation(async () => {
        if (this.archiveState.state !== 'open') {
          return failed(
            clientFailure({
              area: 'lifecycle',
              code: 'closed',
              phase: 'snapshot',
              retryable: false,
              durableOutcome: 'not-started',
            }),
          )
        }
        if (request.sourceStoreId !== this.archiveState.archive.storeId) {
          return failed(
            clientFailure({
              area: 'archive',
              code: 'invalidIdentifier',
              phase: 'snapshot',
              retryable: false,
              field: 'sourceStoreId',
              durableOutcome: 'not-started',
            }),
          )
        }
        const controller = new AbortController()
        this.cancellableOperations.set(request.operationId, controller)
        try {
          if (
            this.archiveState.state !== 'open' ||
            this.archiveState.archive.storeId !== request.sourceStoreId
          ) {
            return failed(
              clientFailure({
                area: 'request',
                code: 'invalidRequest',
                phase: 'snapshot',
                retryable: false,
                field: 'sourceStoreId',
                durableOutcome: 'not-started',
              }),
            )
          }
          return await this.invoke(
            runtimeBoundary.archiveExport,
            request,
            controller.signal,
          )
        } finally {
          this.cancellableOperations.delete(request.operationId)
        }
      }),
    erase: (request: ArchiveEraseRequest) =>
      this.runExclusiveArchiveOperation(() =>
        this.invoke(runtimeBoundary.archiveErase, request),
      ),
  }

  readonly identity: LifeArchiveClient['identity'] = {
    load: () => this.invoke(runtimeBoundary.identityLoad, null),
    save: (identity: ArchiveIdentity) =>
      this.invoke(runtimeBoundary.identitySave, identity),
  }

  readonly time: LifeArchiveClient['time'] = {
    window: () => unsupportedClientCapability<TimeWindow>(),
    step: () => unsupportedClientCapability<TimeWindow>(),
    calendarContext: () => unsupportedClientCapability<CalendarContext>(),
  }

  readonly record: LifeArchiveClient['record'] = {
    load: (window: TimeWindow) =>
      this.invoke(runtimeBoundary.recordLoad, window),
    save: (request: OrdinarySaveRequest) =>
      this.invoke(runtimeBoundary.recordSave, request),
    delete: (request: OrdinaryDeleteRequest) =>
      this.invoke(runtimeBoundary.recordDelete, request),
    listObjects: (request: StructuredListRequest) =>
      this.invoke(runtimeBoundary.recordListObjects, request),
  }

  readonly structured: LifeArchiveClient['structured'] = {
    load: (request: StructuredLoadRequest) =>
      this.invoke(runtimeBoundary.structuredLoad, request),
    create: (request: StructuredCreateRequest) =>
      this.invoke(runtimeBoundary.structuredCreate, request),
    save: (request: StructuredSaveRequest) =>
      this.invoke(runtimeBoundary.structuredSave, request),
    delete: (request: StructuredDeleteRequest) =>
      this.invoke(runtimeBoundary.structuredDelete, request),
    convertSpanToEvent: (request: StructuredConvertRequest) =>
      this.invoke(runtimeBoundary.structuredConvert, request),
  }

  readonly tracks: LifeArchiveClient['tracks'] = {
    list: (request: TrackListRequest) =>
      this.invoke(runtimeBoundary.trackList, request),
    load: (id: StableId) => this.invoke(runtimeBoundary.trackLoad, id),
    create: (request: TrackCreateRequest) =>
      this.invoke(runtimeBoundary.trackCreate, request),
    save: (request: TrackSaveRequest) =>
      this.invoke(runtimeBoundary.trackSave, request),
    delete: (request: TrackDeleteRequest) =>
      this.invoke(runtimeBoundary.trackDelete, request),
    createWithFirstMember: (request: TrackWithFirstMemberRequest) =>
      this.invoke(runtimeBoundary.trackCreateWithFirstMember, request),
    history: (request: TrackHistoryRequest) =>
      this.invoke(runtimeBoundary.trackHistory, request),
    attachMember: (request: TrackMembershipRequest) =>
      this.invoke(runtimeBoundary.trackAttachMember, request),
    detachMember: (request: TrackDetachRequest) =>
      this.invoke(runtimeBoundary.trackDetachMember, request),
    createMember: (request: TrackMemberCreateRequest) =>
      this.invoke(runtimeBoundary.trackCreateMember, request),
  }

  readonly timeline: LifeArchiveClient['timeline'] = {
    index: (request: TimelineIndexRequest) =>
      this.invoke(runtimeBoundary.timelineIndex, request),
    focus: (request: TimelineFocusRequest) =>
      this.invoke(runtimeBoundary.timelineFocus, request),
    structuredDetail: (request: TimelineStructuredDetailRequest) =>
      this.invoke(runtimeBoundary.timelineStructuredDetail, request),
    structuredList: (request: TimelineStructuredListRequest) =>
      this.invoke(runtimeBoundary.timelineStructuredList, request),
  }

  readonly media: LifeArchiveClient['media'] = {
    list: (request: MediaListRequest) =>
      this.invoke(runtimeBoundary.mediaList, request),
    content: (request: MediaContentRequest) =>
      this.invoke(runtimeBoundary.mediaContent, request),
    import: (request: MediaImportRequest) =>
      this.invoke(runtimeBoundary.mediaImport, request),
    delete: (request: MediaDeleteRequest) =>
      this.invoke(runtimeBoundary.mediaDelete, request),
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

  private async invoke<Request, Value>(
    boundary: RuntimeBoundary<Request, Value>,
    request: Request,
    signal?: AbortSignal,
  ): Promise<ClientResult<Value>> {
    const operation = boundary.operation
    let requestDispatched = false
    let completionEvidence = false
    try {
      const prepared = boundary.prepare(request)
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
        const conflict =
          boundary.mapFailure?.(envelope.failure, request) ?? null
        if (conflict !== null) {
          const value = deepFreeze(conflict)
          return ok(value)
        }
        return failed(mapWireFailure(operation, envelope.failure))
      }
      const value = deepFreeze(
        boundary.map(envelope.result, response.transfers, request),
      )
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
      isNoChangeMutation(value) ||
      value.changed === false
    ) {
      return
    }
    const invalidation = mapInvalidation(value.invalidation)
    const archive = this.archiveState.archive
    this.archiveState = {
      state: 'open',
      archive: { ...archive, invalidation },
    }
    notify(this.changeListeners, {
      storeId: archive.storeId,
      invalidation,
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

function unsupportedClientCapability<Value>(): Promise<ClientResult<Value>> {
  return Promise.resolve(
    failed(
      clientFailure({
        area: 'compatibility',
        code: 'unsupportedCapability',
        phase: 'negotiation',
        retryable: false,
        durableOutcome: 'not-started',
      }),
    ),
  )
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

function parseWireEnvelope(value: unknown): WireEnvelope {
  if (!isRecord(value)) {
    throw new TypeError('Malformed runtime response')
  }
  if (value.outcome === 'success' && 'result' in value) {
    return { outcome: 'success', result: value.result }
  }
  if (value.outcome === 'failure' && isRecord(value.failure)) {
    return {
      outcome: 'failure',
      failure: {
        category: value.failure.category,
        code: value.failure.code,
        details: value.failure.details,
        currentState: value.failure.currentState,
      },
    }
  }
  throw new TypeError('Malformed runtime response')
}

function mapWireFailure(
  operation: string,
  failure: WireFailure['failure'],
): ClientFailure {
  const details = isRecord(failure.details) ? failure.details : {}
  if (typeof failure.code !== 'string') {
    throw new TypeError('Malformed runtime failure code')
  }
  return clientFailure({
    area: failureArea(details.area, operation, failure.category),
    code: failure.code,
    phase: failurePhase(details.phase),
    retryable: details.retryable === true,
    field: optionalString(details.field, 'runtime failure field'),
    subject: failureSubject(details),
    expectedRevision: optionalRevision(
      details.expectedRevision,
      'runtime expected revision',
    ),
    actualRevision: optionalRevision(
      details.actualRevision,
      'runtime actual revision',
    ),
    cleanup: cleanupState(details.cleanupState),
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

function failureArea(
  value: unknown,
  operation: string,
  category: unknown,
): ClientFailure['area'] {
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
  const direct = allowed.find((area) => area === value)
  if (direct) {
    return direct
  }
  if (operation.startsWith('record.') || operation.startsWith('structured.')) {
    return 'record'
  }
  if (operation.startsWith('track.')) {
    return 'record'
  }
  if (operation.startsWith('timeline.')) {
    return 'timeline'
  }
  if (operation.startsWith('media.')) {
    return 'media'
  }
  if (operation.startsWith('archive.')) {
    return 'archive'
  }
  if (operation.startsWith('store.')) {
    return 'storage'
  }
  if (category === 'cancelled') {
    return 'cancelled'
  }
  return 'transport'
}

function failurePhase(value: unknown): ClientFailure['phase'] {
  const allowed: readonly ClientFailure['phase'][] = [
    'negotiation',
    'rootValidation',
    'lock',
    'open',
    'validation',
    'archiveStructureAndVersion',
    'checksumScopeAndBytes',
    'recordsAndReferences',
    'attachmentMedia',
    'destinationPlanning',
    'mediaStagingAndJournal',
    'finalCancellationCheckpoint',
    'commit',
    'compensation',
    'recovery',
    'snapshot',
    'media',
    'encoding',
    'verification',
    'publication',
    'cleanup',
    'mutation',
    'cancellation',
    'close',
    'transport',
  ]
  return allowed.find((phase) => phase === value) ?? 'transport'
}

function failureSubject(
  details: Record<string, unknown>,
): ClientFailure['subject'] {
  if (details.entityKind === undefined && details.id === undefined) {
    return null
  }
  const kind = (() => {
    switch (details.entityKind) {
      case 'archive':
        return 'archive'
      case 'entry':
        return 'entry'
      case 'structuredObject':
      case 'object':
        return 'object'
      case 'track':
        return 'track'
      case 'member':
        return 'member'
      case 'attachment':
      case 'media':
        return 'media'
      default:
        throw new TypeError('Malformed runtime failure subject kind')
    }
  })()
  return {
    kind,
    id:
      details.id === null || details.id === undefined
        ? null
        : requiredFailureStableId(details.id),
  }
}

function requiredFailureStableId(value: unknown) {
  if (typeof value !== 'string' || !isStableId(value)) {
    throw new TypeError('Malformed runtime failure subject identifier')
  }
  return stableId(value)
}

function optionalRevision(
  value: unknown,
  description: string,
): ReturnType<typeof revision> | null {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value !== 'string' || !isRevision(value)) {
    throw new TypeError(`Malformed ${description}`)
  }
  return revision(value)
}

function optionalString(value: unknown, description: string): string | null {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value !== 'string') {
    throw new TypeError(`Malformed ${description}`)
  }
  return value
}

function cleanupState(value: unknown): ClientFailure['cleanup'] {
  if (value === null || value === undefined) {
    return null
  }
  switch (value) {
    case 'complete':
      return 'complete'
    case 'incomplete':
      return 'incomplete'
    case 'ownedStagingMayRemain':
      return 'temporary-output-may-remain'
    case 'verifiedDestinationMayRemain':
      return 'verified-output-may-remain'
    case 'ownedStagingAndVerifiedDestinationMayRemain':
      return 'temporary-and-verified-output-may-remain'
    default:
      throw new TypeError('Malformed runtime cleanup state')
  }
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
