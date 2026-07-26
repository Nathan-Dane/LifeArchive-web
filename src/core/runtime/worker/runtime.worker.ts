import {
  WORKER_PROTOCOL_VERSION,
  isMainToWorkerMessage,
  type WorkerResponseError,
  type WorkerToMainMessage,
} from './protocol'

export interface RuntimeWorkerResult {
  readonly payload: unknown
  readonly transfer?: readonly ArrayBuffer[]
}

export interface RuntimeWorkerExecutor {
  start(): Promise<void>
  execute(
    operation: string,
    payload: unknown,
    signal: AbortSignal,
  ): Promise<RuntimeWorkerResult>
  close(): Promise<void>
}

interface RuntimeWorkerScope {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<unknown>) => void,
  ): void
  postMessage(message: WorkerToMainMessage, transfer?: Transferable[]): void
  close(): void
}

export function installRuntimeWorker(
  scope: RuntimeWorkerScope,
  executor: RuntimeWorkerExecutor,
): void {
  let generation: string | null = null
  let active: {
    readonly requestId: string
    readonly controller: AbortController
  } | null = null
  let closing = false
  const seenRequestIds = new Set<string>()

  const post = (
    message: WorkerToMainMessage,
    transfer: readonly ArrayBuffer[] = [],
  ) => scope.postMessage(message, [...transfer])

  const fatal = (activeGeneration: string, error: unknown) => {
    post({
      type: 'fatal',
      protocolVersion: WORKER_PROTOCOL_VERSION,
      generation: activeGeneration,
      error: responseError(error),
    })
  }

  scope.addEventListener('message', (event) => {
    if (!isMainToWorkerMessage(event.data)) {
      if (generation) {
        fatal(generation, new Error('invalid-main-message'))
      }
      return
    }
    const message = event.data

    if (message.type === 'start') {
      if (generation !== null) {
        return
      }
      generation = message.generation
      void executor
        .start()
        .then(() => {
          post({
            type: 'ready',
            protocolVersion: WORKER_PROTOCOL_VERSION,
            generation: message.generation,
          })
        })
        .catch((error: unknown) => fatal(message.generation, error))
      return
    }
    if (message.generation !== generation || closing) {
      return
    }

    if (message.type === 'cancel') {
      if (active?.requestId === message.requestId) {
        active.controller.abort()
      }
      return
    }
    if (message.type === 'close') {
      if (active) {
        fatal(message.generation, new Error('close-while-busy'))
        return
      }
      closing = true
      void executor
        .close()
        .then(() => {
          post({
            type: 'closed',
            protocolVersion: WORKER_PROTOCOL_VERSION,
            generation: message.generation,
          })
          scope.close()
        })
        .catch((error: unknown) => fatal(message.generation, error))
      return
    }
    if (active || seenRequestIds.has(message.requestId)) {
      fatal(message.generation, new Error('invalid-request-admission'))
      return
    }

    seenRequestIds.add(message.requestId)
    const controller = new AbortController()
    active = { requestId: message.requestId, controller }
    void executor
      .execute(message.operation, message.payload, controller.signal)
      .then((result) => {
        post(
          {
            type: 'response',
            protocolVersion: WORKER_PROTOCOL_VERSION,
            generation: message.generation,
            requestId: message.requestId,
            ok: true,
            payload: result.payload,
          },
          result.transfer,
        )
      })
      .catch((error: unknown) => {
        post({
          type: 'response',
          protocolVersion: WORKER_PROTOCOL_VERSION,
          generation: message.generation,
          requestId: message.requestId,
          ok: false,
          error: responseError(error),
        })
      })
      .finally(() => {
        active = null
      })
  })
}

function responseError(error: unknown): WorkerResponseError {
  if (error instanceof Error) {
    return { code: error.name, diagnostic: error.message }
  }
  return { code: 'worker-failure' }
}

const scope = self as unknown as RuntimeWorkerScope

installRuntimeWorker(scope, {
  start: () => Promise.reject(new Error('runtime-loader-not-installed')),
  execute: () => Promise.reject(new Error('runtime-loader-not-installed')),
  close: () => Promise.resolve(),
})
