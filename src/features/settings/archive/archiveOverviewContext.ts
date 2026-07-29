import { createContext, useContext } from 'react'
import type { useArchiveOverview } from './archiveOverviewController'

export type ArchiveOverviewController = ReturnType<typeof useArchiveOverview>

export const ArchiveOverviewContext =
  createContext<ArchiveOverviewController | null>(null)

export function useSharedArchiveOverview(): ArchiveOverviewController | null {
  return useContext(ArchiveOverviewContext)
}
