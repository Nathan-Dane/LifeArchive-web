import { describe, expect, it } from 'vitest'
import {
  CLIENT_SURFACE,
  EXCLUDED_SURFACE_AREAS,
  describeClientSurface,
} from './capabilities'
import type { ClientSurfaceArea, ClientSurfaceMethod } from './capabilities'
import { clientFailure, failed, failureKey, isOk, ok } from './errors'
import type { ClientFailure, ClientResult } from './errors'
import type { LifeArchiveClient } from './LifeArchiveClient'
import { operationId, revision, stableId } from './types'
import type { OperationId, StableId, Unsubscribe } from './types'

/* -------------------------------------------------------------------------- */
/* A complete fake                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Proof that a whole feature-facing client can be written against the
 * interface alone. It answers with explicit unavailability instead of
 * fabricating durable values, which is exactly what a client that cannot reach
 * a runtime must do.
 */
const UNAVAILABLE: ClientFailure = clientFailure({
  area: 'transport',
  code: 'closed',
  phase: 'transport',
  retryable: false,
})

function unavailable<Value>(): Promise<ClientResult<Value>> {
  return Promise.resolve(failed<Value>(UNAVAILABLE))
}

const NO_SUBSCRIPTION: Unsubscribe = () => {}

const FAKE_STABLE_ID: StableId = stableId(
  'A1000000-0000-4000-8000-000000000002',
)
const FAKE_OPERATION_ID: OperationId = operationId(
  'A1000000-0000-4000-8000-000000000003',
)

function createFakeClient(): LifeArchiveClient {
  return {
    runtime: {
      status: () => ({ state: 'unavailable', reason: 'not-integrated' }),
      observeStatus: () => NO_SUBSCRIPTION,
      storage: unavailable,
    },
    archive: {
      session: () => ({ state: 'no-archive' }),
      observeSession: () => NO_SUBSCRIPTION,
      create: unavailable,
      open: unavailable,
      close: unavailable,
      overview: unavailable,
      verify: unavailable,
      import: unavailable,
      export: unavailable,
      erase: unavailable,
    },
    identity: {
      load: unavailable,
      save: unavailable,
    },
    time: {
      window: unavailable,
      step: unavailable,
      calendarContext: unavailable,
    },
    record: {
      load: unavailable,
      save: unavailable,
      delete: unavailable,
      listObjects: unavailable,
    },
    structured: {
      load: unavailable,
      create: unavailable,
      save: unavailable,
      delete: unavailable,
      convertSpanToEvent: unavailable,
    },
    tracks: {
      list: unavailable,
      load: unavailable,
      create: unavailable,
      save: unavailable,
      delete: unavailable,
      createWithFirstMember: unavailable,
      history: unavailable,
      attachMember: unavailable,
      detachMember: unavailable,
      createMember: unavailable,
    },
    timeline: {
      index: unavailable,
      focus: unavailable,
      structuredDetail: unavailable,
      structuredList: unavailable,
    },
    media: {
      list: unavailable,
      content: unavailable,
      import: unavailable,
      delete: unavailable,
    },
    operations: {
      newStableId: () => FAKE_STABLE_ID,
      newOperationId: () => FAKE_OPERATION_ID,
      requestCancel: unavailable,
      observeChanges: () => NO_SUBSCRIPTION,
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Compile-time surface conformance                                           */
/* -------------------------------------------------------------------------- */

type Assert<Value extends true> = Value

type Equal<Left, Right> =
  (<Probe>() => Probe extends Left ? 1 : 2) extends <
    Probe,
  >() => Probe extends Right ? 1 : 2
    ? true
    : false

type DeclaredMethods = {
  [Area in ClientSurfaceArea]: ClientSurfaceMethod<Area>
}
type InterfaceMethods = {
  [Area in ClientSurfaceArea]: keyof LifeArchiveClient[Area]
}

/** The declared inventory and the interface must match in both directions. */
type SurfaceMatchesInterface = Assert<Equal<DeclaredMethods, InterfaceMethods>>

/** Every client area is declared; the interface has no undeclared area. */
type AreasMatchInterface = Assert<
  Equal<ClientSurfaceArea, keyof LifeArchiveClient>
>

const surfaceMatchesInterface: SurfaceMatchesInterface = true
const areasMatchInterface: AreasMatchInterface = true

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe('client surface', () => {
  it('matches the declared inventory at compile time', () => {
    expect(surfaceMatchesInterface).toBe(true)
    expect(areasMatchInterface).toBe(true)
  })

  it('matches the declared inventory at run time', () => {
    const client = createFakeClient()
    const actual = Object.entries(client)
      .flatMap(([area, surface]) =>
        Object.keys(surface as Record<string, unknown>).map(
          (method) => `${area}.${method}`,
        ),
      )
      .sort()
    expect(actual).toEqual(describeClientSurface())
  })

  it('exposes no excluded area', () => {
    const client = createFakeClient()
    const areas = Object.keys(client)
    for (const excluded of EXCLUDED_SURFACE_AREAS) {
      expect(areas).not.toContain(excluded)
    }
  })

  it('keeps every declared area non-empty and free of duplicates', () => {
    for (const [area, methods] of Object.entries(CLIENT_SURFACE)) {
      expect(methods.length, area).toBeGreaterThan(0)
      expect(new Set(methods).size, area).toBe(methods.length)
    }
    const paths = describeClientSurface()
    expect(new Set(paths).size).toBe(paths.length)
  })
})

describe('client results', () => {
  it('reports unavailability as a value, never a thrown error', async () => {
    const client = createFakeClient()
    const result = await client.archive.open()
    expect(isOk(result)).toBe(false)
    if (result.status === 'failed') {
      expect(result.failure.area).toBe('transport')
      expect(result.failure.retryable).toBe(false)
      expect(result.failure.durableOutcome).toBe('not-started')
      expect(failureKey(result.failure)).toBe('transport.closed')
    }
  })

  it('carries stable context and no display text on a failure', () => {
    const failure = clientFailure({
      area: 'record',
      code: 'revisionConflict',
      phase: 'mutation',
      retryable: false,
      field: 'expectedRevision',
      subject: { kind: 'entry', id: FAKE_STABLE_ID },
      expectedRevision: revision('7'),
      actualRevision: revision('8'),
      cause: { code: 'storeReadFailed', field: 'entryId' },
    })
    expect(Object.keys(failure).sort()).toEqual([
      'actualRevision',
      'area',
      'cause',
      'cleanup',
      'code',
      'durableOutcome',
      'expectedRevision',
      'field',
      'phase',
      'retryable',
      'subject',
    ])
    expect(failureKey(failure)).toBe('record.revisionConflict')
    expect(failure.cleanup).toBeNull()
    expect(failure.expectedRevision).toBe(revision('7'))
    expect(failure.actualRevision).toBe(revision('8'))
    expect(failure.cause).toEqual({
      code: 'storeReadFailed',
      field: 'entryId',
    })
  })

  it('wraps a success without reinterpreting it', () => {
    const result = ok({ outcome: 'erased' as const })
    expect(isOk(result)).toBe(true)
    expect(result.status === 'ok' && result.value.outcome).toBe('erased')
  })

  it('mints identifiers the caller can attach to a new object', () => {
    const client = createFakeClient()
    expect(client.operations.newStableId()).toBe(FAKE_STABLE_ID)
    expect(client.operations.newOperationId()).toBe(FAKE_OPERATION_ID)
  })
})
