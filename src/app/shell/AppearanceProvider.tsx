import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  applyAppearance,
  readStoredAppearance,
  storeAppearance,
  type AppearancePreference,
} from './appearance'
import { AppearanceContext } from './appearanceContext'

export interface AppearanceProviderProps {
  readonly children: ReactNode
  /** Test seam: the preference to start from, instead of the stored one. */
  readonly initialAppearance?: AppearancePreference
}

/**
 * Owns the appearance preference for the application.
 *
 * The document attribute is written during the first render rather than in an
 * effect, so the page never paints one appearance and then the other.
 */
export function AppearanceProvider({
  children,
  initialAppearance,
}: AppearanceProviderProps) {
  const [appearance, setStoredAppearance] = useState<AppearancePreference>(
    () => {
      const initial = initialAppearance ?? readStoredAppearance()
      applyAppearance(initial)
      return initial
    },
  )

  const setAppearance = useCallback((next: AppearancePreference) => {
    setStoredAppearance(next)
    applyAppearance(next)
    storeAppearance(next)
  }, [])

  const value = useMemo(
    () => ({ appearance, setAppearance }),
    [appearance, setAppearance],
  )

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  )
}
