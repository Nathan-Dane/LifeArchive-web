export const WORKER_PROTOCOL_VERSION = 1 as const

export type WorkerGeneration = string
export type WorkerRequestId = string

export type MainToWorkerMessage =
  | {
      readonly type: 'start'
      readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION
      readonly generation: WorkerGeneration
    }
  | {
      readonly type: 'request'
      readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION
      readonly generation: WorkerGeneration
      readonly requestId: WorkerRequestId
      readonly operation: string
      readonly payload: unknown
    }
  | {
      readonly type: 'cancel'
      readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION
      readonly generation: WorkerGeneration
      readonly requestId: WorkerRequestId
    }
  | {
      readonly type: 'close'
      readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION
      readonly generation: WorkerGeneration
    }

export type WorkerToMainMessage =
  | {
      readonly type: 'ready'
      readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION
      readonly generation: WorkerGeneration
    }
  | {
      readonly type: 'response'
      readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION
      readonly generation: WorkerGeneration
      readonly requestId: WorkerRequestId
      readonly ok: true
      readonly payload: unknown
    }
  | {
      readonly type: 'response'
      readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION
      readonly generation: WorkerGeneration
      readonly requestId: WorkerRequestId
      readonly ok: false
      readonly error: WorkerResponseError
    }
  | {
      readonly type: 'closed'
      readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION
      readonly generation: WorkerGeneration
    }
  | {
      readonly type: 'fatal'
      readonly protocolVersion: typeof WORKER_PROTOCOL_VERSION
      readonly generation: WorkerGeneration
      readonly error: WorkerResponseError
    }

export interface WorkerResponseError {
  readonly code: string
  readonly diagnostic?: string
}

export function isWorkerToMainMessage(
  value: unknown,
): value is WorkerToMainMessage {
  if (!isRecord(value)) {
    return false
  }
  if (
    value.protocolVersion !== WORKER_PROTOCOL_VERSION ||
    typeof value.generation !== 'string'
  ) {
    return false
  }

  switch (value.type) {
    case 'ready':
    case 'closed':
      return true
    case 'response':
      return (
        typeof value.requestId === 'string' &&
        (value.ok === true ||
          (value.ok === false && isWorkerResponseError(value.error)))
      )
    case 'fatal':
      return isWorkerResponseError(value.error)
    default:
      return false
  }
}

export function isMainToWorkerMessage(
  value: unknown,
): value is MainToWorkerMessage {
  if (!isRecord(value)) {
    return false
  }
  if (
    value.protocolVersion !== WORKER_PROTOCOL_VERSION ||
    typeof value.generation !== 'string'
  ) {
    return false
  }

  switch (value.type) {
    case 'start':
    case 'close':
      return true
    case 'cancel':
      return typeof value.requestId === 'string'
    case 'request':
      return (
        typeof value.requestId === 'string' &&
        typeof value.operation === 'string' &&
        'payload' in value
      )
    default:
      return false
  }
}

function isWorkerResponseError(value: unknown): value is WorkerResponseError {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    (value.diagnostic === undefined || typeof value.diagnostic === 'string')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
