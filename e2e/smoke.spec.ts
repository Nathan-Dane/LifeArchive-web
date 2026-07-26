import { expect, test } from '@playwright/test'

const ROUTES = ['/', '/record', '/timeline', '/settings'] as const

const FORBIDDEN_CLAIMS = [
  /\bsaved\b/i,
  /\bsynced\b/i,
  /\bbacked up\b/i,
  /\bpersistent\b/i,
  /\bstored on this device\b/i,
  /runtime (is )?(ready|available|connected|loaded)/i,
  /archive (is )?(open|loaded|ready|available)/i,
]

for (const path of ROUTES) {
  test(`keeps features gated when loading ${path} directly`, async ({
    page,
  }) => {
    await page.goto(path)

    await expect(
      page.getByRole('heading', { name: 'LifeArchive cannot start' }),
    ).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Record' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Timeline' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Settings' })).toHaveCount(0)
  })
}

test('offers a calm retry and remains gated after reload', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/timeline')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(
    page.getByRole('heading', { name: 'LifeArchive cannot start' }),
  ).toBeVisible()

  await page.reload()
  await expect(page).toHaveURL(/\/timeline$/)
  await expect(
    page.getByRole('heading', { name: 'LifeArchive cannot start' }),
  ).toBeVisible()

  const text = (await page.locator('body').innerText()).trim()
  for (const claim of FORBIDDEN_CLAIMS) expect(text).not.toMatch(claim)
  expect(errors).toEqual([])
})
