/**
 * Public executable design model for worker protocol v1.
 *
 * This models scheduling and ownership only. It does not load the runtime,
 * interpret product payloads, persist archive data, or select a browser lock
 * primitive.
 */

export const CANONICAL_ARCHIVE_ROOT_ID =
  'lifearchive:archive-root:v1:primary' as const
export const CANONICAL_ARCHIVE_LOCK_NAME =
  'lifearchive:archive-lock:v1:primary' as const

export type WorkerPhase =
  'starting' | 'ready' | 'opening' | 'open' | 'closing' | 'closed' | 'fatal'

export type WorkerRequestKind =
  'open' | 'close' | 'read' | 'mutation' | 'archive-export' | 'archive-apply'

export interface WorkerRequest {
  generation: string
  requestId: string
  kind: WorkerRequestKind
}

export type ProtocolEffect =
  | {
      type: 'acquire-lock'
      requestId: string
      lockName: typeof CANONICAL_ARCHIVE_LOCK_NAME
      rootId: typeof CANONICAL_ARCHIVE_ROOT_ID
      wait: false
    }
  | { type: 'start'; requestId: string; kind: WorkerRequestKind }
  | { type: 'signal-product-cancel'; requestId: string }
  | {
      type: 'outcome'
      requestId: string
      code:
        | 'success'
        | 'failure'
        | 'already-open'
        | 'cancelled-before-start'
        | 'closing'
        | 'worker-lost'
        | 'ownership-lost'
        | 'worker-unavailable'
      durableOutcome: 'known' | 'not-started' | 'unknown'
    }
  | {
      type: 'notice'
      code:
        | 'ready'
        | 'fatal'
        | 'duplicate-request-id'
        | 'late-reply'
        | 'late-cancellation'
        | 'stale-generation'
        | 'cancellation-deferred'
    }
  | { type: 'release-lock' }
  | { type: 'terminate' }

interface ActiveRequest extends WorkerRequest {
  stage: 'lock' | 'runtime'
}

export interface WorkerProtocolSnapshot {
  generation: string
  phase: WorkerPhase
  activeRequestId: string | null
  queuedRequestIds: readonly string[]
  ownsLock: boolean
}

export class WorkerProtocolModel {
  readonly generation: string

  private phase: WorkerPhase = 'starting'
  private active: ActiveRequest | null = null
  private queue: WorkerRequest[] = []
  private closeRequest: WorkerRequest | null = null
  private readonly seenRequestIds = new Set<string>()
  private ownsLock = false

  constructor(generation: string) {
    this.generation = generation
  }

  snapshot(): WorkerProtocolSnapshot {
    return {
      generation: this.generation,
      phase: this.phase,
      activeRequestId: this.active?.requestId ?? null,
      queuedRequestIds: this.queue.map(({ requestId }) => requestId),
      ownsLock: this.ownsLock,
    }
  }

  ready(generation: string): ProtocolEffect[] {
    if (!this.isCurrentGeneration(generation) || this.phase !== 'starting') {
      return [this.notice('stale-generation')]
    }
    this.phase = 'ready'
    return [this.notice('ready')]
  }

  fatal(generation: string): ProtocolEffect[] {
    if (!this.isCurrentGeneration(generation)) {
      return [this.notice('stale-generation')]
    }
    if (this.phase !== 'starting') {
      return [this.notice('late-reply')]
    }
    this.phase = 'fatal'
    return [this.notice('fatal'), { type: 'terminate' }]
  }

  submit(request: WorkerRequest): ProtocolEffect[] {
    if (!this.isCurrentGeneration(request.generation)) {
      return [this.notice('stale-generation')]
    }
    if (this.seenRequestIds.has(request.requestId)) {
      return [this.notice('duplicate-request-id')]
    }
    this.seenRequestIds.add(request.requestId)

    if (request.kind === 'close') {
      return this.requestClose(request)
    }

    const permitted =
      (request.kind === 'open' && this.phase === 'ready') ||
      (request.kind !== 'open' && this.phase === 'open')
    if (!permitted) {
      return [
        this.outcome(request.requestId, 'worker-unavailable', 'not-started'),
      ]
    }

    if (this.active) {
      this.queue.push(request)
      return []
    }
    return this.start(request)
  }

  lockAcquired(generation: string, requestId: string): ProtocolEffect[] {
    if (!this.isCurrentGeneration(generation)) {
      return [this.notice('stale-generation')]
    }
    if (
      this.active?.requestId !== requestId ||
      this.active.kind !== 'open' ||
      this.active.stage !== 'lock'
    ) {
      return [this.notice('late-reply')]
    }
    this.ownsLock = true
    this.active.stage = 'runtime'
    return [{ type: 'start', requestId, kind: 'open' }]
  }

  lockDenied(generation: string, requestId: string): ProtocolEffect[] {
    if (!this.isCurrentGeneration(generation)) {
      return [this.notice('stale-generation')]
    }
    if (
      this.active?.requestId !== requestId ||
      this.active.kind !== 'open' ||
      this.active.stage !== 'lock'
    ) {
      return [this.notice('late-reply')]
    }
    this.active = null
    this.phase = 'ready'
    return [this.outcome(requestId, 'already-open', 'not-started')]
  }

  finish(
    generation: string,
    requestId: string,
    code: 'success' | 'failure',
  ): ProtocolEffect[] {
    if (!this.isCurrentGeneration(generation)) {
      return [this.notice('stale-generation')]
    }
    if (
      this.active?.requestId !== requestId ||
      this.active.stage !== 'runtime'
    ) {
      return [this.notice('late-reply')]
    }

    const finished = this.active
    this.active = null
    const effects: ProtocolEffect[] = [this.outcome(requestId, code, 'known')]

    if (finished.kind === 'open') {
      if (code === 'success') {
        this.phase = 'open'
      } else {
        this.phase = 'ready'
        if (this.ownsLock) {
          this.ownsLock = false
          effects.push({ type: 'release-lock' })
        }
      }
      return effects
    }

    if (finished.kind === 'close') {
      if (code === 'success') {
        this.phase = 'closed'
        if (this.ownsLock) {
          this.ownsLock = false
          effects.push({ type: 'release-lock' })
        }
      } else {
        this.phase = 'fatal'
        this.ownsLock = false
      }
      effects.push({ type: 'terminate' })
      return effects
    }

    if (this.phase === 'closing' && this.closeRequest) {
      effects.push(...this.startClose())
    } else {
      effects.push(...this.startNext())
    }
    return effects
  }

  cancel(generation: string, requestId: string): ProtocolEffect[] {
    if (!this.isCurrentGeneration(generation)) {
      return [this.notice('stale-generation')]
    }

    const queuedIndex = this.queue.findIndex(
      (request) => request.requestId === requestId,
    )
    if (queuedIndex >= 0) {
      this.queue.splice(queuedIndex, 1)
      return [this.outcome(requestId, 'cancelled-before-start', 'not-started')]
    }

    if (this.active?.requestId === requestId) {
      if (
        this.active.stage === 'runtime' &&
        (this.active.kind === 'archive-export' ||
          this.active.kind === 'archive-apply')
      ) {
        return [{ type: 'signal-product-cancel', requestId }]
      }
      return [this.notice('cancellation-deferred')]
    }

    return [this.notice('late-cancellation')]
  }

  crash(generation: string): ProtocolEffect[] {
    return this.loseWorker(generation, 'worker-lost')
  }

  lockLost(generation: string): ProtocolEffect[] {
    return this.loseWorker(generation, 'ownership-lost')
  }

  private requestClose(request: WorkerRequest): ProtocolEffect[] {
    if (this.phase !== 'open') {
      return [
        this.outcome(request.requestId, 'worker-unavailable', 'not-started'),
      ]
    }

    this.phase = 'closing'
    this.closeRequest = request
    const effects = this.queue.map(({ requestId }) =>
      this.outcome(requestId, 'closing', 'not-started'),
    )
    this.queue = []
    if (!this.active) {
      effects.push(...this.startClose())
    }
    return effects
  }

  private startClose(): ProtocolEffect[] {
    if (!this.closeRequest) {
      return []
    }
    const request = this.closeRequest
    this.closeRequest = null
    this.active = { ...request, stage: 'runtime' }
    return [{ type: 'start', requestId: request.requestId, kind: 'close' }]
  }

  private startNext(): ProtocolEffect[] {
    const request = this.queue.shift()
    return request ? this.start(request) : []
  }

  private start(request: WorkerRequest): ProtocolEffect[] {
    if (request.kind === 'open') {
      this.phase = 'opening'
      this.active = { ...request, stage: 'lock' }
      return [
        {
          type: 'acquire-lock',
          requestId: request.requestId,
          lockName: CANONICAL_ARCHIVE_LOCK_NAME,
          rootId: CANONICAL_ARCHIVE_ROOT_ID,
          wait: false,
        },
      ]
    }

    this.active = { ...request, stage: 'runtime' }
    return [{ type: 'start', requestId: request.requestId, kind: request.kind }]
  }

  private loseWorker(
    generation: string,
    code: 'worker-lost' | 'ownership-lost',
  ): ProtocolEffect[] {
    if (!this.isCurrentGeneration(generation)) {
      return [this.notice('stale-generation')]
    }
    if (this.phase === 'closed' || this.phase === 'fatal') {
      return [{ type: 'terminate' }]
    }

    const effects: ProtocolEffect[] = []
    if (this.active) {
      effects.push(
        this.outcome(
          this.active.requestId,
          code,
          this.active.stage === 'runtime' ? 'unknown' : 'not-started',
        ),
      )
    }
    for (const { requestId } of this.queue) {
      effects.push(this.outcome(requestId, code, 'not-started'))
    }
    if (this.closeRequest) {
      effects.push(
        this.outcome(this.closeRequest.requestId, code, 'not-started'),
      )
    }
    this.active = null
    this.queue = []
    this.closeRequest = null
    this.ownsLock = false
    this.phase = 'fatal'
    effects.push({ type: 'terminate' })
    return effects
  }

  private isCurrentGeneration(generation: string): boolean {
    return generation === this.generation
  }

  private notice(
    code: Extract<ProtocolEffect, { type: 'notice' }>['code'],
  ): ProtocolEffect {
    return { type: 'notice', code }
  }

  private outcome(
    requestId: string,
    code: Extract<ProtocolEffect, { type: 'outcome' }>['code'],
    durableOutcome: Extract<
      ProtocolEffect,
      { type: 'outcome' }
    >['durableOutcome'],
  ): ProtocolEffect {
    return { type: 'outcome', requestId, code, durableOutcome }
  }
}
