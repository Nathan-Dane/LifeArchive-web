import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { useMediaQuery } from '../../../accessibility'
import {
  applyBrowserPreferences,
  applyResolvedTheme,
  BrowserPreferenceStore,
  type BrowserPreferences,
} from './browserPreferences'
import { BrowserPreferencesContext } from './browserPreferencesContext'

export interface BrowserPreferencesProviderProps {
  readonly children: ReactNode
  readonly initialPreferences?: Partial<BrowserPreferences>
  readonly storage?: Storage | null
}

export function BrowserPreferencesProvider({
  children,
  initialPreferences,
  storage,
}: BrowserPreferencesProviderProps) {
  const [store] = useState(
    () =>
      new BrowserPreferenceStore({
        storage,
        initial: initialPreferences,
      }),
  )
  const preferences = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  )
  const systemIsDark = useMediaQuery('(prefers-color-scheme: dark)')

  /*
   * As with the previous appearance-only provider, attributes are applied
   * during render so the document does not paint a stale theme or font first.
   * The media-query hook makes the resolved System state observable and keeps
   * it synchronized when the operating system changes.
   */
  applyBrowserPreferences(preferences)
  applyResolvedTheme(preferences.theme, systemIsDark)

  return (
    <BrowserPreferencesContext.Provider value={store}>
      {children}
    </BrowserPreferencesContext.Provider>
  )
}
