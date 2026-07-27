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

export const APPEARANCE_PREFERENCES = ['system', 'light', 'dark'] as const

export type AppearancePreference = (typeof APPEARANCE_PREFERENCES)[number]

/** The preference used until the reader chooses one. */
export const DEFAULT_APPEARANCE: AppearancePreference = 'system'

/** Namespaced so a self-hosted origin can hold other applications too. */
export const APPEARANCE_STORAGE_KEY = 'lifearchive.appearance'

export const APPEARANCE_ATTRIBUTE = 'data-appearance'

export function isAppearancePreference(
  value: unknown,
): value is AppearancePreference {
  return (
    typeof value === 'string' &&
    (APPEARANCE_PREFERENCES as readonly string[]).includes(value)
  )
}

/**
 * The storage the preference lives in, or `null` when the browser refuses it.
 * Private windows and blocked third-party storage both throw on access rather
 * than returning undefined, and an appearance preference is never worth an
 * unhandled error.
 */
export function appearanceStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function readStoredAppearance(
  storage: Storage | null = appearanceStorage(),
): AppearancePreference {
  try {
    const stored = storage?.getItem(APPEARANCE_STORAGE_KEY)
    return isAppearancePreference(stored) ? stored : DEFAULT_APPEARANCE
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function storeAppearance(
  appearance: AppearancePreference,
  storage: Storage | null = appearanceStorage(),
): void {
  try {
    storage?.setItem(APPEARANCE_STORAGE_KEY, appearance)
  } catch {
    // A reader who blocks storage still gets the appearance they chose for
    // this session; only the memory of it is lost.
  }
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
