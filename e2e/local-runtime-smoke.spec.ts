import { chromium, firefox } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { expect, test } from './qualified-browser-fixtures'

const LOCAL_RUNTIME_URL = 'http://localhost:4187/record'
const ENABLED =
  process.env.LIFEARCHIVE_RUNTIME_E2E === '1' ||
  process.env.LIFEARCHIVE_LOCAL_RUNTIME_E2E === '1'

/**
 * Opt-in real-runtime evidence for a reviewed hosted pin or verified local
 * development artifact.
 *
 * CI exercises the exact public lock after `runtime:fetch`; local development
 * may instead select the ignored checksum-qualified receipt. In both cases the
 * browser verifies the whole artifact, manifest, and payloads before
 * instantiation.
 */
test.describe('verified runtime integration', () => {
  test.skip(
    !ENABLED,
    'set LIFEARCHIVE_RUNTIME_E2E=1 for a hosted pin, or install a local runtime and select local-runtime',
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
    await expect(page.locator('.record-navigation__week-number')).toHaveText(
      /^W\d{1,2}$/,
    )

    await page.getByRole('button', { name: 'Week', exact: true }).click()
    const weekPeriods = page
      .getByRole('group', { name: 'Periods around the selected period' })
      .getByRole('button')
    await expect(weekPeriods).toHaveCount(5)
    for (const period of await weekPeriods.all()) {
      await expect(period).toHaveText(/^W\d{1,2}$/)
    }

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

    await page.getByRole('button', { name: 'Day', exact: true }).click()
    await page
      .getByRole('button', { name: 'Show the surrounding month' })
      .click()
    await expect(
      page.getByRole('group', { name: 'Month around the selected date' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Year', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Year', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    const locationLabel = page.locator('.record-navigation__location')
    await expect(locationLabel).toHaveText(/^\d{4}$/)
    const location = await locationLabel.innerText()
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
    const writing = 'Café\u00a0 日本語 preserved'
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

  test('imports and reopens exact Day media through the real runtime', async ({
    page,
  }) => {
    const original = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )
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
    await expect(page.getByRole('heading', { name: 'Media' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add media' })).toBeDisabled()
    await expect(
      page.getByText(
        'Add some writing first. You can add media after this Day’s entry is created.',
      ),
    ).toBeVisible()
    await editor.fill('Day with exact media')
    await expect(page.getByText('Saved.')).toBeVisible()

    await expect(page.getByRole('heading', { name: 'Media' })).toBeVisible()
    await page.getByLabel('Choose media files').setInputFiles({
      name: 'exact-day-media.png',
      mimeType: 'image/png',
      buffer: original,
    })
    await expect(
      page.getByText(
        'The core copied the original bytes into durable archive storage.',
      ),
    ).toBeVisible({ timeout: 20_000 })
    await expect(
      page.getByRole('button', { name: 'Preview exact-day-media.png' }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Preview exact-day-media.png' })
      .click()
    const preview = page.getByRole('img', {
      name: 'Preview of exact-day-media.png',
    })
    await expect(preview).toBeVisible()
    expect(
      await preview.evaluate(async (image) => {
        const response = await fetch((image as HTMLImageElement).src)
        const bytes = await response.arrayBuffer()
        return Array.from(new Uint8Array(bytes))
      }),
    ).toEqual(Array.from(original))

    await page.reload()
    const reopened = page.getByRole('button', {
      name: 'Preview exact-day-media.png',
    })
    await expect(reopened).toBeVisible({ timeout: 20_000 })
    await reopened.click()
    const reopenedPreview = page.getByRole('img', {
      name: 'Preview of exact-day-media.png',
    })
    await expect(reopenedPreview).toBeVisible()
    expect(
      await reopenedPreview.evaluate(async (image) => {
        const response = await fetch((image as HTMLImageElement).src)
        const bytes = await response.arrayBuffer()
        return Array.from(new Uint8Array(bytes))
      }),
    ).toEqual(Array.from(original))
  })

  test('persists and archive-round-trips a Person photo and ordered Record link', async ({
    page,
  }) => {
    test.setTimeout(60_000)
    const photo = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )
    const personName = 'Žofie 佐藤'
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
    const timeNavigation = page.getByRole('navigation', { name: 'Time' })
    await expect(timeNavigation.or(createAnyway)).toBeVisible({
      timeout: 20_000,
    })
    if (await createAnyway.isVisible()) await createAnyway.click()
    await expect(timeNavigation).toBeVisible({ timeout: 20_000 })

    await page.getByRole('link', { name: 'Index' }).click()
    await page.getByRole('link', { name: /People/ }).click()
    await page.getByRole('button', { name: 'New Person' }).click()
    const createPerson = page.getByRole('dialog', { name: 'New Person' })
    await createPerson.getByRole('textbox', { name: 'Name' }).fill(personName)
    await createPerson
      .getByRole('button', { name: 'Create and continue' })
      .click()
    await expect(page).toHaveURL(/\/index\/people\/[^/]+\/edit$/)
    await page.locator('input[type="file"]').setInputFiles({
      name: 'person.png',
      mimeType: 'image/png',
      buffer: photo,
    })
    await expect(
      page.getByRole('img', { name: `Profile photo for ${personName}` }),
    ).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Back to People' }).click()

    await page.getByRole('link', { name: 'Record' }).click()
    const editor = page.getByRole('textbox', { name: 'Writing editor' })
    await expect(editor).toBeVisible({ timeout: 20_000 })
    await expect(async () => {
      await expect(editor).toBeEditable()
      await editor.fill('A Day linked to a Person')
    }).toPass({ timeout: 20_000 })
    await expect(page.getByText('Saved.')).toBeVisible()
    await page.getByText('Add Context').click()
    await page.getByRole('button', { name: 'People', exact: true }).click()
    await page
      .getByRole('button', { name: 'Manage People in This Entry' })
      .click()
    const manager = page.getByRole('dialog', {
      name: 'People in this entry',
    })
    const personRoles = manager.getByRole('group', {
      name: `Context for ${personName}`,
    })
    await personRoles.getByRole('button', { name: 'Activity' }).click()
    await manager
      .getByRole('button', {
        name: 'Close People in This Entry manager',
      })
      .click()
    await expect(
      page.getByRole('button', {
        name: new RegExp(`${personName}.*Open Person context`),
      }),
    ).toBeVisible({ timeout: 20_000 })

    await page.reload()
    await expect(
      page.getByRole('button', {
        name: new RegExp(`${personName}.*Open Person context`),
      }),
    ).toBeVisible({ timeout: 20_000 })
    await page.getByRole('link', { name: 'Index' }).click()
    await page.getByRole('link', { name: /People/ }).click()
    await expect(page).toHaveURL(/\/index\/people$/)
    await page
      .locator('.people-manager__list')
      .getByRole('button', { name: new RegExp(personName) })
      .click()
    await expect(
      page.getByRole('img', { name: `Profile photo for ${personName}` }),
    ).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Back to People' }).click()

    await page.getByRole('link', { name: 'Settings' }).click()
    await page.getByRole('link', { name: 'Manage Archive' }).click()
    const exportPanel = page.getByRole('region', { name: 'Export' })
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      exportPanel.getByRole('button', { name: 'Create export' }).click(),
    ])
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(Buffer.from(chunk))
    const archive = Buffer.concat(chunks)
    await expect(
      exportPanel.getByRole('heading', { name: 'Verified package ready' }),
    ).toBeVisible({ timeout: 20_000 })
    await expect(exportPanel).toContainText('People included')
    await expect(exportPanel).toContainText('1')

    const importPanel = page.getByRole('region', { name: 'Import' })
    await importPanel.getByLabel('Archive package').setInputFiles({
      name: 'people-round-trip.lifearchive.tar',
      mimeType: 'application/octet-stream',
      buffer: archive,
    })
    await expect(
      importPanel.getByRole('heading', { name: 'Ready to import' }).or(
        importPanel.getByRole('heading', {
          name: 'Issues importing archive',
        }),
      ),
    ).toBeVisible({ timeout: 20_000 })
    await expect(importPanel).toContainText('People')
    await importPanel
      .getByRole('button', { name: 'Import reviewed items' })
      .click()
    await expect(
      importPanel
        .getByRole('heading', { name: 'Import complete' })
        .or(
          importPanel.getByRole('heading', { name: 'Nothing new to import' }),
        ),
    ).toBeVisible({ timeout: 20_000 })
  })

  test('preserves ordinary writing through a full browser-process restart', async ({
    browserName,
  }, testInfo) => {
    const writing = 'Restart proof: Café\u00a0 日本語'
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
