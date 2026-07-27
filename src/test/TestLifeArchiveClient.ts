import type {
  ArchiveSession,
  LifeArchiveClient,
  RuntimeStatus,
} from '../core/client'
import { MockLifeArchiveClient } from '../core/mock/MockLifeArchiveClient'
import { DEVELOPMENT_MOCK_SCENARIO } from '../core/mock/scenario'

const TEST_BUILD = {
  DEV: true,
  PROD: false,
  clientSelection: 'development-mock',
} as const

/**
 * Test convenience around the complete development mock.
 *
 * Tests may choose initial observable state without defining a second,
 * incomplete version of the client contract.
 */
export class TestLifeArchiveClient extends MockLifeArchiveClient {
  readonly client: LifeArchiveClient = this

  constructor(
    session: ArchiveSession,
    runtime: RuntimeStatus = DEVELOPMENT_MOCK_SCENARIO.runtimeStatus,
  ) {
    super({
      buildMode: TEST_BUILD,
      scenario: {
        ...DEVELOPMENT_MOCK_SCENARIO,
        archiveSession: session,
        runtimeStatus: runtime,
      },
    })
  }

  emitRuntime(status: RuntimeStatus): void {
    this.emitRuntimeStatus(status)
  }

  emitSession(session: ArchiveSession): void {
    this.emitArchiveSession(session)
  }

  subscriptionCounts(): { readonly runtime: number; readonly session: number } {
    return {
      runtime: this.calls.countOf('runtime.observeStatus'),
      session: this.calls.countOf('archive.observeSession'),
    }
  }
}
