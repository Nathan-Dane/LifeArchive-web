import { beforeEach, describe, expect, it } from 'vitest'
import {
  APPEARANCE_ATTRIBUTE,
  APPEARANCE_PREFERENCES,
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  applyAppearance,
  isAppearancePreference,
  nextAppearance,
  readStoredAppearance,
  storeAppearance,
} from './appearance'

/** A storage that refuses every operation, as a private window can. */
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
  document.documentElement.removeAttribute(APPEARANCE_ATTRIBUTE)
})

describe('the appearance preference', () => {
  it('starts from the system, before anyone has chosen', () => {
    expect(DEFAULT_APPEARANCE).toBe('system')
    expect(readStoredAppearance()).toBe('system')
  })

  it('round-trips every preference through storage', () => {
    for (const appearance of APPEARANCE_PREFERENCES) {
      storeAppearance(appearance)
      expect(readStoredAppearance()).toBe(appearance)
    }
  })

  it('stores the preference under one namespaced key and nothing else', () => {
    storeAppearance('dark')
    expect(Object.keys(globalThis.localStorage)).toEqual([
      APPEARANCE_STORAGE_KEY,
    ])
    expect(globalThis.localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('dark')
  })

  it('ignores a stored value it does not recognise', () => {
    globalThis.localStorage.setItem(APPEARANCE_STORAGE_KEY, 'sepia')
    expect(readStoredAppearance()).toBe('system')
    expect(isAppearancePreference('sepia')).toBe(false)
  })

  it('survives a browser that refuses storage', () => {
    expect(() => storeAppearance('light', refusing)).not.toThrow()
    expect(readStoredAppearance(refusing)).toBe('system')
  })

  it('cycles system, light, dark, and back', () => {
    expect(nextAppearance('system')).toBe('light')
    expect(nextAppearance('light')).toBe('dark')
    expect(nextAppearance('dark')).toBe('system')
  })

  it('writes the preference where the stylesheet can see it', () => {
    applyAppearance('light')
    expect(document.documentElement.getAttribute(APPEARANCE_ATTRIBUTE)).toBe(
      'light',
    )
    applyAppearance('dark')
    expect(document.documentElement.getAttribute(APPEARANCE_ATTRIBUTE)).toBe(
      'dark',
    )
  })
})
