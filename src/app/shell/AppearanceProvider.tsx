import type { ReactNode } from 'react'
import { BrowserPreferencesProvider } from '../../features/settings/preferences'
import type { AppearancePreference } from './appearance'

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
  return (
    <BrowserPreferencesProvider
      initialPreferences={
        initialAppearance ? { theme: initialAppearance } : undefined
      }
    >
      {children}
    </BrowserPreferencesProvider>
  )
}
