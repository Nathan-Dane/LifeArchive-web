import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ARCHIVE_IMPORT_CHUNK_BYTES } from './archiveImportSource'
import {
  WORKER_PROTOCOL_VERSION,
  type MainToWorkerMessage,
  type RuntimeWorkerStartup,
  type WorkerToMainMessage,
} from './protocol'
import { FakeRuntimeModule, type RuntimeScript } from './fixtures/FakeRuntime'

/**
 * The production worker bridge, exercised end to end.
 *
 * This drives `runtime.worker.ts` itself — the module the application ships —
 * through its real message protocol, against a runtime that implements the
 * browser ABI faithfully enough to catch the mistakes that only appear once
 * the runtime suspends: releasing staged bytes underneath an operation that is
 * still reading them, unbounded copies, and lost cancellation.
 */

const GENERATION = 'archive-import-generation'
const LARGE_MEDIA_BYTES = 6 * 1024 * 1024 + 731

/** A real POSIX ustar stream. The bridge never parses it; the runtime does. */
function archiveTransportBytes(
  root: string,
  files: readonly { readonly path: string; readonly bytes: Uint8Array }[],
): Uint8Array<ArrayBuffer> {
  const blocks: Uint8Array[] = []
  for (const file of files) {
    const header = new Uint8Array(512)
    const write = (offset: number, text: string) => {
      for (let index = 0; index < text.length; index += 1) {
        header[offset + index] = text.charCodeAt(index)
      }
    }
    write(0, `${root}/${file.path}`)
    write(100, '000600 \0')
    write(108, '000000 \0')
    write(116, '000000 \0')
    write(124, `${file.bytes.byteLength.toString(8).padStart(11, '0')} `)
    write(136, '00000000000 ')
    write(148, '        ')
    write(156, '0')
    write(257, 'ustar\0')
    write(263, '00')
    let checksum = 0
    for (const byte of header) checksum += byte
    write(148, `${checksum.toString(8).padStart(6, '0')}\0 `)
    blocks.push(header)

    const padded = new Uint8Array(Math.ceil(file.bytes.byteLength / 512) * 512)
    padded.set(file.bytes)
    blocks.push(padded)
  }
  blocks.push(new Uint8Array(1024))

  const total = blocks.reduce((sum, block) => sum + block.byteLength, 0)
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const block of blocks) {
    bytes.set(block, offset)
    offset += block.byteLength
  }
  return bytes
}

function patternedBytes(byteLength: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(byteLength)
  for (let index = 0; index < byteLength; index += 1) {
    bytes[index] = (index * 31 + 17) & 0xff
  }
  return bytes
}

function twoEntryArchive(): Uint8Array<ArrayBuffer> {
  return archiveTransportBytes('Test.lifearchive', [
    { path: 'manifest.json', bytes: new TextEncoder().encode('{}') },
    {
      path: 'records/entries.jsonl',
      bytes: new TextEncoder().encode('{"a":1}\n{"b":2}\n'),
    },
  ])
}

function largeMediaArchive(): Uint8Array<ArrayBuffer> {
  return archiveTransportBytes('Large.lifearchive', [
    { path: 'manifest.json', bytes: new TextEncoder().encode('{}') },
    { path: 'media/large.bin', bytes: patternedBytes(LARGE_MEDIA_BYTES) },
  ])
}

/** A browser-backed File that only ever yields bytes through `stream()`. */
function transportFile(
  bytes: Uint8Array<ArrayBuffer>,
  name = 'Test.lifearchive.tar',
  streamChunkBytes = 64 * 1024,
): { readonly file: File; readonly arrayBuffer: ReturnType<typeof vi.spyOn> } {
  const file = new File([bytes], name, { type: 'application/x-tar' })
  Object.defineProperty(file, 'stream', {
    configurable: true,
    value: () => {
      let offset = 0
      return new ReadableStream<Uint8Array>({
        pull(controller) {
          if (offset >= bytes.byteLength) {
            controller.close()
            return
          }
          const end = Math.min(offset + streamChunkBytes, bytes.byteLength)
          controller.enqueue(bytes.subarray(offset, end))
          offset = end
        },
      })
    },
  })
  const arrayBuffer = vi
    .spyOn(file, 'arrayBuffer')
    .mockRejectedValue(new Error('whole-file buffering is forbidden'))
  return { file, arrayBuffer }
}

class WorkerScope {
  readonly posted: WorkerToMainMessage[] = []
  closed = false
  private listener: ((event: MessageEvent<unknown>) => void) | null = null

  addEventListener(
    _type: 'message',
    listener: (event: MessageEvent<unknown>) => void,
  ): void {
    this.listener = listener
  }

  postMessage(message: WorkerToMainMessage): void {
    this.posted.push(message)
  }

  close(): void {
    this.closed = true
  }

  send(message: MainToWorkerMessage): void {
    this.listener?.({ data: message } as MessageEvent<unknown>)
  }

  find<Type extends WorkerToMainMessage['type']>(
    type: Type,
    requestId?: string,
  ): Extract<WorkerToMainMessage, { type: Type }> | undefined {
    return this.posted.find(
      (message) =>
        message.type === type &&
        (requestId === undefined ||
          (message as { requestId?: string }).requestId === requestId),
    ) as Extract<WorkerToMainMessage, { type: Type }> | undefined
  }
}

let runtimeModule: FakeRuntimeModule

const STARTUP: RuntimeWorkerStartup = {
  // Resolved through the worker's own dynamic import, so the bridge's loading
  // path is the one under test rather than a stubbed module reference.
  loaderUrl:
    'data:text/javascript,export default (options) => globalThis.__lifearchiveFakeRuntime(options)',
  wasmUrl: 'data:application/wasm;base64,',
  productContract: '5',
  bindingsAbi: '1',
}

async function startWorker(script: RuntimeScript = {}): Promise<WorkerScope> {
  runtimeModule = new FakeRuntimeModule(script)
  Object.defineProperty(globalThis, '__lifearchiveFakeRuntime', {
    configurable: true,
    value: () => Promise.resolve(runtimeModule),
  })
  // jsdom has no Web Locks; the worker's root ownership needs one.
  vi.stubGlobal('navigator', {
    ...globalThis.navigator,
    locks: {
      async request(
        _name: string,
        _options: unknown,
        callback: (lock: { name: string } | null) => Promise<unknown>,
      ) {
        return callback({ name: 'lifearchive:archive-lock:v1:primary' })
      },
    },
  })
  const scope = new WorkerScope()
  vi.stubGlobal('self', scope)
  vi.resetModules()
  await import('./runtime.worker')

  scope.send({
    type: 'start',
    protocolVersion: WORKER_PROTOCOL_VERSION,
    generation: GENERATION,
    runtime: STARTUP,
  } as MainToWorkerMessage)
  await vi.waitFor(() => expect(scope.find('ready')).toBeDefined())
  return scope
}

function openArchive(scope: WorkerScope): Promise<void> {
  scope.send({
    type: 'request',
    protocolVersion: WORKER_PROTOCOL_VERSION,
    generation: GENERATION,
    requestId: 'open',
    operation: 'store.open',
    payload: { request: {}, transfers: [] },
  } as MainToWorkerMessage)
  return vi.waitFor(() => expect(scope.find('response', 'open')).toBeDefined())
}

function importArchive(
  scope: WorkerScope,
  file: File,
  requestId = 'apply',
  operationId = 'B7C6D4E2-0000-4000-8000-000000000001',
): void {
  scope.send({
    type: 'request',
    protocolVersion: WORKER_PROTOCOL_VERSION,
    generation: GENERATION,
    requestId,
    operation: 'archive.apply',
    payload: { request: { operationId }, transfers: [], archive: file },
  } as MainToWorkerMessage)
}

function envelopeOf(message: WorkerToMainMessage | undefined): {
  readonly outcome?: unknown
  readonly failure?: { readonly code?: unknown }
  readonly result?: unknown
} {
  const payload = (message as { payload?: { envelope?: unknown } } | undefined)
    ?.payload
  return (payload?.envelope ?? {}) as { readonly outcome?: unknown }
}

/** An `invalid-archive-transport` reply is the regression this suite exists for. */
function expectApplied(message: WorkerToMainMessage | undefined): void {
  const envelope = envelopeOf(message)
  expect(envelope.failure?.code).toBeUndefined()
  expect(envelope.outcome).toBe('success')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.useRealTimers()
})

describe('production worker archive import bridge', () => {
  it('applies a two-entry archive with byte-exact staging and no File.arrayBuffer', async () => {
    const bytes = twoEntryArchive()
    const { file, arrayBuffer } = transportFile(bytes)
    const scope = await startWorker()
    await openArchive(scope)

    importArchive(scope, file)
    await vi.waitFor(() =>
      expect(scope.find('response', 'apply')).toBeDefined(),
    )

    expectApplied(scope.find('response', 'apply'))
    expect(arrayBuffer).not.toHaveBeenCalled()
    expect(runtimeModule.stagedBytes()).toEqual(bytes)
    expect(runtimeModule.readAfterRelease).toBe(false)
    expect(runtimeModule.appliedSources).toHaveLength(1)
  })

  it('streams an archive larger than the Wasm stack in bounded chunks', async () => {
    const bytes = largeMediaArchive()
    const { file, arrayBuffer } = transportFile(
      bytes,
      'Large.lifearchive.tar',
      256 * 1024,
    )
    const scope = await startWorker()
    await openArchive(scope)

    importArchive(scope, file)
    await vi.waitFor(
      () => expect(scope.find('response', 'apply')).toBeDefined(),
      { timeout: 20_000 },
    )

    expectApplied(scope.find('response', 'apply'))
    expect(arrayBuffer).not.toHaveBeenCalled()
    expect(bytes.byteLength).toBeGreaterThan(4 * 1024 * 1024)
    expect(runtimeModule.writes.length).toBeGreaterThan(1)
    expect(Math.max(...runtimeModule.writes)).toBeLessThanOrEqual(
      ARCHIVE_IMPORT_CHUNK_BYTES,
    )
    expect(Math.max(...runtimeModule.stackAllocations)).toBeLessThanOrEqual(
      ARCHIVE_IMPORT_CHUNK_BYTES,
    )
    expect(runtimeModule.stagedBytes()).toEqual(bytes)
    expect(runtimeModule.readAfterRelease).toBe(false)
  }, 30_000)

  it('keeps the staged source readable until the runtime settles its outcome', async () => {
    const bytes = twoEntryArchive()
    const { file } = transportFile(bytes)
    // The runtime suspends mid-apply, exactly as it does on OPFS, and reads
    // the staged bytes only after resuming.
    const scope = await startWorker({ suspendDuringApply: true })
    await openArchive(scope)

    importArchive(scope, file)
    await vi.waitFor(() => expect(runtimeModule.suspended).toBe(true))
    expect(runtimeModule.released).toBe(false)

    runtimeModule.resume()
    await vi.waitFor(() =>
      expect(scope.find('response', 'apply')).toBeDefined(),
    )

    expectApplied(scope.find('response', 'apply'))
    expect(runtimeModule.readAfterRelease).toBe(false)
    expect(runtimeModule.bytesSeenByApply()).toEqual(bytes)
    expect(runtimeModule.released).toBe(true)
  })

  it('cancels during acquisition without reaching the runtime or replacing the archive', async () => {
    const bytes = largeMediaArchive()
    let releaseRead: (() => void) | undefined
    const blocked = new Promise<void>((resolve) => {
      releaseRead = resolve
    })
    const file = new File([bytes], 'Large.lifearchive.tar', {
      type: 'application/x-tar',
    })
    Object.defineProperty(file, 'stream', {
      configurable: true,
      value: () => {
        let offset = 0
        return new ReadableStream<Uint8Array>({
          async pull(controller) {
            if (offset > 0) await blocked
            const end = Math.min(offset + 64 * 1024, bytes.byteLength)
            controller.enqueue(bytes.subarray(offset, end))
            offset = end
            if (offset >= bytes.byteLength) controller.close()
          },
          cancel() {
            releaseRead?.()
          },
        })
      },
    })
    const scope = await startWorker()
    await openArchive(scope)

    importArchive(scope, file, 'cancel-acquire')
    await vi.waitFor(() =>
      expect(runtimeModule.writes.length).toBeGreaterThan(0),
    )
    scope.send({
      type: 'cancel',
      protocolVersion: WORKER_PROTOCOL_VERSION,
      generation: GENERATION,
      requestId: 'cancel-acquire',
    } as MainToWorkerMessage)

    await vi.waitFor(() =>
      expect(scope.find('response', 'cancel-acquire')).toBeDefined(),
    )
    const response = scope.find('response', 'cancel-acquire')
    expect((response as { error?: { code?: string } }).error?.code).toBe(
      'ArchiveAcquisitionCancelled',
    )
    expect(runtimeModule.appliedSources).toHaveLength(0)
    expect(runtimeModule.released).toBe(true)
  }, 20_000)

  it('waits for the runtime outcome when cancellation arrives during apply', async () => {
    const bytes = twoEntryArchive()
    const { file } = transportFile(bytes)
    const scope = await startWorker({ suspendDuringApply: true })
    await openArchive(scope)

    importArchive(scope, file, 'cancel-apply')
    await vi.waitFor(() => expect(runtimeModule.suspended).toBe(true))
    scope.send({
      type: 'cancel',
      protocolVersion: WORKER_PROTOCOL_VERSION,
      generation: GENERATION,
      requestId: 'cancel-apply',
    } as MainToWorkerMessage)

    // Cancellation is a request. The caller stays pending, and the staged
    // bytes stay readable, until Rust reports the one definitive outcome.
    await vi.waitFor(() => expect(runtimeModule.cancelRequests).toHaveLength(1))
    expect(scope.find('response', 'cancel-apply')).toBeUndefined()
    expect(runtimeModule.released).toBe(false)

    runtimeModule.resume()
    await vi.waitFor(() =>
      expect(scope.find('response', 'cancel-apply')).toBeDefined(),
    )
    expect(runtimeModule.readAfterRelease).toBe(false)
    expect(runtimeModule.bytesSeenByApply()).toEqual(bytes)
  })

  it('reports a runtime transport failure without replacing the open archive', async () => {
    const bytes = twoEntryArchive()
    const { file } = transportFile(bytes)
    const scope = await startWorker({ applyFailureCode: 'invalidArchive' })
    await openArchive(scope)

    importArchive(scope, file, 'failing')
    await vi.waitFor(() =>
      expect(scope.find('response', 'failing')).toBeDefined(),
    )

    const envelope = envelopeOf(scope.find('response', 'failing'))
    expect(envelope.outcome).toBe('failure')
    expect(envelope.failure?.code).toBe('invalidArchive')
    // A failure still ends the borrow, and it never closes the open archive.
    expect(runtimeModule.released).toBe(true)
    expect(runtimeModule.closed).toBe(false)
    expect(scope.find('fatal')).toBeUndefined()
  })
})
