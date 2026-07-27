import { createContext, useContext } from 'react'
import { DEFAULT_APPEARANCE, type AppearancePreference } from './appearance'

export interface AppearanceValue {
  readonly appearance: AppearancePreference
  readonly setAppearance: (appearance: AppearancePreference) => void
}

/**
 * A component rendered without the provider — one under test, one inside an
 * error boundary that caught mid-tree — still reads a sensible preference and
 * simply cannot change it.
 */
const FALLBACK: AppearanceValue = Object.freeze({
  appearance: DEFAULT_APPEARANCE,
  setAppearance: () => undefined,
})

export const AppearanceContext = createContext<AppearanceValue | null>(null)

export function useAppearance(): AppearanceValue {
  return useContext(AppearanceContext) ?? FALLBACK
}
