import { useCallback } from 'react'
import { useBrowserPreferences } from '../../features/settings/preferences'
import type { AppearancePreference } from './appearance'

export interface AppearanceValue {
  readonly appearance: AppearancePreference
  readonly setAppearance: (appearance: AppearancePreference) => void
}

export function useAppearance(): AppearanceValue {
  const { preferences, setPreference } = useBrowserPreferences()
  const setAppearance = useCallback(
    (appearance: AppearancePreference) => setPreference('theme', appearance),
    [setPreference],
  )
  return { appearance: preferences.theme, setAppearance }
}
