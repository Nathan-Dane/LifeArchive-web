import type { ReactNode } from 'react'
import type { LifeArchiveClient } from '../../../core/client'
import type { StoragePersistence } from '../../../platform/storage'
import { useArchiveOverview } from './archiveOverviewController'
import { ArchiveOverviewContext } from './archiveOverviewContext'

export function ArchiveOverviewProvider({
  children,
  client,
  persistence,
}: {
  readonly children: ReactNode
  readonly client: LifeArchiveClient
  readonly persistence?: StoragePersistence
}) {
  const controller = useArchiveOverview(client, persistence)
  return (
    <ArchiveOverviewContext.Provider value={controller}>
      {children}
    </ArchiveOverviewContext.Provider>
  )
}
