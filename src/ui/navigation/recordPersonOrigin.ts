import { createContext, useContext } from 'react'
import type { StableId } from '../../core/client'

export type RecordPersonRouteMode = 'view' | 'edit'

export type OpenRecordPerson = (
  personId: StableId,
  mode: RecordPersonRouteMode,
  opener: HTMLButtonElement,
) => void

export interface RecordPersonOriginNavigation {
  readonly hasOrigin: boolean
  readonly expiredOrigin: boolean
  readonly openPerson: OpenRecordPerson
  readonly stateForPersonRoute: () => unknown
  readonly returnToRecord: () => boolean
}

export const RecordPersonOriginContext =
  createContext<RecordPersonOriginNavigation>({
    hasOrigin: false,
    expiredOrigin: false,
    openPerson: () => undefined,
    stateForPersonRoute: () => undefined,
    returnToRecord: () => false,
  })

export function useRecordPersonOrigin(): RecordPersonOriginNavigation {
  return useContext(RecordPersonOriginContext)
}
