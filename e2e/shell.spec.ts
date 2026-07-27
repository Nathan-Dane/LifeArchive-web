import { expect, test, type Page } from '@playwright/test'

/**
 * The shell in real engines.
 *
 * Only the runtime-unavailable state is reachable in a production build — there
 * is no runtime yet and the development mock cannot be built in — so these
 * tests check what that state proves: the frame, the top bar, the appearance
 * preference, and that the page stays within its viewport at each staged
 * breakpoint. Region staging inside the workspace is asserted in the component
 * tests, because a view that offers regions is not reachable yet.
 *
 * Geometry and computed colour are asserted rather than compared against
 * screenshot baselines: three engines rendering system fonts produce three
 * different images of a correct layout, and a stored image would tell us which
 * pixels moved but not whether anything is legible.
 */

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800, headerRows: 1 },
  { name: 'tablet', width: 900, height: 900, headerRows: 1 },
  { name: 'mobile', width: 375, height: 812, headerRows: 2 },
] as const

function channel(value: number): number {
  const ratio = value / 255
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4
}

function luminance(colour: string): number {
  const [red, green, blue] = colour.match(/[\d.]+/g)!.map(Number)
  return (
    0.2126 * channel(red!) + 0.7152 * channel(green!) + 0.0722 * channel(blue!)
  )
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  )
  return (lighter! + 0.05) / (darker! + 0.05)
}

async function headingColours(
  page: Page,
): Promise<{ readonly text: string; readonly background: string }> {
  return page.evaluate(() => {
    const heading = document.querySelector('h1')!
    return {
      text: getComputedStyle(heading).color,
      background: getComputedStyle(document.body).backgroundColor,
    }
  })
}

test.describe('the application shell', () => {
  for (const viewport of VIEWPORTS) {
    test(`fits its ${viewport.name} viewport`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await page.goto('/record')

      await expect(
        page.getByRole('heading', { name: 'LifeArchive cannot start' }),
      ).toBeVisible()

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)

      /* The top bar gives navigation its own row only on small screens. */
      const header = page.locator('.shell-header')
      const headerHeight = (await header.boundingBox())!.height
      expect(headerHeight).toBeGreaterThan(viewport.headerRows === 1 ? 48 : 90)

      /* The appearance control keeps its name at every width. */
      await expect(
        page.getByRole('button', { name: /^Appearance: / }),
      ).toBeVisible()
    })
  }

  test('switches appearance, stays legible, and remembers the choice', async ({
    page,
  }) => {
    await page.goto('/record')

    const control = page.getByRole('button', { name: /^Appearance: / })
    await expect(control).toHaveAccessibleName('Appearance: System')

    await control.click()
    await expect(page.locator('html')).toHaveAttribute(
      'data-appearance',
      'light',
    )
    const light = await headingColours(page)
    expect(contrast(light.text, light.background)).toBeGreaterThanOrEqual(4.5)

    await control.click()
    await expect(page.locator('html')).toHaveAttribute(
      'data-appearance',
      'dark',
    )
    const dark = await headingColours(page)
    expect(contrast(dark.text, dark.background)).toBeGreaterThanOrEqual(4.5)
    expect(dark.background).not.toBe(light.background)

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute(
      'data-appearance',
      'dark',
    )
    await expect(
      page.getByRole('button', { name: 'Appearance: Dark' }),
    ).toBeVisible()
  })

  test('serves its styles relative to wherever it is hosted', async ({
    page,
  }) => {
    const requests: string[] = []
    page.on('request', (request) => requests.push(request.url()))
    await page.goto('/record')
    await expect(
      page.getByRole('heading', { name: 'LifeArchive cannot start' }),
    ).toBeVisible()

    const origin = new URL(page.url()).origin
    for (const url of requests) {
      expect(url.startsWith(origin), url).toBe(true)
    }
  })
})
