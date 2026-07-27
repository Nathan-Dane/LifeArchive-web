import { expect, test as base } from '@playwright/test'

const QUALIFIED_MAJOR_VERSION: Readonly<
  Partial<Record<'chromium' | 'firefox' | 'webkit', number>>
> = {
  chromium: 151,
  firefox: 153,
}

/**
 * Browser results are release evidence only for the exact qualified engines.
 * Keep this loud: silently running Playwright's next bundled revision would
 * mislabel a different browser matrix as accepted.
 */
export const test = base.extend<{ qualifiedBrowser: void }>({
  qualifiedBrowser: [
    async ({ browser, browserName }, use) => {
      const expectedMajor = QUALIFIED_MAJOR_VERSION[browserName]
      expect(
        expectedMajor,
        `${browserName} is not in the supported v0.1 browser matrix`,
      ).toBeDefined()

      const actualVersion = browser.version()
      const actualMajor = Number.parseInt(actualVersion.split('.')[0] ?? '', 10)
      expect(
        actualMajor,
        `Expected ${browserName} ${expectedMajor}; Playwright launched ${actualVersion}`,
      ).toBe(expectedMajor)
      await use()
    },
    { auto: true },
  ],
})

export { expect } from '@playwright/test'
