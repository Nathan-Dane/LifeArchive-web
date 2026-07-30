/**
 * The explicit, development-only `LifeArchiveClient`.
 *
 * It exists so screens can be built while the real persistence proof and the
 * runtime release are still in progress. It implements the whole interface, so
 * feature code cannot tell it apart from the runtime adapter and cannot grow a
 * mock-only path.
 *
 * What it does: answers with the fixed scenario, returns caller-scripted
 * results, and records every call.
 *
 * What it deliberately does not do — because these belong to the core, and a
 * second implementation of them would drift:
 *
 * - no date arithmetic, window traversal, or calendar placement;
 * - no save-conflict policy, empty-entry policy, or merge;
 * - no counting, ordering, or aggregation;
 * - no archive encoding, verification, or checksums;
 * - no persistence of any kind. It touches no browser storage at all and keeps
 *   no draft across a reload.
 *
 * Nothing it returns is durable, and it is never selected automatically. See
 * `developmentOnly.ts` for the two guards that keep it out of production.
 */

import type {
  ArchiveChange,
  ArchiveIdentity,
  ArchiveSession,
  LifeArchiveClient,
  OperationId,
  RuntimeStatus,
  StableId,
  Unsubscribe,
} from '../client'
import { ok } from '../client'
import { MockCallRecorder } from './callRecorder'
import {
  assertDevelopmentBuild,
  currentBuildMode,
  type BuildMode,
} from './developmentOnly'
import {
  DEVELOPMENT_MOCK_SCENARIO,
  type MockResultPath,
  type MockResults,
  type MockScenario,
} from './scenario'

export interface MockClientOptions {
  /** The fixed answers. Defaults to {@link DEVELOPMENT_MOCK_SCENARIO}. */
  readonly scenario?: MockScenario
  /** Injected so the production guard is testable without a real build. */
  readonly buildMode?: BuildMode
  readonly recorder?: MockCallRecorder
}

export class MockLifeArchiveClient implements LifeArchiveClient {
  readonly calls: MockCallRecorder

  private readonly scenario: MockScenario
  private readonly scripted = new Map<MockResultPath, unknown[]>()
  private runtimeState: RuntimeStatus
  private sessionState: ArchiveSession
  private mintedStableIdCount = 0
  private mintedOperationIdCount = 0
  private readonly statusListeners = new Set<(status: RuntimeStatus) => void>()
  private readonly sessionListeners = new Set<
    (session: ArchiveSession) => void
  >()
  private readonly changeListeners = new Set<(change: ArchiveChange) => void>()

  constructor(options: MockClientOptions = {}) {
    assertDevelopmentBuild(options.buildMode ?? currentBuildMode())
    this.scenario = options.scenario ?? DEVELOPMENT_MOCK_SCENARIO
    this.calls = options.recorder ?? new MockCallRecorder()
    this.runtimeState = this.scenario.runtimeStatus
    this.sessionState = this.scenario.archiveSession
  }

  /* ---------------------------------------------------------------------- */
  /* Scripting                                                              */
  /* ---------------------------------------------------------------------- */

  /**
   * Queues one answer for the next call to `path`. Queued answers are consumed
   * in order; once the queue is empty the fixed scenario answers again. A
   * failure, a conflict, and a success are scripted the same way, so no
   * outcome is easier to reach than another.
   */
  script<Path extends MockResultPath>(
    path: Path,
    result: MockResults[Path],
  ): this {
    const queue = this.scripted.get(path)
    if (queue) {
      queue.push(result)
    } else {
      this.scripted.set(path, [result])
    }
    return this
  }

  /** Drops every queued answer, leaving the fixed scenario in place. */
  clearScripts(): void {
    this.scripted.clear()
  }

  /** Pushes an observed runtime status to `runtime.observeStatus` listeners. */
  emitRuntimeStatus(status: RuntimeStatus): void {
    this.runtimeState = status
    for (const listener of [...this.statusListeners]) listener(status)
  }

  /** Pushes an observed session to `archive.observeSession` listeners. */
  emitArchiveSession(session: ArchiveSession): void {
    this.sessionState = session
    for (const listener of [...this.sessionListeners]) listener(session)
  }

  /** Pushes one invalidation hint to `operations.observeChanges` listeners. */
  emitArchiveChange(change: ArchiveChange): void {
    for (const listener of [...this.changeListeners]) listener(change)
  }

  /* ---------------------------------------------------------------------- */
  /* The client surface                                                     */
  /* ---------------------------------------------------------------------- */

  readonly runtime: LifeArchiveClient['runtime'] = {
    status: () => {
      this.calls.record('runtime.status', null)
      return this.runtimeState
    },
    observeStatus: (listener) => {
      this.calls.record('runtime.observeStatus', null)
      return subscribe(this.statusListeners, listener)
    },
    storage: () => this.answer('runtime.storage', null),
  }

  readonly archive: LifeArchiveClient['archive'] = {
    session: () => {
      this.calls.record('archive.session', null)
      return this.sessionState
    },
    observeSession: (listener) => {
      this.calls.record('archive.observeSession', null)
      return subscribe(this.sessionListeners, listener)
    },
    create: () => this.answer('archive.create', null),
    open: () => this.answer('archive.open', null),
    close: () => this.answer('archive.close', null),
    overview: () => this.answer('archive.overview', null),
    verify: (request) => this.answer('archive.verify', request),
    import: (request) => this.answer('archive.import', request),
    export: (request) => this.answer('archive.export', request),
    erase: (request) => this.answer('archive.erase', request),
  }

  readonly identity: LifeArchiveClient['identity'] = {
    load: () => this.answer('identity.load', null),
    save: (identity: ArchiveIdentity) => this.answer('identity.save', identity),
  }

  readonly time: LifeArchiveClient['time'] = {
    window: (request) => {
      const fixed = this.scenario.timeNavigation?.windows[request.scale]
      return this.answer('time.window', request, fixed ? ok(fixed) : undefined)
    },
    step: (request) => {
      const scale = request.window?.scale
      const first = scale
        ? this.scenario.timeNavigation?.steps[scale][request.step]
        : undefined
      const fixed =
        scale && first?.id === request.window.id
          ? (this.scenario.timeNavigation?.outerSteps?.[scale]?.[
              request.step
            ] ?? first)
          : first
      return this.answer('time.step', request, fixed ? ok(fixed) : undefined)
    },
    calendarContext: (request) => this.answer('time.calendarContext', request),
  }

  readonly record: LifeArchiveClient['record'] = {
    load: (window) => this.answer('record.load', window),
    save: (request) => this.answer('record.save', request),
    delete: (request) => this.answer('record.delete', request),
    listObjects: (request) => this.answer('record.listObjects', request),
  }

  readonly structured: LifeArchiveClient['structured'] = {
    load: (request) => this.answer('structured.load', request),
    create: (request) => this.answer('structured.create', request),
    save: (request) => this.answer('structured.save', request),
    delete: (request) => this.answer('structured.delete', request),
    convertSpanToEvent: (request) =>
      this.answer('structured.convertSpanToEvent', request),
  }

  readonly tracks: LifeArchiveClient['tracks'] = {
    list: (request) => this.answer('tracks.list', request),
    load: (id: StableId) => this.answer('tracks.load', id),
    create: (request) => this.answer('tracks.create', request),
    save: (request) => this.answer('tracks.save', request),
    delete: (request) => this.answer('tracks.delete', request),
    createWithFirstMember: (request) =>
      this.answer('tracks.createWithFirstMember', request),
    history: (request) => this.answer('tracks.history', request),
    attachMember: (request) => this.answer('tracks.attachMember', request),
    detachMember: (request) => this.answer('tracks.detachMember', request),
    createMember: (request) => this.answer('tracks.createMember', request),
  }

  readonly timeline: LifeArchiveClient['timeline'] = {
    index: (request) => this.answer('timeline.index', request),
    focus: (request) => this.answer('timeline.focus', request),
    structuredDetail: (request) =>
      this.answer('timeline.structuredDetail', request),
    structuredList: (request) =>
      this.answer('timeline.structuredList', request),
  }

  readonly media: LifeArchiveClient['media'] = {
    list: (request) => this.answer('media.list', request),
    content: (request) => this.answer('media.content', request),
    import: (request) => this.answer('media.import', request),
    delete: (request) => this.answer('media.delete', request),
  }

  readonly operations: LifeArchiveClient['operations'] = {
    newStableId: () => {
      this.calls.record('operations.newStableId', null)
      const ids = this.scenario.mintedStableIds
      const id = ids[this.mintedStableIdCount % ids.length]
      this.mintedStableIdCount += 1
      return id
    },
    newOperationId: () => {
      this.calls.record('operations.newOperationId', null)
      const ids = this.scenario.mintedOperationIds
      const id = ids[this.mintedOperationIdCount % ids.length]
      this.mintedOperationIdCount += 1
      return id
    },
    requestCancel: async (id: OperationId) => {
      const result = await this.answer('operations.requestCancel', id)
      /* The caller's own identifier is echoed back. That is identity, not a
         decision: the outcome still comes from the scenario. */
      return result.status === 'ok'
        ? { status: 'ok', value: { ...result.value, operationId: id } }
        : result
    },
    observeChanges: (listener) => {
      this.calls.record('operations.observeChanges', null)
      return subscribe(this.changeListeners, listener)
    },
  }

  /* ---------------------------------------------------------------------- */
  /* The one answering path                                                 */
  /* ---------------------------------------------------------------------- */

  private answer<Path extends MockResultPath>(
    path: Path,
    request: unknown,
    fixedOverride?: MockResults[Path],
  ): Promise<MockResults[Path]> {
    this.calls.record(path, request)
    const queue = this.scripted.get(path)
    const scripted = queue?.shift()
    const fixed = this.scenario.results as Record<MockResultPath, unknown>
    const result: unknown = scripted ?? fixedOverride ?? fixed[path]
    return Promise.resolve(result) as Promise<MockResults[Path]>
  }
}

function subscribe<Listener>(
  listeners: Set<Listener>,
  listener: Listener,
): Unsubscribe {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
