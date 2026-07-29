/**
 * The appearance preference: light, dark, or whatever the reader's system
 * asks for.
 *
 * This is presentation only. It is the one kind of value the architecture
 * allows in `localStorage`, and it stays that way: nothing here reads or
 * writes anything about an archive, and losing the stored value costs the
 * reader one click, not one word of writing.
 *
 * The preference is applied as a `data-appearance` attribute on the document
 * element, which narrows `color-scheme` and re-resolves every `light-dark()`
 * token pair. Absence of the attribute is the same as `system`, so the page is
 * correct before this module runs at all.
 */

import {
  BROWSER_PREFERENCE_STORAGE_KEYS,
  DEFAULT_BROWSER_PREFERENCES,
  PREFERENCE_ATTRIBUTES,
  THEME_PREFERENCES,
  browserPreferenceStorage,
  isThemePreference,
  readBrowserPreferences,
  storeBrowserPreference,
  type ThemePreference,
} from '../../features/settings/preferences'

export const APPEARANCE_PREFERENCES = THEME_PREFERENCES

export type AppearancePreference = ThemePreference

/** The preference used until the reader chooses one. */
export const DEFAULT_APPEARANCE: AppearancePreference =
  DEFAULT_BROWSER_PREFERENCES.theme

/** Namespaced so a self-hosted origin can hold other applications too. */
export const APPEARANCE_STORAGE_KEY = BROWSER_PREFERENCE_STORAGE_KEYS.theme

export const APPEARANCE_ATTRIBUTE = PREFERENCE_ATTRIBUTES.theme

export function isAppearancePreference(
  value: unknown,
): value is AppearancePreference {
  return isThemePreference(value)
}

/**
 * The storage the preference lives in, or `null` when the browser refuses it.
 * Private windows and blocked third-party storage both throw on access rather
 * than returning undefined, and an appearance preference is never worth an
 * unhandled error.
 */
export function appearanceStorage(): Storage | null {
  return browserPreferenceStorage()
}

export function readStoredAppearance(
  storage: Storage | null = appearanceStorage(),
): AppearancePreference {
  return readBrowserPreferences(storage).theme
}

export function storeAppearance(
  appearance: AppearancePreference,
  storage: Storage | null = appearanceStorage(),
): void {
  storeBrowserPreference('theme', appearance, storage)
}

/** The order the appearance control cycles through. */
export function nextAppearance(
  appearance: AppearancePreference,
): AppearancePreference {
  const index = APPEARANCE_PREFERENCES.indexOf(appearance)
  return (
    APPEARANCE_PREFERENCES[(index + 1) % APPEARANCE_PREFERENCES.length] ??
    DEFAULT_APPEARANCE
  )
}

/** Writes the preference where the stylesheet can see it. */
export function applyAppearance(
  appearance: AppearancePreference,
  element: HTMLElement | null = globalThis.document?.documentElement ?? null,
): void {
  element?.setAttribute(APPEARANCE_ATTRIBUTE, appearance)
}
