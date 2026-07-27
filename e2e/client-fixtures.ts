import type { Page } from '@playwright/test'
import { test as qualifiedBrowserTest } from './qualified-browser-fixtures'

export const CLIENT_VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 900, height: 900 },
  mobile: { width: 375, height: 812 },
} as const

export type ClientViewport = keyof typeof CLIENT_VIEWPORTS

interface ClientFixtures {
  readonly useClientViewport: (viewport: ClientViewport) => Promise<void>
}

/**
 * Shared real-client fixtures. Tests name an interaction class instead of
 * repeating width literals, keeping breakpoints consistent across engines.
 */
export const test = qualifiedBrowserTest.extend<ClientFixtures>({
  useClientViewport: async ({ page }, provide) => {
    await provide(async (viewport) => {
      await page.setViewportSize(CLIENT_VIEWPORTS[viewport])
    })
  },
})

export { expect } from '@playwright/test'

export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  )
}
