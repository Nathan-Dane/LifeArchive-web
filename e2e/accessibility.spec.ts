import { expect, horizontalOverflow, test } from './client-fixtures'

test.describe('client accessibility foundations', () => {
  test('reaches main content before shell controls', async ({
    page,
    browserName,
  }) => {
    await page.goto('/record')

    /*
     * Safari follows macOS Full Keyboard Access: Option+Tab includes links
     * when the system's plain Tab setting includes controls only.
     */
    await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab')
    const skip = page.getByRole('link', { name: 'Skip to main content' })
    await expect(skip).toBeFocused()
    await skip.press('Enter')
    await expect(page.locator('main#main-content')).toBeFocused()
  })

  test('honours reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/record')

    expect(
      await page.evaluate(
        () => matchMedia('(prefers-reduced-motion: reduce)').matches,
      ),
    ).toBe(true)
    const duration = await page
      .getByRole('button', { name: /^Appearance: / })
      .evaluate((element) => getComputedStyle(element).transitionDuration)
    expect(duration).toBe('0.001s')
  })

  test('preserves focus in forced-colour themes', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' })
    await page.goto('/record')
    const appearance = page.getByRole('button', { name: /^Appearance: / })
    await appearance.focus()

    expect(
      await page.evaluate(() => matchMedia('(forced-colors: active)').matches),
    ).toBe(true)
    const outline = await appearance.evaluate((element) => {
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
    await expect(
      page.getByRole('button', { name: /^Appearance: / }),
    ).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  })
})
