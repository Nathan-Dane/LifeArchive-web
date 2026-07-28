import { chromium, firefox } from '@playwright/test'
import { expect, test } from './qualified-browser-fixtures'

const LOCAL_RUNTIME_URL = 'http://localhost:4187/record'
const ENABLED = process.env.LIFEARCHIVE_LOCAL_RUNTIME_E2E === '1'

/**
 * Opt-in, machine-local development evidence only.
 *
 * The explicit local-runtime selection reads the ignored verification receipt
 * and checksum-qualified artifact through the local origin. The browser still
 * verifies the whole artifact, manifest, and payloads before instantiation.
 * This does not change the production lock or establish reproducible
 * production acceptance.
 */
test.describe('verified local development runtime', () => {
  test.skip(
    !ENABLED,
    'install a local runtime and set VITE_LIFEARCHIVE_CLIENT=local-runtime plus LIFEARCHIVE_LOCAL_RUNTIME_E2E=1',
  )

  test('instantiates and negotiates before exposing first run', async ({
    page,
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto(LOCAL_RUNTIME_URL)

    await expect(
      page.getByRole('heading', { name: 'Create your local archive' }),
    ).toBeVisible({ timeout: 20_000 })
    await expect(
      page.getByText(
        'The runtime reports durable local storage for this archive.',
      ),
    ).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  test('uses real core time navigation and restores its cursor', async ({
    page,
  }) => {
    const pageErrors: string[] = []
    const consoleErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    await page.addInitScript(() => {
      Object.defineProperty(navigator.storage, 'persist', {
        configurable: true,
        value: () => Promise.resolve(true),
      })
    })
    await page.goto(LOCAL_RUNTIME_URL)
    await page.getByRole('button', { name: 'Create archive' }).click()

    const navigation = page.getByRole('navigation', {
      name: 'Time',
    })
    const createAnyway = page.getByRole('button', {
      name: 'Create archive anyway',
    })
    await expect(navigation.or(createAnyway)).toBeVisible({ timeout: 20_000 })
    if (await createAnyway.isVisible()) await createAnyway.click()
    await expect(navigation).toBeVisible({ timeout: 20_000 })
    await expect(
      page.getByRole('heading', { name: 'Time navigation is unavailable' }),
    ).toHaveCount(0)

    for (const scale of ['Day', 'Week', 'Month', 'Year']) {
      await page.getByRole('button', { name: scale, exact: true }).click()
      await expect(
        page.getByRole('button', { name: scale, exact: true }),
      ).toHaveAttribute('aria-pressed', 'true')
    }

    await page.getByRole('button', { name: 'Previous year' }).click()
    await expect(
      page.getByRole('button', { name: 'Previous year' }),
    ).toBeEnabled()
    await page.getByRole('button', { name: 'Next year' }).click()
    await page.getByRole('button', { name: 'Today', exact: true }).click()

    await page
      .getByRole('button', { name: 'Show the surrounding month' })
      .click()
    await expect(
      page.getByRole('group', { name: 'Month around the selected date' }),
    ).toBeVisible()

    const location = await page
      .locator('.record-navigation__location')
      .innerText()
    await page.reload()
    await expect(
      page.getByRole('button', { name: 'Year', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.record-navigation__location')).toHaveText(
      location,
    )
    await expect(
      page.getByRole('heading', { name: 'Time navigation is unavailable' }),
    ).toHaveCount(0)
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('preserves exact ordinary writing through reload and archive reopen', async ({
    context,
    page,
  }) => {
    const writing = 'Café  日本語\tpreserved'
    const pageErrors: string[] = []
    const consoleErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    await page.addInitScript(() => {
      Object.defineProperty(navigator.storage, 'persist', {
        configurable: true,
        value: () => Promise.resolve(true),
      })
    })
    await page.goto(LOCAL_RUNTIME_URL)
    await page.getByRole('button', { name: 'Create archive' }).click()

    const editor = page.getByRole('textbox', { name: 'Writing editor' })
    const createAnyway = page.getByRole('button', {
      name: 'Create archive anyway',
    })
    await expect(editor.or(createAnyway)).toBeVisible({ timeout: 20_000 })
    if (await createAnyway.isVisible()) await createAnyway.click()
    await expect(editor).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Ready to save.')).toBeVisible()

    await editor.fill(writing)
    await expect(page.getByText('Saved.')).toBeVisible()

    await page.reload()
    const reloadedEditor = page.getByRole('textbox', {
      name: 'Writing editor',
    })
    await expect
      .poll(() => reloadedEditor.evaluate((element) => element.textContent))
      .toBe(writing)

    await page.close()
    const reopened = await context.newPage()
    await reopened.goto(LOCAL_RUNTIME_URL)
    const reopenedEditor = reopened.getByRole('textbox', {
      name: 'Writing editor',
    })
    await expect
      .poll(() => reopenedEditor.evaluate((element) => element.textContent), {
        timeout: 20_000,
      })
      .toBe(writing)
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  })

  test('preserves ordinary writing through a full browser-process restart', async ({
    browserName,
  }, testInfo) => {
    const writing = 'Restart proof: Café  日本語'
    const browserType = browserName === 'firefox' ? firefox : chromium
    const profile = testInfo.outputPath('ordinary-restart-profile')
    let persistent = await browserType.launchPersistentContext(profile)
    try {
      let page = persistent.pages()[0] ?? (await persistent.newPage())
      await page.addInitScript(() => {
        Object.defineProperty(navigator.storage, 'persist', {
          configurable: true,
          value: () => Promise.resolve(true),
        })
      })
      await page.goto(LOCAL_RUNTIME_URL)
      await page.getByRole('button', { name: 'Create archive' }).click()
      const createAnyway = page.getByRole('button', {
        name: 'Create archive anyway',
      })
      const editor = page.getByRole('textbox', { name: 'Writing editor' })
      await expect(editor.or(createAnyway)).toBeVisible({ timeout: 20_000 })
      if (await createAnyway.isVisible()) await createAnyway.click()
      await editor.fill(writing)
      await expect(page.getByText('Saved.')).toBeVisible()

      await persistent.close()
      persistent = await browserType.launchPersistentContext(profile)
      page = persistent.pages()[0] ?? (await persistent.newPage())
      await page.goto(LOCAL_RUNTIME_URL)
      const reopenedEditor = page.getByRole('textbox', {
        name: 'Writing editor',
      })
      await expect
        .poll(() => reopenedEditor.evaluate((element) => element.textContent), {
          timeout: 20_000,
        })
        .toBe(writing)
    } finally {
      await persistent.close()
    }
  })
})
