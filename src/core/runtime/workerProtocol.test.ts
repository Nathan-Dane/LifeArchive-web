import { describe, expect, it } from 'vitest'
import {
  CANONICAL_ARCHIVE_LOCK_NAME,
  CANONICAL_ARCHIVE_ROOT_ID,
  WorkerProtocolModel,
  type WorkerRequestKind,
} from './workerProtocol'

const generation = 'worker-generation-1'

function request(requestId: string, kind: WorkerRequestKind) {
  return { generation, requestId, kind } as const
}

function open(model: WorkerProtocolModel) {
  expect(model.ready(generation)).toEqual([{ type: 'notice', code: 'ready' }])
  expect(model.submit(request('open-1', 'open'))).toEqual([
    {
      type: 'acquire-lock',
      requestId: 'open-1',
      lockName: CANONICAL_ARCHIVE_LOCK_NAME,
      rootId: CANONICAL_ARCHIVE_ROOT_ID,
      wait: false,
    },
  ])
  expect(model.lockAcquired(generation, 'open-1')).toEqual([
    { type: 'start', requestId: 'open-1', kind: 'open' },
  ])
  expect(model.finish(generation, 'open-1', 'success')).toEqual([
    {
      type: 'outcome',
      requestId: 'open-1',
      code: 'success',
      durableOutcome: 'known',
    },
  ])
}

describe('worker protocol state model', () => {
  it('gives startup exactly one ready or fatal value', () => {
    const readyModel = new WorkerProtocolModel(generation)
    expect(readyModel.ready(generation)).toEqual([
      { type: 'notice', code: 'ready' },
    ])

    const fatalModel = new WorkerProtocolModel(generation)
    expect(fatalModel.fatal(generation)).toEqual([
      { type: 'notice', code: 'fatal' },
      { type: 'terminate' },
    ])
    expect(fatalModel.snapshot().phase).toBe('fatal')
  })

  it('rejects duplicate IDs without replacing the original request', () => {
    const model = new WorkerProtocolModel(generation)
    open(model)

    expect(model.submit(request('save-1', 'mutation'))).toEqual([
      { type: 'start', requestId: 'save-1', kind: 'mutation' },
    ])
    expect(model.submit(request('save-1', 'read'))).toEqual([
      { type: 'notice', code: 'duplicate-request-id' },
    ])
    expect(model.snapshot().activeRequestId).toBe('save-1')
  })

  it('ignores late replies and replies from a stale worker generation', () => {
    const model = new WorkerProtocolModel(generation)
    open(model)
    model.submit(request('read-1', 'read'))

    expect(model.finish(generation, 'read-1', 'success')[0]).toMatchObject({
      type: 'outcome',
      requestId: 'read-1',
      code: 'success',
    })
    expect(model.finish(generation, 'read-1', 'success')).toEqual([
      { type: 'notice', code: 'late-reply' },
    ])
    expect(model.cancel(generation, 'read-1')).toEqual([
      { type: 'notice', code: 'late-cancellation' },
    ])
    expect(model.finish('worker-generation-0', 'read-1', 'success')).toEqual([
      { type: 'notice', code: 'stale-generation' },
    ])
  })

  it('cancels queued work but waits for definitive active outcomes', () => {
    const model = new WorkerProtocolModel(generation)
    open(model)
    model.submit(request('save-1', 'mutation'))
    model.submit(request('read-1', 'read'))

    expect(model.cancel(generation, 'read-1')).toEqual([
      {
        type: 'outcome',
        requestId: 'read-1',
        code: 'cancelled-before-start',
        durableOutcome: 'not-started',
      },
    ])
    expect(model.cancel(generation, 'save-1')).toEqual([
      { type: 'notice', code: 'cancellation-deferred' },
    ])
    expect(model.snapshot().activeRequestId).toBe('save-1')
  })

  it('signals product cancellation out of band and keeps export active', () => {
    const model = new WorkerProtocolModel(generation)
    open(model)
    model.submit(request('export-1', 'archive-export'))

    expect(model.cancel(generation, 'export-1')).toEqual([
      { type: 'signal-product-cancel', requestId: 'export-1' },
    ])
    expect(model.snapshot().activeRequestId).toBe('export-1')
    expect(model.finish(generation, 'export-1', 'failure')[0]).toMatchObject({
      type: 'outcome',
      requestId: 'export-1',
      code: 'failure',
      durableOutcome: 'known',
    })
  })

  it('makes close a barrier and terminates only after definitive close', () => {
    const model = new WorkerProtocolModel(generation)
    open(model)
    model.submit(request('save-1', 'mutation'))
    model.submit(request('read-1', 'read'))

    expect(model.submit(request('close-1', 'close'))).toEqual([
      {
        type: 'outcome',
        requestId: 'read-1',
        code: 'closing',
        durableOutcome: 'not-started',
      },
    ])
    expect(model.submit(request('late-read', 'read'))).toEqual([
      {
        type: 'outcome',
        requestId: 'late-read',
        code: 'worker-unavailable',
        durableOutcome: 'not-started',
      },
    ])
    expect(model.finish(generation, 'save-1', 'success')).toEqual([
      {
        type: 'outcome',
        requestId: 'save-1',
        code: 'success',
        durableOutcome: 'known',
      },
      { type: 'start', requestId: 'close-1', kind: 'close' },
    ])
    expect(model.finish(generation, 'close-1', 'success')).toEqual([
      {
        type: 'outcome',
        requestId: 'close-1',
        code: 'success',
        durableOutcome: 'known',
      },
      { type: 'release-lock' },
      { type: 'terminate' },
    ])
    expect(model.snapshot().phase).toBe('closed')
  })

  it('marks an active crash outcome unknown and queued work not started', () => {
    const model = new WorkerProtocolModel(generation)
    open(model)
    model.submit(request('save-1', 'mutation'))
    model.submit(request('read-1', 'read'))

    expect(model.crash(generation)).toEqual([
      {
        type: 'outcome',
        requestId: 'save-1',
        code: 'worker-lost',
        durableOutcome: 'unknown',
      },
      {
        type: 'outcome',
        requestId: 'read-1',
        code: 'worker-lost',
        durableOutcome: 'not-started',
      },
      { type: 'terminate' },
    ])
    expect(model.snapshot()).toMatchObject({
      phase: 'fatal',
      ownsLock: false,
      activeRequestId: null,
    })
  })

  it('fails closed when archive ownership is lost', () => {
    const model = new WorkerProtocolModel(generation)
    open(model)
    model.submit(request('save-1', 'mutation'))

    expect(model.lockLost(generation)).toEqual([
      {
        type: 'outcome',
        requestId: 'save-1',
        code: 'ownership-lost',
        durableOutcome: 'unknown',
      },
      { type: 'terminate' },
    ])
    expect(model.snapshot().phase).toBe('fatal')
  })

  it('denies a second tab before opening and never selects another root', () => {
    const model = new WorkerProtocolModel(generation)
    model.ready(generation)
    model.submit(request('open-1', 'open'))

    expect(model.lockDenied(generation, 'open-1')).toEqual([
      {
        type: 'outcome',
        requestId: 'open-1',
        code: 'already-open',
        durableOutcome: 'not-started',
      },
    ])
    expect(model.snapshot()).toEqual({
      generation,
      phase: 'ready',
      activeRequestId: null,
      queuedRequestIds: [],
      ownsLock: false,
    })
  })
})
