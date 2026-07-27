import { useCallback, useRef, useState } from 'react'
import {
  clientFailure,
  failed,
  type ArchiveEraseResult,
  type ArchiveIdentityState,
  type ArchiveOverview,
  type ClientFailure,
  type ClientResult,
  type LifeArchiveClient,
} from '../../../core/client'

export type ArchiveEraseState =
  | { readonly phase: 'ready' | 'confirming' | 'erasing' }
  | { readonly phase: 'failed'; readonly failure: ClientFailure }
  | { readonly phase: 'refreshing'; readonly result: ArchiveEraseResult }
  | { readonly phase: 'refresh-failed'; readonly result: ArchiveEraseResult }
  | {
      readonly phase: 'complete'
      readonly result: ArchiveEraseResult
      readonly overview: ArchiveOverview
      readonly identity: ArchiveIdentityState
    }

interface FreshArchive {
  readonly overview: ArchiveOverview
  readonly identity: ArchiveIdentityState
}

function thrownEraseFailure(): ClientFailure {
  return clientFailure({
    area: 'transport',
    code: 'eraseOutcomeUnknown',
    phase: 'transport',
    retryable: false,
    durableOutcome: 'unknown',
  })
}

async function readFreshArchive(
  client: LifeArchiveClient,
  erase: ArchiveEraseResult,
): Promise<FreshArchive | null> {
  try {
    const [overview, identity] = await Promise.all([
      client.archive.overview(),
      client.identity.load(),
    ])
    if (overview.status !== 'ok' || identity.status !== 'ok') return null
    const invalidationMatches =
      overview.value.invalidation.storeInstanceId ===
        erase.invalidation.storeInstanceId &&
      overview.value.invalidation.revision === erase.invalidation.revision &&
      identity.value.invalidation.storeInstanceId ===
        erase.invalidation.storeInstanceId &&
      identity.value.invalidation.revision === erase.invalidation.revision
    const empty =
      overview.value.visibleEntryCount === 0 &&
      overview.value.structuredCounts.events === 0 &&
      overview.value.structuredCounts.spans === 0 &&
      overview.value.trackCounts.active === 0 &&
      overview.value.trackCounts.archived === 0 &&
      overview.value.trackCounts.ongoingMembers === 0 &&
      overview.value.mediaCount === 0
    return invalidationMatches && empty
      ? { overview: overview.value, identity: identity.value }
      : null
  } catch {
    return null
  }
}

/**
 * Runs exactly one coordinated core erase after an explicit confirmation.
 * Post-success reads are presentation refreshes, never a second erase or a
 * frontend attempt to create an empty archive.
 */
export function useArchiveErase(client: LifeArchiveClient) {
  const [state, setState] = useState<ArchiveEraseState>({ phase: 'ready' })
  const running = useRef(false)

  const requestConfirmation = useCallback(() => {
    if (!running.current) setState({ phase: 'confirming' })
  }, [])

  const cancelConfirmation = useCallback(() => {
    if (!running.current) setState({ phase: 'ready' })
  }, [])

  const refresh = useCallback(
    async (result: ArchiveEraseResult) => {
      setState({ phase: 'refreshing', result })
      const fresh = await readFreshArchive(client, result)
      if (fresh) {
        setState({ phase: 'complete', result, ...fresh })
      } else {
        setState({ phase: 'refresh-failed', result })
      }
    },
    [client],
  )

  const confirm = useCallback(async () => {
    if (running.current || state.phase !== 'confirming') return
    running.current = true
    setState({ phase: 'erasing' })
    let result: ClientResult<ArchiveEraseResult>
    try {
      result = await client.archive.erase({
        confirmation: 'erase-this-archive',
      })
    } catch {
      result = failed(thrownEraseFailure())
    }
    running.current = false

    if (result.status === 'ok') {
      await refresh(result.value)
    } else {
      setState({ phase: 'failed', failure: result.failure })
    }
  }, [client, refresh, state.phase])

  const retryRefresh = useCallback(() => {
    if (state.phase === 'refresh-failed') void refresh(state.result)
  }, [refresh, state])

  return {
    state,
    requestConfirmation,
    cancelConfirmation,
    confirm,
    retryRefresh,
  }
}
