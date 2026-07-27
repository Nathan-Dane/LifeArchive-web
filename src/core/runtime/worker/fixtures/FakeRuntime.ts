/**
 * A fake Emscripten runtime that models the browser ABI's memory behaviour.
 *
 * It exists to make one class of defect observable from a test: the runtime
 * reads staged bytes lazily, across suspension points, so releasing a staged
 * source before the invocation settles hands it freed memory. This fake keeps
 * the staged bytes behind a release flag and records any read that happens
 * after release instead of quietly returning something plausible.
 */

export interface RuntimeScript {
  /** Suspends inside apply until `resume()`, as OPFS access does. */
  readonly suspendDuringApply?: boolean
  /** Makes apply answer with this product failure code. */
  readonly applyFailureCode?: string
}

interface StagedSource {
  readonly chunks: Uint8Array[]
  expectedByteLength: number
  writtenByteLength: number
  finished: boolean
  released: boolean
}

const STACK_BASE = 0x100000
const STACK_BYTES = 4 * 1024 * 1024

export class FakeRuntimeModule {
  readonly HEAPU8 = new Uint8Array(16 * 1024 * 1024)
  readonly HEAPU32 = new Uint32Array(this.HEAPU8.buffer)

  readonly writes: number[] = []
  readonly stackAllocations: number[] = []
  readonly appliedSources: number[] = []
  readonly cancelRequests: string[] = []
  readAfterRelease = false
  suspended = false
  closed = false

  private readonly script: RuntimeScript
  private readonly sources = new Map<number, StagedSource>()
  private readonly invocations = new Map<number, string>()
  private readonly applyBytes = new Map<number, Uint8Array>()
  private stackPointer = STACK_BASE
  private nextPointer = 1
  private nextHeapText = STACK_BASE + STACK_BYTES
  private resumeApply: (() => void) | null = null

  constructor(script: RuntimeScript = {}) {
    this.script = script
  }

  /** True once every source created in this run has been released. */
  get released(): boolean {
    const sources = [...this.sources.values()]
    return sources.length > 0 && sources.every((source) => source.released)
  }

  resume(): void {
    this.resumeApply?.()
    this.resumeApply = null
  }

  stagedBytes(): Uint8Array {
    const source = [...this.sources.values()].at(-1)
    return source ? concat(source.chunks) : new Uint8Array()
  }

  bytesSeenByApply(): Uint8Array {
    return (
      this.applyBytes.get(this.appliedSources.at(-1) ?? -1) ?? new Uint8Array()
    )
  }

  /* ---------------------------------------------------------------- memory */

  stackSave(): number {
    return this.stackPointer
  }

  stackRestore(pointer: number): void {
    this.stackPointer = pointer
  }

  stackAlloc(byteLength: number): number {
    this.stackAllocations.push(byteLength)
    const aligned = (byteLength + 15) & ~15
    if (this.stackPointer - aligned < STACK_BASE - STACK_BYTES) {
      // The real runtime traps here; surfacing it as an error is what makes an
      // unbounded copy a test failure rather than silent corruption.
      throw new Error('memory access out of bounds')
    }
    this.stackPointer -= aligned
    return this.stackPointer
  }

  stringToUTF8OnStack(value: string): number {
    const bytes = new TextEncoder().encode(`${value}\0`)
    const pointer = this.stackAlloc(bytes.byteLength)
    this.HEAPU8.set(bytes, pointer)
    return pointer
  }

  UTF8ToString(pointer: number): string {
    let end = pointer
    while (this.HEAPU8[end] !== 0) end += 1
    return new TextDecoder().decode(this.HEAPU8.subarray(pointer, end))
  }

  private allocateText(value: string): number {
    const bytes = new TextEncoder().encode(`${value}\0`)
    const pointer = this.nextHeapText
    this.nextHeapText += bytes.byteLength
    this.HEAPU8.set(bytes, pointer)
    return pointer
  }

  private request(input: number): Record<string, unknown> {
    return JSON.parse(this.UTF8ToString(input)) as Record<string, unknown>
  }

  private reply(envelope: object): number {
    const pointer = this.nextPointer++
    this.invocations.set(pointer, JSON.stringify(envelope))
    return pointer
  }

  /* ------------------------------------------------------------------- ABI */

  _lifearchive_browser_v1_describe(input: number): number {
    const request = this.request(input)
    return this.reply({
      outcome: 'success',
      abiVersion: '1',
      requestId: request.requestId,
      operation: 'product.describe',
      result: {},
      transfers: [],
    })
  }

  _lifearchive_browser_v1_open(
    input: number,
    _pointers: number,
    _lengths: number,
    _count: number,
    outHandle: number,
  ): Promise<number> {
    const request = this.request(input)
    this.HEAPU32[outHandle >>> 2] = 1
    return Promise.resolve(
      this.reply({
        outcome: 'success',
        abiVersion: '1',
        requestId: request.requestId,
        operation: 'store.open',
        result: { outcome: 'opened' },
        transfers: [],
      }),
    )
  }

  _lifearchive_browser_v1_execute(input: number): Promise<number> {
    const request = this.request(input)
    return Promise.resolve(
      this.reply({
        outcome: 'success',
        abiVersion: '1',
        requestId: request.requestId,
        operation: request.operation,
        result: {},
        transfers: [],
      }),
    )
  }

  async _lifearchive_browser_v1_execute_archive_source(
    _handle: number,
    input: number,
    source: number,
  ): Promise<number> {
    const request = this.request(input)
    const staged = this.sources.get(source)
    if (!staged?.finished) {
      throw new Error('runtime received an unfinished archive source')
    }
    this.appliedSources.push(source)

    if (this.script.suspendDuringApply) {
      this.suspended = true
      await new Promise<void>((resolve) => {
        this.resumeApply = resolve
      })
      this.suspended = false
    }

    // The read happens only now, which is the whole point: a source released
    // while this call was pending would already be gone.
    if (staged.released) {
      this.readAfterRelease = true
      this.applyBytes.set(source, new Uint8Array(staged.writtenByteLength))
    } else {
      this.applyBytes.set(source, concat(staged.chunks))
    }

    if (this.script.applyFailureCode) {
      return this.reply({
        outcome: 'failure',
        abiVersion: '1',
        requestId: request.requestId,
        operation: 'archive.apply',
        failure: {
          category: 'validation',
          code: this.script.applyFailureCode,
          details: { area: 'archive', phase: 'validation', retryable: false },
        },
        transfers: [],
      })
    }
    return this.reply({
      outcome: 'success',
      abiVersion: '1',
      requestId: request.requestId,
      operation: 'archive.apply',
      result: {
        outcome: 'applied',
        importedEntries: 2,
        importedAttachments: 0,
        skippedEntries: 0,
        skippedAttachments: 0,
        skippedEntryIds: [],
        skippedAttachmentIds: [],
        issues: [],
        identityOutcome: 'adopted',
        identityConflicts: [],
        identityFilledFields: [],
        token: { storeInstanceId: 'fake-instance', revision: '1' },
      },
      transfers: [],
    })
  }

  _lifearchive_browser_v1_cancel(_handle: number, input: number): number {
    const request = this.request(input)
    const operationId = (
      request.request as { operationId?: string } | undefined
    )?.operationId
    if (operationId) this.cancelRequests.push(operationId)
    return this.reply({
      outcome: 'success',
      abiVersion: '1',
      requestId: request.requestId,
      operation: 'operation.cancel',
      result: { outcome: 'requested', operationId },
      transfers: [],
    })
  }

  _lifearchive_browser_v1_close(
    _handle: number,
    input: number,
  ): Promise<number> {
    const request = this.request(input)
    this.closed = true
    return Promise.resolve(
      this.reply({
        outcome: 'success',
        abiVersion: '1',
        requestId: request.requestId,
        operation: 'store.close',
        result: { outcome: 'closed' },
        transfers: [],
      }),
    )
  }

  _lifearchive_browser_v1_invocation_json(invocation: number): number {
    return this.allocateText(this.invocations.get(invocation) ?? '{}')
  }

  _lifearchive_browser_v1_invocation_transfer_count(): number {
    return 0
  }

  _lifearchive_browser_v1_invocation_transfer_data(): number {
    return 0
  }

  _lifearchive_browser_v1_invocation_transfer_length(): number {
    return 0
  }

  _lifearchive_browser_v1_invocation_free(invocation: number): void {
    this.invocations.delete(invocation)
  }

  _lifearchive_browser_v1_handle_free(): Promise<void> {
    return Promise.resolve()
  }

  /* -------------------------------------------------- staged archive source */

  _lifearchive_browser_v1_archive_source_begin(
    _handle: number,
    _sourceId: number,
    byteLength: number,
  ): Promise<number> {
    const pointer = this.nextPointer++
    this.sources.set(pointer, {
      chunks: [],
      expectedByteLength: Number(this.UTF8ToString(byteLength)),
      writtenByteLength: 0,
      finished: false,
      released: false,
    })
    return Promise.resolve(pointer)
  }

  _lifearchive_browser_v1_archive_source_write(
    source: number,
    bytes: number,
    byteLength: number,
  ): Promise<number> {
    const staged = this.sources.get(source)
    if (!staged || staged.released || staged.finished) return Promise.resolve(0)
    if (staged.writtenByteLength + byteLength > staged.expectedByteLength) {
      return Promise.resolve(0)
    }
    this.writes.push(byteLength)
    staged.chunks.push(this.HEAPU8.slice(bytes, bytes + byteLength))
    staged.writtenByteLength += byteLength
    return Promise.resolve(byteLength)
  }

  _lifearchive_browser_v1_archive_source_finish(
    source: number,
  ): Promise<number> {
    const staged = this.sources.get(source)
    if (!staged || staged.writtenByteLength !== staged.expectedByteLength) {
      return Promise.resolve(0)
    }
    staged.finished = true
    return Promise.resolve(1)
  }

  _lifearchive_browser_v1_archive_source_descriptor(source: number): number {
    const staged = this.sources.get(source)
    if (!staged?.finished) return 0
    return this.allocateText(
      JSON.stringify({
        kind: 'runtime-staged-chunks',
        path: `/opfs/lifearchive-primary/.browser-root-staging/browser-transports/${source}.lifearchive.transport`,
        byteLength: String(staged.writtenByteLength),
      }),
    )
  }

  _lifearchive_browser_v1_archive_source_free(source: number): Promise<void> {
    const staged = this.sources.get(source)
    if (staged) staged.released = true
    return Promise.resolve()
  }
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}
