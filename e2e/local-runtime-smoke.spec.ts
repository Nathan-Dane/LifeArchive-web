import { expect, test } from './qualified-browser-fixtures'

const LOCAL_RUNTIME_URL = 'http://localhost:4187/record'
const ENABLED = process.env.LIFEARCHIVE_LOCAL_RUNTIME_E2E === '1'

/**
 * Opt-in, machine-local development evidence only.
 *
 * The ignored runtime/installed receipt may come from a licensed local sibling
 * workspace. It is not part of this public checkout, does not change the
 * production lock, and cannot establish reproducible production acceptance.
 */
test.describe('verified local development runtime', () => {
  test.skip(
    !ENABLED,
    'set LIFEARCHIVE_LOCAL_RUNTIME_E2E=1 after installing a verified local runtime',
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
})
