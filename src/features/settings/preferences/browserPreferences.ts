export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const
export const FONT_PREFERENCES = ['serif', 'system'] as const
export const ACCENT_COLOURS = [
  'gold',
  'copper',
  'sage',
  'blue',
  'plum',
] as const
export const WEEK_START_PREFERENCES = ['system', 'monday', 'sunday'] as const
export const OPEN_APP_PREFERENCES = ['record', 'timeline', 'last'] as const
export const DATE_FORMAT_PREFERENCES = [
  'regional',
  'day-month-year',
  'month-day-year',
] as const
export const RECORD_INITIAL_SCALE_PREFERENCES = [
  'last',
  'day',
  'week',
  'month',
  'year',
] as const
export const APP_DESTINATIONS = ['record', 'timeline'] as const

export type ThemePreference = (typeof THEME_PREFERENCES)[number]
export type FontPreference = (typeof FONT_PREFERENCES)[number]
export type AccentColour = (typeof ACCENT_COLOURS)[number]
export type WeekStartPreference = (typeof WEEK_START_PREFERENCES)[number]
export type OpenAppPreference = (typeof OPEN_APP_PREFERENCES)[number]
export type DateFormatPreference = (typeof DATE_FORMAT_PREFERENCES)[number]
export type RecordInitialScalePreference =
  (typeof RECORD_INITIAL_SCALE_PREFERENCES)[number]
export type AppDestination = (typeof APP_DESTINATIONS)[number]

export interface BrowserPreferences {
  readonly theme: ThemePreference
  readonly headingFont: FontPreference
  readonly writingFont: FontPreference
  readonly accentColour: AccentColour
  readonly dateFormat: DateFormatPreference
  readonly weekStartsOn: WeekStartPreference
  readonly openAppTo: OpenAppPreference
  readonly lastOpenedPage: AppDestination
  readonly recordInitialScale: RecordInitialScalePreference
  readonly limitTimelineScrolling: boolean
}

export type BrowserPreferenceKey = keyof BrowserPreferences

export const DEFAULT_BROWSER_PREFERENCES: BrowserPreferences = Object.freeze({
  theme: 'system',
  headingFont: 'serif',
  writingFont: 'serif',
  accentColour: 'gold',
  dateFormat: 'regional',
  weekStartsOn: 'system',
  openAppTo: 'record',
  lastOpenedPage: 'record',
  recordInitialScale: 'last',
  limitTimelineScrolling: true,
})

/**
 * Appearance keeps its established key so an existing choice survives this
 * broader preference source. Every new value lives beside it under one
 * feature-owned namespace.
 */
export const BROWSER_PREFERENCE_STORAGE_KEYS = {
  theme: 'lifearchive.appearance',
  headingFont: 'lifearchive.preferences.headingFont',
  writingFont: 'lifearchive.preferences.writingFont',
  accentColour: 'lifearchive.preferences.accentColour',
  dateFormat: 'lifearchive.preferences.dateFormat',
  weekStartsOn: 'lifearchive.preferences.weekStartsOn',
  openAppTo: 'lifearchive.preferences.openAppTo',
  lastOpenedPage: 'lifearchive.preferences.lastOpenedPage',
  recordInitialScale: 'lifearchive.preferences.recordInitialScale',
  limitTimelineScrolling: 'lifearchive.preferences.limitTimelineScrolling',
} as const satisfies Record<BrowserPreferenceKey, string>

export const PREFERENCE_ATTRIBUTES = {
  theme: 'data-appearance',
  resolvedTheme: 'data-resolved-appearance',
  headingFont: 'data-heading-font',
  writingFont: 'data-writing-font',
  accentColour: 'data-accent-colour',
} as const

const includes = <Value extends string>(
  values: readonly Value[],
  value: unknown,
): value is Value =>
  typeof value === 'string' && (values as readonly string[]).includes(value)

export function isThemePreference(value: unknown): value is ThemePreference {
  return includes(THEME_PREFERENCES, value)
}

function isFontPreference(value: unknown): value is FontPreference {
  return includes(FONT_PREFERENCES, value)
}

function isAccentColour(value: unknown): value is AccentColour {
  return includes(ACCENT_COLOURS, value)
}

function isWeekStartPreference(value: unknown): value is WeekStartPreference {
  return includes(WEEK_START_PREFERENCES, value)
}

function isOpenAppPreference(value: unknown): value is OpenAppPreference {
  return includes(OPEN_APP_PREFERENCES, value)
}

function isDateFormatPreference(value: unknown): value is DateFormatPreference {
  return includes(DATE_FORMAT_PREFERENCES, value)
}

function isRecordInitialScalePreference(
  value: unknown,
): value is RecordInitialScalePreference {
  return includes(RECORD_INITIAL_SCALE_PREFERENCES, value)
}

function isAppDestination(value: unknown): value is AppDestination {
  return includes(APP_DESTINATIONS, value)
}

const VALIDATORS = {
  theme: isThemePreference,
  headingFont: isFontPreference,
  writingFont: isFontPreference,
  accentColour: isAccentColour,
  dateFormat: isDateFormatPreference,
  weekStartsOn: isWeekStartPreference,
  openAppTo: isOpenAppPreference,
  lastOpenedPage: isAppDestination,
  recordInitialScale: isRecordInitialScalePreference,
  limitTimelineScrolling: (value: unknown): value is boolean =>
    value === 'true' || value === 'false',
} as const

export function browserPreferenceStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function readStoredValue<Key extends BrowserPreferenceKey>(
  key: Key,
  storage: Storage | null,
): BrowserPreferences[Key] {
  try {
    const stored = storage?.getItem(BROWSER_PREFERENCE_STORAGE_KEYS[key])
    if (key === 'limitTimelineScrolling') {
      return (
        stored === 'true'
          ? true
          : stored === 'false'
            ? false
            : DEFAULT_BROWSER_PREFERENCES.limitTimelineScrolling
      ) as BrowserPreferences[Key]
    }
    const validates = VALIDATORS[key] as (value: unknown) => boolean
    return validates(stored)
      ? (stored as BrowserPreferences[Key])
      : DEFAULT_BROWSER_PREFERENCES[key]
  } catch {
    return DEFAULT_BROWSER_PREFERENCES[key]
  }
}

export function readBrowserPreferences(
  storage: Storage | null = browserPreferenceStorage(),
): BrowserPreferences {
  return {
    theme: readStoredValue('theme', storage),
    headingFont: readStoredValue('headingFont', storage),
    writingFont: readStoredValue('writingFont', storage),
    accentColour: readStoredValue('accentColour', storage),
    dateFormat: readStoredValue('dateFormat', storage),
    weekStartsOn: readStoredValue('weekStartsOn', storage),
    openAppTo: readStoredValue('openAppTo', storage),
    lastOpenedPage: readStoredValue('lastOpenedPage', storage),
    recordInitialScale: readStoredValue('recordInitialScale', storage),
    limitTimelineScrolling: readStoredValue('limitTimelineScrolling', storage),
  }
}

export function storeBrowserPreference<Key extends BrowserPreferenceKey>(
  key: Key,
  value: BrowserPreferences[Key],
  storage: Storage | null = browserPreferenceStorage(),
): void {
  try {
    storage?.setItem(BROWSER_PREFERENCE_STORAGE_KEYS[key], String(value))
  } catch {
    // The in-memory preference remains active when browser storage is blocked.
  }
}

export function applyBrowserPreferences(
  preferences: BrowserPreferences,
  element: HTMLElement | null = globalThis.document?.documentElement ?? null,
): void {
  element?.setAttribute(PREFERENCE_ATTRIBUTES.theme, preferences.theme)
  element?.setAttribute(
    PREFERENCE_ATTRIBUTES.headingFont,
    preferences.headingFont,
  )
  element?.setAttribute(
    PREFERENCE_ATTRIBUTES.writingFont,
    preferences.writingFont,
  )
  element?.setAttribute(
    PREFERENCE_ATTRIBUTES.accentColour,
    preferences.accentColour,
  )
}

export function applyResolvedTheme(
  theme: ThemePreference,
  systemIsDark: boolean,
  element: HTMLElement | null = globalThis.document?.documentElement ?? null,
): void {
  element?.setAttribute(
    PREFERENCE_ATTRIBUTES.resolvedTheme,
    theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme,
  )
}

type PreferenceListener = () => void

export class BrowserPreferenceStore {
  readonly #storage: Storage | null
  readonly #listeners = new Set<PreferenceListener>()
  #preferences: BrowserPreferences

  constructor({
    storage = browserPreferenceStorage(),
    initial,
  }: {
    readonly storage?: Storage | null
    readonly initial?: Partial<BrowserPreferences>
  } = {}) {
    this.#storage = storage
    this.#preferences = Object.freeze({
      ...readBrowserPreferences(storage),
      ...initial,
    })
  }

  readonly getSnapshot = (): BrowserPreferences => this.#preferences

  readonly subscribe = (listener: PreferenceListener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  set<Key extends BrowserPreferenceKey>(
    key: Key,
    value: BrowserPreferences[Key],
  ): void {
    if (this.#preferences[key] === value) return
    this.#preferences = Object.freeze({ ...this.#preferences, [key]: value })
    storeBrowserPreference(key, value, this.#storage)
    applyBrowserPreferences(this.#preferences)
    for (const listener of this.#listeners) listener()
  }

  reset(): void {
    try {
      for (const key of Object.values(BROWSER_PREFERENCE_STORAGE_KEYS)) {
        this.#storage?.removeItem(key)
      }
    } catch {
      // Reset still applies to this session when browser storage is blocked.
    }
    this.#preferences = DEFAULT_BROWSER_PREFERENCES
    applyBrowserPreferences(this.#preferences)
    for (const listener of this.#listeners) listener()
  }
}
