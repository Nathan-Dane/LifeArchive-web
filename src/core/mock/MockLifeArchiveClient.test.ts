import { describe, expect, it } from 'vitest'
import {
  CLIENT_SURFACE,
  clientFailure,
  describeClientSurface,
  failed,
  isOk,
  ok,
  operationId,
  revision,
  stableId,
} from '../client'
import type {
  ArchiveChange,
  ArchiveSession,
  ClientResult,
  LifeArchiveClient,
  RuntimeStatus,
} from '../client'
import { MockLifeArchiveClient } from './MockLifeArchiveClient'
import { MockCallRecorder } from './callRecorder'
import { ProductionMockError, type BuildMode } from './developmentOnly'
import {
  ARCHIVE_TRANSPORT_EXTENSION,
  ARCHIVE_TRANSPORT_MIME_TYPE,
} from '../../platform/files/archiveTransfer'
import {
  DEVELOPMENT_MOCK_SCENARIO,
  MOCK_FIXTURES,
  ORDINARY_SAVE_CONFLICT,
} from './scenario'

const DEVELOPMENT: BuildMode = {
  DEV: true,
  PROD: false,
  clientSelection: 'development-mock',
}

const PRODUCTION: BuildMode = {
  DEV: false,
  PROD: true,
  clientSelection: 'development-mock',
}

function createMock(recorder?: MockCallRecorder): MockLifeArchiveClient {
  return new MockLifeArchiveClient({ buildMode: DEVELOPMENT, recorder })
}

/**
 * Calls every method on the surface with a placeholder request. The mock
 * answers from fixtures and never inspects a request, so a placeholder is
 * enough to prove the method exists and settles.
 */
const SYNCHRONOUS_METHODS = new Set([
  'runtime.status',
  'runtime.observeStatus',
  'archive.session',
  'archive.observeSession',
  'operations.newStableId',
  'operations.newOperationId',
  'operations.observeChanges',
])

describe('the development mock as a client', () => {
  it('is assignable to the client interface', () => {
    const client: LifeArchiveClient = createMock()
    expect(client.runtime.status().state).toBe('available')
  })

  it('implements every declared method and no extra area', () => {
    const mock = createMock()
    const surface = mock as unknown as Record<string, Record<string, unknown>>
    for (const [area, methods] of Object.entries(CLIENT_SURFACE)) {
      expect(Object.keys(surface[area]).sort()).toEqual([...methods].sort())
    }
  })

  it('answers every asynchronous method with a result value', async () => {
    const mock = createMock()
    const surface = mock as unknown as Record<
      string,
      Record<string, (request: unknown) => unknown>
    >
    const paths = describeClientSurface().filter(
      (path) => !SYNCHRONOUS_METHODS.has(path),
    )
    expect(paths.length).toBeGreaterThan(30)
    for (const path of paths) {
      const [area, method] = path.split('.')
      const answered = await surface[area][method]({})
      const result = answered as ClientResult<unknown>
      expect(
        result.status,
        `${path} answered with ${String(result.status)}`,
      ).toBe('ok')
    }
  })

  it('reports the development mode and no durability', () => {
    const mock = createMock()
    const status = mock.runtime.status()
    expect(status).toEqual({
      state: 'available',
      runtime: MOCK_FIXTURES.runtimeFacts,
    })
    if (status.state !== 'available') throw new Error('unreachable')
    expect(status.runtime.mode).toBe('development-mock')
    expect(status.runtime.durability).toBe('unproven')
  })

  it('reports storage facts that claim nothing durable', async () => {
    const mock = createMock()
    const facts = await mock.runtime.storage()
    if (!isOk(facts)) throw new Error('expected storage facts')
    expect(facts.value.durability).toBe('unproven')
    expect(facts.value.grant).toBe('unsupported')
    expect(facts.value.estimate).toBeNull()
  })

  it('uses the browser archive transport contract for its fixed export', async () => {
    const result = await createMock().archive.export({} as never)
    if (!isOk(result)) throw new Error('expected an export package')

    expect(result.value.archive.name).toBe(
      `development-mock-export${ARCHIVE_TRANSPORT_EXTENSION}`,
    )
    expect(result.value.archive.type).toBe(ARCHIVE_TRANSPORT_MIME_TYPE)
  })
})

describe('fixed answers', () => {
  it('returns the same entry however often it is asked', async () => {
    const mock = createMock()
    const first = await mock.record.load(MOCK_FIXTURES.focusedWindow)
    const second = await mock.record.load(MOCK_FIXTURES.focusedWindow)
    expect(first).toEqual(second)
    if (!isOk(first)) throw new Error('expected an entry')
    expect(first.value).toEqual(MOCK_FIXTURES.entryPresent)
  })

  it('does not let a save change what the next load returns', async () => {
    const mock = createMock()
    await mock.record.save({
      window: MOCK_FIXTURES.focusedWindow,
      markdown: 'Something the mock will not remember',
      nowMs: 1749931200000,
      target: {
        expectation: 'existing',
        entryId: MOCK_FIXTURES.entryId,
        expectedRevision: revision('9'),
      },
    })
    const loaded = await mock.record.load(MOCK_FIXTURES.focusedWindow)
    if (!isOk(loaded)) throw new Error('expected an entry')
    expect(loaded.value).toEqual(MOCK_FIXTURES.entryPresent)
  })

  it('mints identifiers from a fixed list rather than generating them', () => {
    const mock = createMock()
    const minted = [
      mock.operations.newStableId(),
      mock.operations.newStableId(),
    ]
    expect(minted).toEqual([
      DEVELOPMENT_MOCK_SCENARIO.mintedStableIds[0],
      DEVELOPMENT_MOCK_SCENARIO.mintedStableIds[1],
    ])
    expect(createMock().operations.newStableId()).toEqual(minted[0])
  })

  it('places a calendar grid it was given, and never computes one', async () => {
    const mock = createMock()
    const context = await mock.time.calendarContext({
      focusedDate: MOCK_FIXTURES.focusedDate,
      timeZoneId: 'UTC',
      weekRules: { firstWeekday: 1, minimumDaysInFirstWeek: 4 },
    })
    if (!isOk(context)) throw new Error('expected a calendar context')
    expect(context.value.week).toHaveLength(7)
    expect(context.value.month).toHaveLength(42)
    expect(context.value.focusedDate).toBe(MOCK_FIXTURES.focusedDate)
  })

  it('steps to a fixed neighbouring window, whichever direction is asked', async () => {
    const mock = createMock()
    const previous = await mock.time.step({
      window: MOCK_FIXTURES.focusedWindow,
      step: 'previous',
      weekRules: { firstWeekday: 1, minimumDaysInFirstWeek: 4 },
    })
    const next = await mock.time.step({
      window: MOCK_FIXTURES.focusedWindow,
      step: 'next',
      weekRules: { firstWeekday: 1, minimumDaysInFirstWeek: 4 },
    })
    expect(previous).toEqual(next)
    if (!isOk(previous)) throw new Error('expected a window')
    expect(previous.value).toEqual(MOCK_FIXTURES.neighbourWindow)
  })

  it('echoes the caller operation identifier when cancelling', async () => {
    const mock = createMock()
    const id = operationId('7f1c0a10-0000-4000-8000-0000000000cc')
    const result = await mock.operations.requestCancel(id)
    if (!isOk(result)) throw new Error('expected a cancellation result')
    expect(result.value.operationId).toBe(id)
    expect(result.value.outcome).toBe('requested')
  })
})

describe('scripted outcomes', () => {
  it('returns a scripted revision conflict without resolving it', async () => {
    const mock = createMock()
    mock.script('record.save', ok(ORDINARY_SAVE_CONFLICT))
    const result = await mock.record.save({
      window: MOCK_FIXTURES.focusedWindow,
      markdown: 'A buffer the caller keeps',
      nowMs: 1749931200000,
      target: {
        expectation: 'existing',
        entryId: MOCK_FIXTURES.entryId,
        expectedRevision: revision('9'),
      },
    })
    if (!isOk(result)) throw new Error('expected a save result')
    expect(result.value.outcome).toBe('conflict')
    if (result.value.outcome !== 'conflict') throw new Error('unreachable')
    expect(result.value.conflict.expectedRevision).toBe(revision('9'))
    expect(result.value.conflict.actualRevision).toBe(revision('10'))
    expect(result.value.conflict.current).toEqual(
      MOCK_FIXTURES.entryAfterConflict,
    )
  })

  it('returns a scripted failure and then the fixed answer again', async () => {
    const mock = createMock()
    const failure = clientFailure({
      area: 'storage',
      code: 'ioFailure',
      phase: 'mutation',
      retryable: true,
      durableOutcome: 'unknown',
    })
    mock.script('record.save', failed(failure))

    const failedSave = await mock.record.save({
      window: MOCK_FIXTURES.focusedWindow,
      markdown: 'Still in the buffer',
      nowMs: 1749931200000,
      target: { expectation: 'absent', newEntryId: MOCK_FIXTURES.entryId },
    })
    expect(failedSave.status).toBe('failed')
    if (failedSave.status !== 'failed') throw new Error('unreachable')
    expect(failedSave.failure.durableOutcome).toBe('unknown')
    expect(failedSave.failure.retryable).toBe(true)

    const recovered = await mock.record.save({
      window: MOCK_FIXTURES.focusedWindow,
      markdown: 'Still in the buffer',
      nowMs: 1749931200000,
      target: { expectation: 'absent', newEntryId: MOCK_FIXTURES.entryId },
    })
    expect(recovered.status).toBe('ok')
  })

  it('consumes scripted answers in order and clears them on request', async () => {
    const mock = createMock()
    mock
      .script('archive.close', ok({ outcome: 'closed' }))
      .script('archive.close', ok({ outcome: 'already-closed' }))
    const first = await mock.archive.close()
    if (!isOk(first)) throw new Error('expected a close result')
    expect(first.value.outcome).toBe('closed')

    mock.clearScripts()
    const second = await mock.archive.close()
    if (!isOk(second)) throw new Error('expected a close result')
    expect(second.value.outcome).toBe('closed')
    expect(mock.calls.countOf('archive.close')).toBe(2)
  })

  it('pushes observed runtime, session, and change values to listeners', () => {
    const mock = createMock()
    const statuses: RuntimeStatus[] = []
    const sessions: ArchiveSession[] = []
    const changes: ArchiveChange[] = []
    const stopStatus = mock.runtime.observeStatus((status) =>
      statuses.push(status),
    )
    mock.archive.observeSession((session) => sessions.push(session))
    mock.operations.observeChanges((change) => changes.push(change))

    mock.emitRuntimeStatus({ state: 'unavailable', reason: 'worker-lost' })
    mock.emitArchiveSession({ state: 'open-in-another-tab' })
    mock.emitArchiveChange({
      storeId: MOCK_FIXTURES.archiveId,
      invalidation: MOCK_FIXTURES.invalidation,
    })

    expect(statuses).toEqual([{ state: 'unavailable', reason: 'worker-lost' }])
    expect(sessions).toEqual([{ state: 'open-in-another-tab' }])
    expect(changes).toHaveLength(1)
    expect(mock.runtime.status()).toEqual({
      state: 'unavailable',
      reason: 'worker-lost',
    })
    expect(mock.archive.session()).toEqual({ state: 'open-in-another-tab' })

    stopStatus()
    mock.emitRuntimeStatus({ state: 'checking' })
    expect(statuses).toHaveLength(1)
  })
})

describe('the call recorder', () => {
  it('records every call in order, with the exact request', async () => {
    const recorder = new MockCallRecorder()
    const mock = createMock(recorder)
    const request = {
      id: stableId('7f1c0a10-0000-4000-8000-000000000020'),
      includeDeleted: false,
    }
    mock.runtime.status()
    await mock.structured.load(request)
    await mock.record.load(MOCK_FIXTURES.focusedWindow)

    expect(recorder.paths()).toEqual([
      'runtime.status',
      'structured.load',
      'record.load',
    ])
    expect(recorder.to('structured.load')[0].request).toBe(request)
    expect(recorder.all().map((call) => call.sequence)).toEqual([1, 2, 3])

    recorder.clear()
    expect(recorder.all()).toEqual([])
  })
})

describe('the production guard', () => {
  it('refuses to construct outside a development build', () => {
    expect(() => new MockLifeArchiveClient({ buildMode: PRODUCTION })).toThrow(
      ProductionMockError,
    )
  })

  it('refuses when the build claims to be neither development nor production', () => {
    expect(
      () =>
        new MockLifeArchiveClient({
          buildMode: { DEV: false, PROD: false, clientSelection: null },
        }),
    ).toThrow(ProductionMockError)
  })
})
