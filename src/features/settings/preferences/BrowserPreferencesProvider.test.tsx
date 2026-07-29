import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { setClientMedia } from '../../../test/clientMedia'
import { BrowserPreferencesProvider } from './BrowserPreferencesProvider'
import { PREFERENCE_ATTRIBUTES } from './browserPreferences'

beforeEach(() => {
  globalThis.localStorage.clear()
  for (const attribute of Object.values(PREFERENCE_ATTRIBUTES)) {
    document.documentElement.removeAttribute(attribute)
  }
})

describe('the browser preference provider', () => {
  it('responds to operating-system appearance changes in System mode', () => {
    render(
      <BrowserPreferencesProvider initialPreferences={{ theme: 'system' }}>
        <p>Preferences</p>
      </BrowserPreferencesProvider>,
    )

    expect(
      document.documentElement.getAttribute(
        PREFERENCE_ATTRIBUTES.resolvedTheme,
      ),
    ).toBe('light')

    act(() => setClientMedia('(prefers-color-scheme: dark)'))
    expect(
      document.documentElement.getAttribute(
        PREFERENCE_ATTRIBUTES.resolvedTheme,
      ),
    ).toBe('dark')

    act(() => setClientMedia())
    expect(
      document.documentElement.getAttribute(
        PREFERENCE_ATTRIBUTES.resolvedTheme,
      ),
    ).toBe('light')
  })

  it('keeps an explicit theme independent of system changes', () => {
    setClientMedia('(prefers-color-scheme: dark)')
    render(
      <BrowserPreferencesProvider initialPreferences={{ theme: 'light' }}>
        <p>Preferences</p>
      </BrowserPreferencesProvider>,
    )

    expect(
      document.documentElement.getAttribute(
        PREFERENCE_ATTRIBUTES.resolvedTheme,
      ),
    ).toBe('light')
  })
})
