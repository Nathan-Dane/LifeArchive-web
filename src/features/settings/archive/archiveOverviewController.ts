import { useCallback, useEffect, useState } from 'react'
import type {
  ArchiveIdentityState,
  ArchiveOverview,
  ClientResult,
  LifeArchiveClient,
} from '../../../core/client'
import {
  browserStoragePersistence,
  type StoragePersistence,
} from '../../../platform/storage'
import {
  readArchiveStorageFacts,
  type ArchiveStorageFacts,
} from './storageFactsAdapter'

export type ArchiveFact<Value> =
  | { readonly status: 'loading' }
  | { readonly status: 'available'; readonly value: Value }
  | { readonly status: 'unavailable' }

export interface ArchiveOverviewState {
  readonly overview: ArchiveFact<ArchiveOverview>
  readonly identity: ArchiveFact<ArchiveIdentityState>
  readonly storage: ArchiveFact<ArchiveStorageFacts>
}

const LOADING_STATE: ArchiveOverviewState = {
  overview: { status: 'loading' },
  identity: { status: 'loading' },
  storage: { status: 'loading' },
}

function fact<Value>(result: ClientResult<Value>): ArchiveFact<Value> {
  return result.status === 'ok'
    ? { status: 'available', value: result.value }
    : { status: 'unavailable' }
}

async function readFact<Value>(
  read: () => Promise<ClientResult<Value>>,
): Promise<ArchiveFact<Value>> {
  try {
    return fact(await read())
  } catch {
    return { status: 'unavailable' }
  }
}

export function useArchiveOverview(
  client: LifeArchiveClient,
  persistence: StoragePersistence = browserStoragePersistence,
) {
  const [state, setState] = useState<ArchiveOverviewState>(LOADING_STATE)
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => {
    setState(LOADING_STATE)
    setAttempt((value) => value + 1)
  }, [])

  useEffect(() => {
    let current = true
    void Promise.all([
      readFact(() => client.archive.overview()),
      readFact(() => client.identity.load()),
      readArchiveStorageFacts(client, persistence)
        .then((value): ArchiveFact<ArchiveStorageFacts> => ({
          status: 'available',
          value,
        }))
        .catch((): ArchiveFact<ArchiveStorageFacts> => ({
          status: 'unavailable',
        })),
    ]).then(([overview, identity, storage]) => {
      if (current) setState({ overview, identity, storage })
    })
    return () => {
      current = false
    }
  }, [attempt, client, persistence])

  return { state, retry }
}
