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
})
