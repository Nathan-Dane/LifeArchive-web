import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BROWSER_PREFERENCE_STORAGE_KEYS,
  BrowserPreferenceStore,
  DEFAULT_BROWSER_PREFERENCES,
  PREFERENCE_ATTRIBUTES,
  readBrowserPreferences,
} from './browserPreferences'

const refusing: Storage = {
  get length(): number {
    throw new Error('storage unavailable')
  },
  clear: () => {
    throw new Error('storage unavailable')
  },
  getItem: () => {
    throw new Error('storage unavailable')
  },
  key: () => {
    throw new Error('storage unavailable')
  },
  removeItem: () => {
    throw new Error('storage unavailable')
  },
  setItem: () => {
    throw new Error('storage unavailable')
  },
}

beforeEach(() => {
  globalThis.localStorage.clear()
  for (const attribute of Object.values(PREFERENCE_ATTRIBUTES)) {
    document.documentElement.removeAttribute(attribute)
  }
})

describe('browser preferences', () => {
  it('loads the complete defaults when nothing was stored', () => {
    expect(readBrowserPreferences()).toEqual(DEFAULT_BROWSER_PREFERENCES)
  })

  it('persists changed values and restores them in a new store', () => {
    const store = new BrowserPreferenceStore()
    store.set('theme', 'dark')
    store.set('headingFont', 'system')
    store.set('writingFont', 'system')
    store.set('accentColour', 'plum')
    store.set('dateFormat', 'day-month-year')
    store.set('weekStartsOn', 'monday')
    store.set('openAppTo', 'last')
    store.set('lastOpenedPage', 'timeline')
    store.set('recordInitialScale', 'month')
    store.set('limitTimelineScrolling', false)

    expect(new BrowserPreferenceStore().getSnapshot()).toEqual({
      theme: 'dark',
      headingFont: 'system',
      writingFont: 'system',
      accentColour: 'plum',
      dateFormat: 'day-month-year',
      weekStartsOn: 'monday',
      openAppTo: 'last',
      lastOpenedPage: 'timeline',
      recordInitialScale: 'month',
      limitTimelineScrolling: false,
    })
  })

  it('falls back per field when persisted values are invalid', () => {
    for (const key of Object.values(BROWSER_PREFERENCE_STORAGE_KEYS)) {
      globalThis.localStorage.setItem(key, 'not-a-valid-value')
    }
    expect(readBrowserPreferences()).toEqual(DEFAULT_BROWSER_PREFERENCES)
  })

  it('survives browser storage being unavailable', () => {
    const store = new BrowserPreferenceStore({ storage: refusing })
    expect(() => store.set('accentColour', 'sage')).not.toThrow()
    expect(store.getSnapshot().accentColour).toBe('sage')
    expect(readBrowserPreferences(refusing)).toEqual(
      DEFAULT_BROWSER_PREFERENCES,
    )
  })

  it('updates subscribers and document attributes immediately', () => {
    const store = new BrowserPreferenceStore({ storage: null })
    const listener = vi.fn()
    store.subscribe(listener)

    store.set('headingFont', 'system')
    store.set('writingFont', 'system')
    store.set('accentColour', 'blue')

    expect(listener).toHaveBeenCalledTimes(3)
    expect(
      document.documentElement.getAttribute(PREFERENCE_ATTRIBUTES.headingFont),
    ).toBe('system')
    expect(
      document.documentElement.getAttribute(PREFERENCE_ATTRIBUTES.writingFont),
    ).toBe('system')
    expect(
      document.documentElement.getAttribute(PREFERENCE_ATTRIBUTES.accentColour),
    ).toBe('blue')
  })

  it('resets only LifeArchive interface keys', () => {
    globalThis.localStorage.setItem('another.application', 'preserved')
    const store = new BrowserPreferenceStore()
    store.set('theme', 'dark')
    store.set('recordInitialScale', 'year')
    store.reset()

    expect(store.getSnapshot()).toEqual(DEFAULT_BROWSER_PREFERENCES)
    for (const key of Object.values(BROWSER_PREFERENCE_STORAGE_KEYS)) {
      expect(globalThis.localStorage.getItem(key)).toBeNull()
    }
    expect(globalThis.localStorage.getItem('another.application')).toBe(
      'preserved',
    )
  })
})
