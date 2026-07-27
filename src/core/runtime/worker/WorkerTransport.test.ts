import { describe, expect, it } from 'vitest'
import { FixedWorker } from './fixtures/FixedWorker'
import { WorkerTransport, WorkerTransportError } from './WorkerTransport'

const generation = 'fixed-generation'

function setup() {
  const worker = new FixedWorker()
  const transport = new WorkerTransport({
    createWorker: () => worker.asWorker(),
    generation,
  })
  return { worker, transport }
}

async function expectTransportError(
  promise: Promise<unknown>,
  code: string,
  durableOutcome: WorkerTransportError['durableOutcome'],
) {
  await expect(promise).rejects.toMatchObject({ code, durableOutcome })
}

describe('WorkerTransport', () => {
  it('starts once, serializes requests, and correlates one response', async () => {
    const { worker, transport } = setup()
    await transport.start()

    const first = transport.request({
      requestId: 'first',
      operation: 'fixed.first',
      payload: { value: 1 },
    })
    const second = transport.request({
      requestId: 'second',
      operation: 'fixed.second',
      payload: { value: 2 },
    })
    await Promise.resolve()

    expect(worker.requests().map(({ requestId }) => requestId)).toEqual([
      'first',
    ])
    worker.respond(generation, 'first', { accepted: 1 })
    await expect(first).resolves.toEqual({ accepted: 1 })
    expect(worker.requests().map(({ requestId }) => requestId)).toEqual([
      'first',
      'second',
    ])

    worker.respond(generation, 'second', { accepted: 2 })
    await expect(second).resolves.toEqual({ accepted: 2 })
    await transport.close()
  })

  it('rejects duplicate IDs and ignores stale and late responses', async () => {
    const { worker, transport } = setup()
    await transport.start()

    const request = transport.request({
      requestId: 'same',
      operation: 'fixed',
      payload: null,
    })
    await Promise.resolve()
    await expectTransportError(
      transport.request({
        requestId: 'same',
        operation: 'fixed',
        payload: null,
      }),
      'duplicate-request-id',
      'not-started',
    )

    worker.respond('stale-generation', 'same', 'wrong')
    worker.respond(generation, 'other', 'wrong')
    worker.respond(generation, 'same', 'right')
    await expect(request).resolves.toBe('right')
    worker.respond(generation, 'same', 'late')
    await Promise.resolve()
    await transport.close()
  })

  it('moves ArrayBuffer ownership only when the request is admitted', async () => {
    const { worker, transport } = setup()
    await transport.start()

    const blocker = transport.request({
      requestId: 'blocker',
      operation: 'fixed',
      payload: null,
    })
    const bytes = new Uint8Array([3, 1, 4])
    const transferred = transport.request({
      requestId: 'bytes',
      operation: 'fixed.bytes',
      payload: { bytes },
      transfer: [bytes.buffer],
    })
    await Promise.resolve()
    expect(bytes.byteLength).toBe(3)

    worker.respond(generation, 'blocker', null)
    await blocker
    expect(bytes.byteLength).toBe(0)
    expect(
      Array.from((worker.requests()[1].payload as { bytes: Uint8Array }).bytes),
    ).toEqual([3, 1, 4])

    worker.respond(generation, 'bytes', null)
    await transferred
    await transport.close()
  })

  it('rejects mismatched transfer lists before admission', async () => {
    const { transport } = setup()
    await transport.start()
    const bytes = new Uint8Array([1])

    await expectTransportError(
      transport.request({
        operation: 'fixed.bytes',
        payload: { bytes },
      }),
      'invalid-transfer-list',
      'not-started',
    )
    expect(bytes.byteLength).toBe(1)
    await transport.close()
  })

  it('settles abort before admission immediately without transferring', async () => {
    const { worker, transport } = setup()
    await transport.start()
    const blocker = transport.request({
      requestId: 'blocker',
      operation: 'fixed',
      payload: null,
    })
    const controller = new AbortController()
    const bytes = new Uint8Array([9])
    const queued = transport.request({
      requestId: 'queued',
      operation: 'fixed',
      payload: bytes,
      transfer: [bytes.buffer],
      signal: controller.signal,
    })
    await Promise.resolve()

    controller.abort()
    await expectTransportError(queued, 'aborted', 'not-started')
    expect(bytes.byteLength).toBe(1)
    expect(worker.requests().map(({ requestId }) => requestId)).toEqual([
      'blocker',
    ])

    worker.respond(generation, 'blocker', null)
    await blocker
    await transport.close()
  })

  it('delivers active cancellation out of band and awaits its outcome', async () => {
    const { worker, transport } = setup()
    await transport.start()
    const controller = new AbortController()
    let settled = false
    const active = transport
      .request({
        requestId: 'active',
        operation: 'archive.apply',
        payload: null,
        signal: controller.signal,
      })
      .finally(() => {
        settled = true
      })
    await Promise.resolve()

    controller.abort()
    await Promise.resolve()
    expect(worker.cancellations().map(({ requestId }) => requestId)).toEqual([
      'active',
    ])
    expect(settled).toBe(false)

    worker.failResponseWithOutcome(generation, 'active', 'cancelled', 'known')
    await expectTransportError(active, 'cancelled', 'known')
    await transport.close()
  })

  it('uses executor evidence for durable outcomes and defaults conservatively', async () => {
    const { worker, transport } = setup()
    await transport.start()

    const beforeMutation = transport.request({
      requestId: 'before-mutation',
      operation: 'record.saveDraft',
      payload: null,
    })
    await Promise.resolve()
    worker.failResponseWithOutcome(
      generation,
      'before-mutation',
      'executor-failed',
      'not-started',
    )
    await expectTransportError(beforeMutation, 'executor-failed', 'not-started')

    const unprovenMutation = transport.request({
      requestId: 'unproven-mutation',
      operation: 'record.saveDraft',
      payload: null,
    })
    await Promise.resolve()
    worker.failResponse(generation, 'unproven-mutation', 'executor-failed')
    await expectTransportError(unprovenMutation, 'executor-failed', 'unknown')

    const read = transport.request({
      requestId: 'read',
      operation: 'record.loadSpan',
      payload: null,
    })
    await Promise.resolve()
    worker.failResponse(generation, 'read', 'executor-failed')
    await expectTransportError(read, 'executor-failed', 'known')
    await transport.close()
  })

  it('makes close a barrier, refuses queued work, and waits for active work', async () => {
    const { worker, transport } = setup()
    await transport.start()
    const active = transport.request({
      requestId: 'active',
      operation: 'fixed',
      payload: null,
    })
    const queued = transport.request({
      requestId: 'queued',
      operation: 'fixed',
      payload: null,
    })
    await Promise.resolve()

    const close = transport.close()
    await expectTransportError(queued, 'transport-closing', 'not-started')
    expect(worker.received.some(({ type }) => type === 'close')).toBe(false)

    worker.respond(generation, 'active', 'done')
    await expect(active).resolves.toBe('done')
    await close
    expect(worker.received.at(-1)?.type).toBe('close')
    expect(worker.terminated).toBe(true)
  })

  it.each(['error', 'messageerror'] as const)(
    'surfaces %s as fatal worker loss and distinguishes admitted work',
    async (eventType) => {
      const { worker, transport } = setup()
      await transport.start()
      const active = transport.request({
        requestId: 'active',
        operation: 'fixed',
        payload: null,
      })
      const queued = transport.request({
        requestId: 'queued',
        operation: 'fixed',
        payload: null,
      })
      await Promise.resolve()

      worker.crash(eventType)
      await expectTransportError(active, 'worker-lost', 'unknown')
      await expectTransportError(queued, 'worker-lost', 'not-started')
      expect(worker.terminated).toBe(true)
      expect(worker.listenerBalance).toBe(0)
    },
  )

  it('surfaces idle worker loss immediately and refuses reuse of the dead generation', async () => {
    const { worker, transport } = setup()
    await transport.start()
    const failures: WorkerTransportError[] = []
    transport.observeFatal((error) => failures.push(error))

    worker.crash()

    expect(failures).toMatchObject([
      { code: 'worker-lost', durableOutcome: 'unknown' },
    ])
    await expectTransportError(
      transport.request({
        operation: 'fixed.retry',
        payload: null,
      }),
      'worker-lost',
      'unknown',
    )
    expect(worker.requests()).toEqual([])
  })

  it('cleans up listeners and tolerates StrictMode-style double lifecycle', async () => {
    for (let mount = 0; mount < 2; mount += 1) {
      const { worker, transport } = setup()
      await transport.start()
      const firstClose = transport.close()
      const secondClose = transport.close()
      expect(secondClose).toBe(firstClose)
      await firstClose
      expect(worker.listenerBalance).toBe(0)
      expect(worker.terminated).toBe(true)
    }
  })
})
