/**
 * First run: asking the browser to keep this origin's data, then asking the
 * runtime to create the one local archive.
 *
 * The order matters. Persistence is requested *before* anything durable
 * exists, so a refusal can be stated while the reader still has a choice to
 * make, rather than discovered after their writing is already in a store the
 * browser may clear. A refusal is not a runtime failure and never blocks
 * creation — it changes what the reader is told, and adds one deliberate
 * confirmation.
 *
 * What this controller does not do:
 *
 * - it never creates an archive the runtime did not confirm. `created` is
 *   reached only when `archive.create` answers with a value, which is after
 *   the runtime has finished its own root validation, recovery, migration, and
 *   integrity work. There is no optimistic "ready";
 * - it decides no storage fact. Durability comes from the runtime's own
 *   report and the grant and estimate come from the browser;
 * - it never turns a failed create into an empty replacement, a retry loop, or
 *   a second attempt the reader did not ask for.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ClientFailure,
  LifeArchiveClient,
  PersistenceGrant,
  RuntimeStatus,
  StorageDurability,
  StorageEstimate,
} from '../../../core/client'
import {
  browserStoragePersistence,
  type StoragePersistence,
} from '../../../platform/storage'

/**
 * `storage-limited` is the browser's answer, not an error state: the runtime
 * has not been asked for anything at this point.
 */
export type FirstRunPhase =
  | 'offering'
  | 'requesting-storage'
  | 'storage-limited'
  | 'creating'
  | 'created'
  | 'locked'
  | 'failed'

export interface FirstRunState {
  readonly phase: FirstRunPhase
  /** The browser's answer, once it has given one. */
  readonly grant: PersistenceGrant | null
  /** The runtime's own durability report, absent until it reports one. */
  readonly durability: StorageDurability | null
  /** The browser's approximate figures, absent when it gives none. */
  readonly estimate: StorageEstimate | null
  readonly failure: ClientFailure | null
}

export interface FirstRunController {
  readonly state: FirstRunState
  /** Requests persistence, then creates when the browser agrees. */
  readonly begin: () => void
  /** Creates after the browser declined or could not answer. */
  readonly createAnyway: () => void
  /** Resumes wherever the attempt stopped, without repeating a granted ask. */
  readonly retry: () => void
}

export interface FirstRunOptions {
  readonly client: LifeArchiveClient
  /** Called once the runtime has confirmed the new archive. */
  readonly onCreated: () => void
  readonly persistence?: StoragePersistence
}

/**
 * The failure the browser lock adapter reports when another tab already owns
 * the root. It is ownership, not corruption, so it gets its own state.
 */
const ALREADY_OWNED = 'storeAlreadyOpen'

function durabilityOf(status: RuntimeStatus): StorageDurability | null {
  return status.state === 'available' ? status.runtime.durability : null
}

export function useFirstRun({
  client,
  onCreated,
  persistence = browserStoragePersistence,
}: FirstRunOptions): FirstRunController {
  const [phase, setPhase] = useState<FirstRunPhase>('offering')
  const [grant, setGrant] = useState<PersistenceGrant | null>(null)
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null)
  const [failure, setFailure] = useState<ClientFailure | null>(null)
  const [runtime, setRuntime] = useState<RuntimeStatus>(() =>
    client.runtime.status(),
  )

  /* Held in a ref so navigating on success does not change the callbacks. */
  const created = useRef(onCreated)
  useEffect(() => {
    created.current = onCreated
  })

  /* One attempt at a time: a second press must not open a second store. */
  const running = useRef(false)

  useEffect(() => client.runtime.observeStatus(setRuntime), [client])

  useEffect(() => {
    let current = true
    void persistence.estimate().then((value) => {
      if (current) setEstimate(value)
    })
    return () => {
      current = false
    }
  }, [persistence])

  const create = useCallback(async (): Promise<void> => {
    setPhase('creating')
    const result = await client.archive.create()
    if (result.status === 'ok') {
      setFailure(null)
      setPhase('created')
      created.current()
      return
    }
    setFailure(result.failure)
    setPhase(
      result.failure.code === ALREADY_OWNED ||
        client.archive.session().state === 'open-in-another-tab'
        ? 'locked'
        : 'failed',
    )
  }, [client])

  const run = useCallback((attempt: () => Promise<void>) => {
    if (running.current) return
    running.current = true
    void attempt().finally(() => {
      running.current = false
    })
  }, [])

  const begin = useCallback(() => {
    run(async () => {
      setPhase('requesting-storage')
      const answer = await persistence.request()
      setGrant(answer)
      if (answer === 'granted') {
        await create()
        return
      }
      setPhase('storage-limited')
    })
  }, [create, persistence, run])

  const createAnyway = useCallback(() => run(create), [create, run])

  /*
   * A retry after a failed create must not re-prompt someone who has already
   * answered the browser's permission question.
   */
  const retry = useCallback(() => {
    if (grant === null) {
      begin()
      return
    }
    createAnyway()
  }, [begin, createAnyway, grant])

  return {
    state: {
      phase,
      grant,
      durability: durabilityOf(runtime),
      estimate,
      failure,
    },
    begin,
    createAnyway,
    retry,
  }
}
