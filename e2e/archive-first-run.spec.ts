import { expect, test } from './client-fixtures'

/**
 * First run in real engines.
 *
 * A production build has no runtime and cannot build the development mock in,
 * so the only thing first run can be observed doing here is the thing that
 * matters most: not happening. An offer to create an archive with no runtime
 * behind it would be an offer to lose whatever came next, so the control must
 * be absent — before and after a reload, in every engine.
 */

const ROUTES = ['/', '/record', '/settings'] as const

for (const path of ROUTES) {
  test(`offers no archive creation without a runtime at ${path}`, async ({
    page,
  }) => {
    await page.goto(path)

    await expect(
      page.getByRole('heading', { name: 'LifeArchive cannot start' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /^Create archive/ }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: 'Create your local archive' }),
    ).toHaveCount(0)
  })
}

test('still offers no creation after a reload', async ({ page }) => {
  await page.goto('/record')
  await page.reload()

  await expect(
    page.getByRole('heading', { name: 'LifeArchive cannot start' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /^Create archive/ }),
  ).toHaveCount(0)

  const text = (await page.locator('body').innerText()).trim()
  expect(text).not.toMatch(/\bpersistent\b/i)
  expect(text).not.toMatch(/\bbacked up\b/i)
})
