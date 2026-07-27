import {
  WORKER_PROTOCOL_VERSION,
  isMainToWorkerMessage,
  type RuntimeWorkerStartup,
  type WorkerResponseError,
  type WorkerToMainMessage,
} from './protocol'
import { RootOwnership } from './RootOwnership'

export interface RuntimeWorkerResult {
  readonly payload: unknown
  readonly transfer?: readonly ArrayBuffer[]
}

export interface RuntimeWorkerExecutor {
  start(runtime?: RuntimeWorkerStartup): Promise<void>
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
        .start(message.runtime)
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

interface EmscriptenRuntimeModule {
  readonly HEAPU8: Uint8Array
  readonly HEAPU32: Uint32Array
  UTF8ToString(pointer: number): string
  stringToUTF8OnStack(value: string): number
  stackAlloc(byteLength: number): number
  stackSave(): number
  stackRestore(pointer: number): void
  _lifearchive_browser_v1_describe(input: number): number
  _lifearchive_browser_v1_open(
    input: number,
    transferPointers: number,
    transferLengths: number,
    transferCount: number,
    outHandle: number,
  ): Promise<number>
  _lifearchive_browser_v1_execute(
    handle: number,
    input: number,
    transferPointers: number,
    transferLengths: number,
    transferCount: number,
  ): Promise<number>
  _lifearchive_browser_v1_cancel(handle: number, input: number): number
  _lifearchive_browser_v1_close(handle: number, input: number): Promise<number>
  _lifearchive_browser_v1_invocation_json(invocation: number): number
  _lifearchive_browser_v1_invocation_transfer_count(invocation: number): number
  _lifearchive_browser_v1_invocation_transfer_data(
    invocation: number,
    index: number,
  ): number
  _lifearchive_browser_v1_invocation_transfer_length(
    invocation: number,
    index: number,
  ): number
  _lifearchive_browser_v1_invocation_free(invocation: number): void
  _lifearchive_browser_v1_handle_free(handle: number): Promise<void>
}

type RuntimeFactory = (options: {
  readonly locateFile: (path: string) => string
  readonly noInitialRun: true
}) => Promise<EmscriptenRuntimeModule>

class WorkerRuntimeExecutor implements RuntimeWorkerExecutor {
  private module: EmscriptenRuntimeModule | null = null
  private handle = 0
  private readonly ownership = new RootOwnership()
  private runtime: RuntimeWorkerStartup | null = null

  async start(runtime?: RuntimeWorkerStartup): Promise<void> {
    if (!runtime) {
      throw new Error('runtime-location-missing')
    }
    this.runtime = runtime
    const imported = (await import(/* @vite-ignore */ runtime.loaderUrl)) as {
      readonly default?: RuntimeFactory
    }
    if (typeof imported.default !== 'function') {
      throw new Error('runtime-loader-invalid')
    }
    this.module = await imported.default({
      noInitialRun: true,
      locateFile: (path) => (path.endsWith('.wasm') ? runtime.wasmUrl : path),
    })
  }

  async execute(
    operation: string,
    payload: unknown,
    signal: AbortSignal,
  ): Promise<RuntimeWorkerResult> {
    const module = this.requiredModule()
    const runtime = this.requiredRuntime()
    const requestId = crypto.randomUUID()
    const prepared = await prepareWorkerRequest(payload)
    const envelope = {
      abiVersion: runtime.bindingsAbi,
      requestId,
      productContractVersion: runtime.productContract,
      operation,
      request: prepared.request,
      transfers: prepared.descriptors,
    }
    const cancel = () => {
      if (!this.handle) return
      void this.callInvocation(
        module,
        (input) => module._lifearchive_browser_v1_cancel(this.handle, input),
        {
          ...envelope,
          operation: 'operation.cancel',
          request: { requestId },
        },
        prepared.transfers,
      )
    }
    signal.addEventListener('abort', cancel, { once: true })
    try {
      if (operation === 'product.describe') {
        return this.callInvocation(
          module,
          (input) => module._lifearchive_browser_v1_describe(input),
          envelope,
          prepared.transfers,
        )
      }
      if (operation === 'store.open') {
        if (this.handle) throw new Error('runtime-handle-already-open')
        if (!(await this.ownership.acquire())) {
          return {
            payload: {
              envelope: {
                abiVersion: runtime.bindingsAbi,
                requestId,
                operation,
                outcome: 'failure',
                failure: {
                  category: 'unavailable',
                  code: 'storeAlreadyOpen',
                  details: {
                    area: 'concurrency',
                    phase: 'lock',
                    retryable: true,
                    durableOutcome: 'not-started',
                  },
                },
                transfers: [],
              },
              transfers: [],
            },
          }
        }
        try {
          const result = await this.callInvocation(
            module,
            async (input, pointers, lengths, count) => {
              const outHandle = module.stackAlloc(4)
              module.HEAPU32[outHandle >>> 2] = 0
              const invocation = await module._lifearchive_browser_v1_open(
                input,
                pointers,
                lengths,
                count,
                outHandle,
              )
              this.handle = module.HEAPU32[outHandle >>> 2]
              return invocation
            },
            envelope,
            prepared.transfers,
          )
          if (!this.handle) await this.ownership.release()
          return result
        } catch (error) {
          await this.ownership.release()
          throw error
        }
      }
      if (!this.handle) throw new Error('runtime-handle-closed')
      if (operation === 'store.close') {
        const result = await this.callInvocation(
          module,
          (input) => module._lifearchive_browser_v1_close(this.handle, input),
          envelope,
          prepared.transfers,
        )
        await module._lifearchive_browser_v1_handle_free(this.handle)
        this.handle = 0
        await this.ownership.release()
        return result
      }
      if (operation === 'operation.cancel') {
        return this.callInvocation(
          module,
          (input) => module._lifearchive_browser_v1_cancel(this.handle, input),
          envelope,
        )
      }
      return this.callInvocation(
        module,
        (input, pointers, lengths, count) =>
          module._lifearchive_browser_v1_execute(
            this.handle,
            input,
            pointers,
            lengths,
            count,
          ),
        envelope,
        prepared.transfers,
      )
    } finally {
      signal.removeEventListener('abort', cancel)
    }
  }

  async close(): Promise<void> {
    const module = this.module
    if (module && this.handle) {
      await module._lifearchive_browser_v1_handle_free(this.handle)
      this.handle = 0
    }
    await this.ownership.release()
    this.module = null
    this.runtime = null
  }

  private requiredModule(): EmscriptenRuntimeModule {
    if (!this.module) throw new Error('runtime-not-started')
    return this.module
  }

  private requiredRuntime(): RuntimeWorkerStartup {
    if (!this.runtime) throw new Error('runtime-not-started')
    return this.runtime
  }

  private async callInvocation(
    module: EmscriptenRuntimeModule,
    call: (
      input: number,
      transferPointers: number,
      transferLengths: number,
      transferCount: number,
    ) => number | Promise<number>,
    envelope: object,
    transfers: readonly ArrayBuffer[] = [],
  ): Promise<RuntimeWorkerResult> {
    const stack = module.stackSave()
    try {
      const input = module.stringToUTF8OnStack(JSON.stringify(envelope))
      const transferPointers = transfers.length
        ? module.stackAlloc(transfers.length * 4)
        : 0
      const transferLengths = transfers.length
        ? module.stackAlloc(transfers.length * 4)
        : 0
      for (const [index, transfer] of transfers.entries()) {
        const bytes = new Uint8Array(transfer)
        const pointer = module.stackAlloc(bytes.byteLength || 1)
        module.HEAPU8.set(bytes, pointer)
        module.HEAPU32[(transferPointers >>> 2) + index] = pointer
        module.HEAPU32[(transferLengths >>> 2) + index] = bytes.byteLength
      }
      const invocation = await call(
        input,
        transferPointers,
        transferLengths,
        transfers.length,
      )
      if (!invocation) throw new Error('runtime-null-invocation')
      try {
        const json = module.UTF8ToString(
          module._lifearchive_browser_v1_invocation_json(invocation),
        )
        const payload = JSON.parse(json) as unknown
        const count =
          module._lifearchive_browser_v1_invocation_transfer_count(invocation)
        const transfer: ArrayBuffer[] = []
        for (let index = 0; index < count; index += 1) {
          const pointer =
            module._lifearchive_browser_v1_invocation_transfer_data(
              invocation,
              index,
            )
          const length =
            module._lifearchive_browser_v1_invocation_transfer_length(
              invocation,
              index,
            )
          transfer.push(module.HEAPU8.slice(pointer, pointer + length).buffer)
        }
        return {
          payload: { envelope: payload, transfers: transfer },
          transfer,
        }
      } finally {
        module._lifearchive_browser_v1_invocation_free(invocation)
      }
    } finally {
      module.stackRestore(stack)
    }
  }
}

async function prepareWorkerRequest(payload: unknown): Promise<{
  readonly request: unknown
  readonly transfers: readonly ArrayBuffer[]
  readonly descriptors: readonly {
    readonly transferId: string
    readonly transferIndex: number
    readonly byteLength: string
    readonly sha256: string
  }[]
}> {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.transfers) ||
    !payload.transfers.every((value) => value instanceof ArrayBuffer)
  ) {
    return { request: payload, transfers: [], descriptors: [] }
  }
  const transfers = payload.transfers
  const request = payload.request
  const requestedTransferId =
    isRecord(request) && typeof request.sourceTransferId === 'string'
      ? request.sourceTransferId
      : 'source'
  const descriptors = await Promise.all(
    transfers.map(async (transfer, transferIndex) => ({
      transferId:
        transfers.length === 1
          ? requestedTransferId
          : `${requestedTransferId}-${transferIndex}`,
      transferIndex,
      byteLength: String(transfer.byteLength),
      sha256: await sha256(transfer),
    })),
  )
  return { request, transfers, descriptors }
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

installRuntimeWorker(scope, new WorkerRuntimeExecutor())
