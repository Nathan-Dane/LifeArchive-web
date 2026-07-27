import {
  WORKER_PROTOCOL_VERSION,
  isMainToWorkerMessage,
  type RuntimeWorkerStartup,
  type WorkerResponseError,
  type WorkerToMainMessage,
} from './protocol'
import { mayMutateDurableState } from './durableOperations'
import { RootOwnership } from './RootOwnership'
import {
  stageArchiveTransport,
  type RuntimeArchiveTransportSource,
  type RuntimeArchiveSourceWriter,
} from './archiveImportSource'

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
          error: responseError(error, message.operation),
        })
      })
      .finally(() => {
        active = null
      })
  })
}

interface InvocationEvidence {
  crossedMutationBoundary: boolean
  completionEvidence: boolean
}

class RuntimeExecutionError extends Error {
  readonly code: string
  readonly durableOutcome: NonNullable<WorkerResponseError['durableOutcome']>

  constructor(
    code: string,
    diagnostic: string,
    durableOutcome: NonNullable<WorkerResponseError['durableOutcome']>,
  ) {
    super(diagnostic)
    this.name = 'RuntimeExecutionError'
    this.code = code
    this.durableOutcome = durableOutcome
  }
}

function runtimeExecutionError(
  operation: string,
  evidence: InvocationEvidence,
  error: unknown,
): RuntimeExecutionError {
  if (error instanceof RuntimeExecutionError) return error
  const code = error instanceof Error ? error.name : 'worker-failure'
  const diagnostic =
    error instanceof Error ? error.message : 'The runtime executor failed'
  const durableOutcome = !mayMutateDurableState(operation)
    ? 'known'
    : evidence.completionEvidence
      ? 'known'
      : evidence.crossedMutationBoundary
        ? 'unknown'
        : 'not-started'
  return new RuntimeExecutionError(code, diagnostic, durableOutcome)
}

function responseError(
  error: unknown,
  operation?: string,
): WorkerResponseError {
  if (error instanceof RuntimeExecutionError) {
    return {
      code: error.code,
      diagnostic: error.message,
      durableOutcome: error.durableOutcome,
    }
  }
  if (error instanceof Error) {
    return {
      code: error.name,
      diagnostic: error.message,
      ...(operation
        ? {
            durableOutcome: mayMutateDurableState(operation)
              ? ('unknown' as const)
              : ('known' as const),
          }
        : {}),
    }
  }
  return {
    code: 'worker-failure',
    ...(operation
      ? {
          durableOutcome: mayMutateDurableState(operation)
            ? ('unknown' as const)
            : ('known' as const),
        }
      : {}),
  }
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
  _lifearchive_browser_v1_execute_archive_source(
    handle: number,
    input: number,
    source: number,
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
  _lifearchive_browser_v1_archive_source_begin(
    handle: number,
    sourceId: number,
    byteLength: number,
  ): Promise<number>
  _lifearchive_browser_v1_archive_source_write(
    source: number,
    bytes: number,
    byteLength: number,
  ): Promise<number>
  _lifearchive_browser_v1_archive_source_finish(source: number): Promise<number>
  _lifearchive_browser_v1_archive_source_descriptor(source: number): number
  _lifearchive_browser_v1_archive_source_free(source: number): Promise<void>
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
    const evidence: InvocationEvidence = {
      crossedMutationBoundary: false,
      completionEvidence: false,
    }
    try {
      return await this.executeWithEvidence(
        operation,
        payload,
        signal,
        evidence,
      )
    } catch (error) {
      throw runtimeExecutionError(operation, evidence, error)
    }
  }

  private async executeWithEvidence(
    operation: string,
    payload: unknown,
    signal: AbortSignal,
    evidence: InvocationEvidence,
  ): Promise<RuntimeWorkerResult> {
    const module = this.requiredModule()
    const runtime = this.requiredRuntime()
    const requestId = crypto.randomUUID()
    let stagedArchive: RuntimeArchiveTransportSource | null = null
    let archiveWriter: RuntimeArchiveSourceWriter | null = null
    let archiveSourceHandle = 0
    if (
      (operation === 'archive.verify' || operation === 'archive.apply') &&
      isRecord(payload) &&
      payload.archive instanceof File
    ) {
      if (!this.handle) throw new Error('runtime-handle-closed')
      const source = await this.createArchiveSourceWriter(
        module,
        payload.archive.size,
      )
      archiveWriter = source.writer
      archiveSourceHandle = source.handle
      stagedArchive = await stageArchiveTransport(
        archiveWriter,
        payload.archive,
        signal,
      )
    }
    let prepared: Awaited<ReturnType<typeof prepareWorkerRequest>>
    try {
      prepared = await prepareWorkerRequest(payload, stagedArchive ?? undefined)
    } catch (error) {
      await archiveWriter?.dispose()
      throw error
    }
    const operationId =
      isRecord(prepared.request) &&
      typeof prepared.request.operationId === 'string'
        ? prepared.request.operationId
        : null
    const envelope = {
      abiVersion: runtime.bindingsAbi,
      requestId,
      productContractVersion: runtime.productContract,
      operation,
      request: prepared.request,
      transfers: prepared.descriptors,
    }
    const cancel = () => {
      if (!this.handle || !operationId) return
      void this.callInvocation(
        module,
        (input) => module._lifearchive_browser_v1_cancel(this.handle, input),
        {
          ...envelope,
          operation: 'operation.cancel',
          request: { operationId },
        },
      )
    }
    signal.addEventListener('abort', cancel, { once: true })
    if (signal.aborted) cancel()
    try {
      if (operation === 'product.describe') {
        return this.callInvocation(
          module,
          (input) => module._lifearchive_browser_v1_describe(input),
          envelope,
          prepared.transfers,
          evidence,
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
            evidence,
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
          evidence,
          true,
        )
        if (!isSuccessfulInvocation(result, operation, evidence)) {
          return result
        }
        const closedHandle = this.handle
        this.handle = 0
        try {
          await module._lifearchive_browser_v1_handle_free(closedHandle)
        } catch {
          // The product supplied definitive close completion. The worker is
          // about to terminate, so dropping the logical handle prevents any
          // later request from observing it as open even if native cleanup
          // reports a fault.
        }
        try {
          await this.ownership.release()
        } catch {
          // RootOwnership requests release before awaiting the lock callback;
          // a callback rejection cannot make the root logically owned again.
        }
        return result
      }
      if (operation === 'operation.cancel') {
        return this.callInvocation(
          module,
          (input) => module._lifearchive_browser_v1_cancel(this.handle, input),
          envelope,
          [],
          evidence,
        )
      }
      // Awaited, not returned: the `finally` below releases the runtime-owned
      // staged source, and Rust reads those bytes across its own suspension
      // points. Returning the pending promise would run the release first and
      // hand the runtime freed memory.
      return await this.callInvocation(
        module,
        (input, pointers, lengths, count) =>
          archiveSourceHandle
            ? module._lifearchive_browser_v1_execute_archive_source(
                this.handle,
                input,
                archiveSourceHandle,
              )
            : module._lifearchive_browser_v1_execute(
                this.handle,
                input,
                pointers,
                lengths,
                count,
              ),
        envelope,
        prepared.transfers,
        evidence,
      )
    } finally {
      signal.removeEventListener('abort', cancel)
      await archiveWriter?.dispose()
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

  private async createArchiveSourceWriter(
    module: EmscriptenRuntimeModule,
    byteLength: number,
  ): Promise<{
    readonly handle: number
    readonly writer: RuntimeArchiveSourceWriter
  }> {
    if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
      throw new TypeError('Archive File size is invalid')
    }
    const stack = module.stackSave()
    let source = 0
    try {
      const sourceId = module.stringToUTF8OnStack(crypto.randomUUID())
      const length = module.stringToUTF8OnStack(String(byteLength))
      source = await module._lifearchive_browser_v1_archive_source_begin(
        this.handle,
        sourceId,
        length,
      )
    } finally {
      module.stackRestore(stack)
    }
    if (!source) throw new Error('runtime-archive-source-begin-failed')

    let disposed = false
    const writer: RuntimeArchiveSourceWriter = {
      write: async (bytes) => {
        if (disposed) throw new Error('runtime-archive-source-closed')
        const stack = module.stackSave()
        try {
          const pointer = module.stackAlloc(bytes.byteLength || 1)
          module.HEAPU8.set(bytes, pointer)
          const written =
            await module._lifearchive_browser_v1_archive_source_write(
              source,
              pointer,
              bytes.byteLength,
            )
          if (written !== bytes.byteLength) {
            throw new Error('runtime-archive-source-write-failed')
          }
        } finally {
          module.stackRestore(stack)
        }
      },
      finish: async () => {
        if (disposed) throw new Error('runtime-archive-source-closed')
        const finished =
          await module._lifearchive_browser_v1_archive_source_finish(source)
        if (!finished) throw new Error('runtime-archive-source-finish-failed')
        const descriptor = module.UTF8ToString(
          module._lifearchive_browser_v1_archive_source_descriptor(source),
        )
        return parseArchiveSourceDescriptor(descriptor)
      },
      dispose: async () => {
        if (disposed) return
        disposed = true
        await module._lifearchive_browser_v1_archive_source_free(source)
        source = 0
      },
    }
    return { handle: source, writer }
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
    evidence: InvocationEvidence = {
      crossedMutationBoundary: false,
      completionEvidence: false,
    },
    preserveCompletionOnCleanupFault = false,
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
      evidence.crossedMutationBoundary = true
      const invocation = await call(
        input,
        transferPointers,
        transferLengths,
        transfers.length,
      )
      if (!invocation) throw new Error('runtime-null-invocation')
      let completedResult: RuntimeWorkerResult | null = null
      let invocationFailure: { readonly error: unknown } | null = null
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
        evidence.completionEvidence = hasCompletionEvidence(payload, envelope)
        completedResult = {
          payload: { envelope: payload, transfers: transfer },
          transfer,
        }
      } catch (error) {
        invocationFailure = { error }
      }
      let cleanupFailure: { readonly error: unknown } | null = null
      try {
        module._lifearchive_browser_v1_invocation_free(invocation)
      } catch (error) {
        cleanupFailure = { error }
      }
      if (invocationFailure) throw invocationFailure.error
      if (
        cleanupFailure &&
        (!preserveCompletionOnCleanupFault || !completedResult)
      ) {
        throw cleanupFailure.error
      }
      if (!completedResult) throw new Error('runtime-completion-missing')
      return completedResult
    } finally {
      module.stackRestore(stack)
    }
  }
}

function isSuccessfulInvocation(
  result: RuntimeWorkerResult,
  operation: string,
  evidence: InvocationEvidence,
): boolean {
  return (
    evidence.completionEvidence &&
    isRecord(result.payload) &&
    isRecord(result.payload.envelope) &&
    result.payload.envelope.outcome === 'success' &&
    result.payload.envelope.operation === operation
  )
}

async function prepareWorkerRequest(
  payload: unknown,
  archiveSource?: RuntimeArchiveTransportSource,
): Promise<{
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
    return {
      request: withArchiveSource(payload, archiveSource),
      transfers: [],
      descriptors: [],
    }
  }
  const transfers = payload.transfers
  const request = withArchiveSource(payload.request, archiveSource)
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

function withArchiveSource(
  request: unknown,
  source?: RuntimeArchiveTransportSource,
): unknown {
  if (!source) return request
  if (!isRecord(request)) {
    throw new TypeError('Archive request is malformed')
  }
  return { ...request, archiveTransportSource: source }
}

function hasCompletionEvidence(payload: unknown, request: object): boolean {
  if (!isRecord(payload) || !isRecord(request)) return false
  const hasOutcome =
    (payload.outcome === 'success' && 'result' in payload) ||
    (payload.outcome === 'failure' && isRecord(payload.failure))
  return (
    hasOutcome &&
    typeof request.requestId === 'string' &&
    payload.requestId === request.requestId &&
    typeof request.operation === 'string' &&
    payload.operation === request.operation
  )
}

function parseArchiveSourceDescriptor(
  input: string,
): RuntimeArchiveTransportSource {
  const value = JSON.parse(input) as unknown
  if (
    !isRecord(value) ||
    value.kind !== 'runtime-staged-chunks' ||
    typeof value.path !== 'string' ||
    typeof value.byteLength !== 'string'
  ) {
    throw new TypeError('Runtime archive source descriptor is malformed')
  }
  return {
    kind: value.kind,
    path: value.path,
    byteLength: value.byteLength,
  }
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
