import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from 'react'
import {
  BrowserPreferenceStore,
  type BrowserPreferenceKey,
  type BrowserPreferences,
} from './browserPreferences'

export const BrowserPreferencesContext =
  createContext<BrowserPreferenceStore | null>(null)

const FALLBACK_STORE = new BrowserPreferenceStore({
  storage: null,
})

export interface BrowserPreferencesValue {
  readonly preferences: BrowserPreferences
  readonly setPreference: <Key extends BrowserPreferenceKey>(
    key: Key,
    value: BrowserPreferences[Key],
  ) => void
  readonly resetPreferences: () => void
}

export function useBrowserPreferences(): BrowserPreferencesValue {
  const store = useContext(BrowserPreferencesContext) ?? FALLBACK_STORE
  const preferences = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  )
  const setPreference = useCallback(
    <Key extends BrowserPreferenceKey>(
      key: Key,
      value: BrowserPreferences[Key],
    ) => store.set(key, value),
    [store],
  )
  const resetPreferences = useCallback(() => store.reset(), [store])
  return { preferences, setPreference, resetPreferences }
}
