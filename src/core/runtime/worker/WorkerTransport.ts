import {
  WORKER_PROTOCOL_VERSION,
  isWorkerToMainMessage,
  type MainToWorkerMessage,
  type WorkerResponseError,
  type WorkerToMainMessage,
} from './protocol'

export type TransportDurableOutcome = 'known' | 'not-started' | 'unknown'

export class WorkerTransportError extends Error {
  readonly code: string
  readonly durableOutcome: TransportDurableOutcome

  constructor(
    code: string,
    durableOutcome: TransportDurableOutcome,
    message = code,
  ) {
    super(message)
    this.name = 'WorkerTransportError'
    this.code = code
    this.durableOutcome = durableOutcome
  }
}

export interface WorkerRequestOptions {
  readonly requestId?: string
  readonly operation: string
  readonly payload: unknown
  readonly transfer?: readonly ArrayBuffer[]
  readonly signal?: AbortSignal
}

export interface WorkerTransportOptions {
  readonly createWorker: () => Worker
  readonly generation?: string
  readonly createRequestId?: () => string
}

interface PendingRequest {
  readonly requestId: string
  readonly operation: string
  readonly payload: unknown
  readonly transfer: readonly ArrayBuffer[]
  readonly signal?: AbortSignal
  readonly resolve: (payload: unknown) => void
  readonly reject: (error: WorkerTransportError) => void
  abortListener?: () => void
  cancellationSent: boolean
  admitted: boolean
}

type TransportState = 'starting' | 'ready' | 'closing' | 'closed' | 'fatal'

export class WorkerTransport {
  readonly generation: string

  private readonly worker: Worker
  private readonly createRequestId: () => string
  private readonly seenRequestIds = new Set<string>()
  private readonly queue: PendingRequest[] = []
  private active: PendingRequest | null = null
  private state: TransportState = 'starting'
  private nextRequestNumber = 0
  private startResolve!: () => void
  private startReject!: (error: WorkerTransportError) => void
  private readonly startPromise: Promise<void>
  private closePromise: Promise<void> | null = null
  private closeResolve: (() => void) | null = null
  private closeReject: ((error: WorkerTransportError) => void) | null = null
  private listenersAttached = false

  constructor(options: WorkerTransportOptions) {
    this.generation = options.generation ?? crypto.randomUUID()
    this.createRequestId =
      options.createRequestId ??
      (() => `${this.generation}:${++this.nextRequestNumber}`)
    this.startPromise = new Promise<void>((resolve, reject) => {
      this.startResolve = resolve
      this.startReject = reject
    })

    this.worker = options.createWorker()
    this.attachListeners()
    this.post({
      type: 'start',
      protocolVersion: WORKER_PROTOCOL_VERSION,
      generation: this.generation,
    })
  }

  start(): Promise<void> {
    return this.startPromise
  }

  async request(options: WorkerRequestOptions): Promise<unknown> {
    await this.start()

    if (this.state !== 'ready') {
      throw new WorkerTransportError(
        'transport-closed',
        'not-started',
        'The worker transport is not accepting requests',
      )
    }
    if (options.signal?.aborted) {
      throw new WorkerTransportError(
        'aborted',
        'not-started',
        'The request was aborted before admission',
      )
    }

    const requestId = options.requestId ?? this.createRequestId()
    if (this.seenRequestIds.has(requestId)) {
      throw new WorkerTransportError(
        'duplicate-request-id',
        'not-started',
        'A request identifier cannot be reused within one worker generation',
      )
    }
    this.seenRequestIds.add(requestId)

    const transfer = options.transfer ?? []
    validateTransferList(options.payload, transfer)

    return new Promise<unknown>((resolve, reject) => {
      const pending: PendingRequest = {
        requestId,
        operation: options.operation,
        payload: options.payload,
        transfer,
        signal: options.signal,
        resolve,
        reject,
        cancellationSent: false,
        admitted: false,
      }
      if (options.signal) {
        pending.abortListener = () => this.abort(pending)
        options.signal.addEventListener('abort', pending.abortListener, {
          once: true,
        })
      }
      this.queue.push(pending)
      this.admitNext()
    })
  }

  close(): Promise<void> {
    if (this.closePromise) {
      return this.closePromise
    }
    if (this.state === 'closed') {
      return Promise.resolve()
    }

    this.closePromise = new Promise<void>((resolve, reject) => {
      this.closeResolve = resolve
      this.closeReject = reject
    })
    void this.beginClose()
    return this.closePromise
  }

  private async beginClose(): Promise<void> {
    try {
      await this.start()
    } catch (error) {
      this.closeReject?.(asTransportError(error))
      return
    }

    if (this.state === 'closed') {
      this.closeResolve?.()
      return
    }
    if (this.state === 'fatal') {
      this.closeReject?.(
        new WorkerTransportError('worker-lost', 'unknown', 'Worker lost'),
      )
      return
    }

    this.state = 'closing'
    for (const pending of this.queue.splice(0)) {
      this.settleRejected(
        pending,
        new WorkerTransportError(
          'transport-closing',
          'not-started',
          'The request was refused by the close barrier',
        ),
      )
    }
    this.requestWorkerCloseWhenIdle()
  }

  private admitNext(): void {
    if (this.state !== 'ready' || this.active) {
      return
    }
    const pending = this.queue.shift()
    if (!pending) {
      return
    }
    if (pending.signal?.aborted) {
      this.settleRejected(
        pending,
        new WorkerTransportError('aborted', 'not-started'),
      )
      this.admitNext()
      return
    }

    pending.admitted = true
    this.active = pending
    this.post(
      {
        type: 'request',
        protocolVersion: WORKER_PROTOCOL_VERSION,
        generation: this.generation,
        requestId: pending.requestId,
        operation: pending.operation,
        payload: pending.payload,
      },
      pending.transfer,
    )
  }

  private abort(pending: PendingRequest): void {
    if (!pending.admitted) {
      const index = this.queue.indexOf(pending)
      if (index >= 0) {
        this.queue.splice(index, 1)
        this.settleRejected(
          pending,
          new WorkerTransportError('aborted', 'not-started'),
        )
      }
      return
    }
    if (this.active !== pending || pending.cancellationSent) {
      return
    }

    pending.cancellationSent = true
    this.post({
      type: 'cancel',
      protocolVersion: WORKER_PROTOCOL_VERSION,
      generation: this.generation,
      requestId: pending.requestId,
    })
  }

  private readonly handleMessage = (event: MessageEvent<unknown>): void => {
    if (!isWorkerToMainMessage(event.data)) {
      this.failWorker('invalid-worker-message')
      return
    }
    const message = event.data
    if (message.generation !== this.generation) {
      return
    }

    switch (message.type) {
      case 'ready':
        if (this.state !== 'starting') {
          return
        }
        this.state = 'ready'
        this.startResolve()
        return
      case 'response':
        this.handleResponse(message)
        return
      case 'closed':
        if (this.state !== 'closing' || this.active) {
          return
        }
        this.state = 'closed'
        this.cleanup()
        this.closeResolve?.()
        return
      case 'fatal':
        this.failWorker(message.error.code, message.error)
    }
  }

  private handleResponse(
    message: Extract<WorkerToMainMessage, { type: 'response' }>,
  ): void {
    const pending = this.active
    if (!pending || pending.requestId !== message.requestId) {
      return
    }

    this.active = null
    if (message.ok) {
      this.settleResolved(pending, message.payload)
    } else {
      this.settleRejected(
        pending,
        new WorkerTransportError(
          message.error.code,
          'known',
          message.error.diagnostic,
        ),
      )
    }
    if (this.state === 'closing') {
      this.requestWorkerCloseWhenIdle()
    } else {
      this.admitNext()
    }
  }

  private requestWorkerCloseWhenIdle(): void {
    if (this.active || this.state !== 'closing') {
      return
    }
    this.post({
      type: 'close',
      protocolVersion: WORKER_PROTOCOL_VERSION,
      generation: this.generation,
    })
  }

  private readonly handleWorkerLoss = (): void => {
    this.failWorker('worker-lost')
  }

  private failWorker(code: string, error?: WorkerResponseError): void {
    if (this.state === 'fatal' || this.state === 'closed') {
      return
    }
    const wasStarting = this.state === 'starting'
    this.state = 'fatal'
    const active = this.active
    this.active = null
    if (active) {
      this.settleRejected(
        active,
        new WorkerTransportError(
          code,
          'unknown',
          error?.diagnostic ?? 'The worker was lost during an active request',
        ),
      )
    }
    for (const pending of this.queue.splice(0)) {
      this.settleRejected(
        pending,
        new WorkerTransportError(code, 'not-started', error?.diagnostic),
      )
    }
    const loss = new WorkerTransportError(
      code,
      wasStarting ? 'not-started' : 'unknown',
      error?.diagnostic,
    )
    if (wasStarting) {
      this.startReject(loss)
    }
    this.closeReject?.(loss)
    this.cleanup()
  }

  private settleResolved(pending: PendingRequest, payload: unknown): void {
    this.removeAbortListener(pending)
    pending.resolve(payload)
  }

  private settleRejected(
    pending: PendingRequest,
    error: WorkerTransportError,
  ): void {
    this.removeAbortListener(pending)
    pending.reject(error)
  }

  private removeAbortListener(pending: PendingRequest): void {
    if (pending.signal && pending.abortListener) {
      pending.signal.removeEventListener('abort', pending.abortListener)
      pending.abortListener = undefined
    }
  }

  private post(
    message: MainToWorkerMessage,
    transfer: readonly ArrayBuffer[] = [],
  ): void {
    this.worker.postMessage(message, [...transfer])
  }

  private attachListeners(): void {
    this.worker.addEventListener('message', this.handleMessage)
    this.worker.addEventListener('error', this.handleWorkerLoss)
    this.worker.addEventListener('messageerror', this.handleWorkerLoss)
    this.listenersAttached = true
  }

  private cleanup(): void {
    if (this.listenersAttached) {
      this.worker.removeEventListener('message', this.handleMessage)
      this.worker.removeEventListener('error', this.handleWorkerLoss)
      this.worker.removeEventListener('messageerror', this.handleWorkerLoss)
      this.listenersAttached = false
    }
    this.worker.terminate()
  }
}

function validateTransferList(
  payload: unknown,
  transfer: readonly ArrayBuffer[],
): void {
  const payloadBuffers = collectArrayBuffers(payload)
  const uniqueTransfer = new Set(transfer)
  if (
    uniqueTransfer.size !== transfer.length ||
    payloadBuffers.size !== uniqueTransfer.size ||
    [...payloadBuffers].some((buffer) => !uniqueTransfer.has(buffer))
  ) {
    throw new WorkerTransportError(
      'invalid-transfer-list',
      'not-started',
      'The transfer list must contain each payload ArrayBuffer exactly once',
    )
  }
}

function collectArrayBuffers(value: unknown): Set<ArrayBuffer> {
  const buffers = new Set<ArrayBuffer>()
  const visited = new WeakSet<object>()

  function visit(current: unknown): void {
    if (current instanceof ArrayBuffer) {
      buffers.add(current)
      return
    }
    if (ArrayBuffer.isView(current)) {
      if (current.buffer instanceof ArrayBuffer) {
        buffers.add(current.buffer)
      }
      return
    }
    if (
      typeof current !== 'object' ||
      current === null ||
      visited.has(current)
    ) {
      return
    }
    visited.add(current)
    for (const child of Object.values(current)) {
      visit(child)
    }
  }

  visit(value)
  return buffers
}

function asTransportError(error: unknown): WorkerTransportError {
  return error instanceof WorkerTransportError
    ? error
    : new WorkerTransportError('worker-lost', 'unknown')
}
