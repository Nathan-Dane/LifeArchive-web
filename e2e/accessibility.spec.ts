import { expect, horizontalOverflow, test } from './client-fixtures'

const DEVELOPMENT_MOCK_RECORD_URL = 'http://localhost:4191/record'

test.describe('client accessibility foundations', () => {
  test('reaches main content before shell controls', async ({ page }) => {
    await page.goto('/record')

    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to main content' })
    await expect(skip).toBeFocused()
    await skip.press('Enter')
    await expect(page.locator('main#main-content')).toBeFocused()
  })

  test('honours reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(DEVELOPMENT_MOCK_RECORD_URL)

    expect(
      await page.evaluate(
        () => matchMedia('(prefers-reduced-motion: reduce)').matches,
      ),
    ).toBe(true)
    const duration = await page
      .getByRole('button', { name: 'New event or span' })
      .evaluate((element) => getComputedStyle(element).transitionDuration)
    expect(duration).toBe('0.001s')
  })

  test('preserves focus in forced-colour themes', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' })
    await page.goto('/record')
    const retry = page.getByRole('button', { name: 'Try again' })
    await retry.focus()

    expect(
      await page.evaluate(() => matchMedia('(forced-colors: active)').matches),
    ).toBe(true)
    const outline = await retry.evaluate((element) => {
      const style = getComputedStyle(element)
      return { style: style.outlineStyle, width: style.outlineWidth }
    })
    expect(outline).toEqual({ style: 'solid', width: '3px' })
  })

  test('keeps content operable with large text on a mobile viewport', async ({
    page,
    useClientViewport,
  }) => {
    await useClientViewport('mobile')
    await page.goto('/record')
    await page.addStyleTag({ content: 'html { font-size: 200%; }' })

    await expect(
      page.getByRole('heading', { name: 'LifeArchive cannot start' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  })
})
