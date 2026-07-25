import { expect, test } from '@playwright/test'

const ROUTES = [
  { path: '/record', heading: 'Record' },
  { path: '/timeline', heading: 'Timeline' },
  { path: '/settings', heading: 'Settings' },
] as const

/**
 * Wording the bootstrap shell must never show: it has no runtime and no
 * persistence, so nothing may suggest a user's writing is durable.
 */
const FORBIDDEN_CLAIMS = [
  /\bsaved\b/i,
  /\bsynced\b/i,
  /\bbacked up\b/i,
  /\bpersistent\b/i,
  /\bstored on this device\b/i,
  /runtime (is )?(ready|available|connected|loaded)/i,
  /archive (is )?(open|loaded|ready|available)/i,
]

test('loads and redirects the root to /record', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Record' })).toBeVisible()
  await expect(page).toHaveURL(/\/record$/)
})

for (const { path, heading } of ROUTES) {
  test(`serves ${path} directly`, async ({ page }) => {
    await page.goto(path)

    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  })
}

test('navigates from the root to every route', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Main' })

  for (const { heading } of ROUTES) {
    await nav.getByRole('link', { name: heading }).click()
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  }
})

test('reports no available production runtime', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/record')
  const text = (await page.locator('body').innerText()).trim()

  for (const claim of FORBIDDEN_CLAIMS) {
    expect(text).not.toMatch(claim)
  }
  expect(errors).toEqual([])
})

test('stays functional after a reload', async ({ page }) => {
  await page.goto('/timeline')
  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible()

  await page.reload()

  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Record' })
    .click()
  await expect(page.getByRole('heading', { name: 'Record' })).toBeVisible()
})
