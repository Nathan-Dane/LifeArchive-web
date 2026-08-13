import { expect, test, type Locator, type Page } from '@playwright/test'
import { horizontalOverflow } from './client-fixtures'

const DEVELOPMENT_MOCK_URL = 'http://localhost:4191'

test.describe('Index and canonical People routes', () => {
  test('keeps People and Tracks navigable while Media remains inert', async ({
    page,
  }) => {
    await page.goto(`${DEVELOPMENT_MOCK_URL}/index`)

    await expect(page.getByRole('heading', { name: 'Index' })).toBeVisible()
    await expect(page.getByRole('link', { name: /People/ })).toHaveAttribute(
      'href',
      '/index/people',
    )
    await expect(page.getByRole('link', { name: /Tracks/ })).toHaveAttribute(
      'href',
      '/index/tracks',
    )

    const media = page.getByRole('group', {
      name: 'Media, planned and unavailable',
    })
    await expect(media).toContainText('Planned')
    await expect(media).toContainText('Not available yet')
    await expect(media.getByRole('link')).toHaveCount(0)
    await expect(media.getByRole('button')).toHaveCount(0)
  })

  test('publishes the initial directory request without requiring an interaction', async ({
    page,
  }) => {
    await page.goto(`${DEVELOPMENT_MOCK_URL}/index/people`)

    await expect(
      page.getByRole('heading', { name: 'People', exact: true }),
    ).toBeVisible()
    const search = page.getByPlaceholder('Search by name or connection')
    await expect(search).toHaveValue('')
    await expect(page.getByRole('button', { name: /Maya Chen/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Jon Bell/ })).toBeVisible()
  })

  test('redirects the former People destination into the canonical route family', async ({
    page,
  }) => {
    await page.goto(`${DEVELOPMENT_MOCK_URL}/people`)

    await expect(page).toHaveURL(`${DEVELOPMENT_MOCK_URL}/index/people`)
    await expect(page.getByRole('button', { name: /Maya Chen/ })).toBeVisible()
  })

  test('uses canonical profile and editor history', async ({ page }) => {
    await page.goto(`${DEVELOPMENT_MOCK_URL}/index/people`)
    await page.getByRole('button', { name: /Maya Chen/ }).click()

    await expect(page).toHaveURL(/\/index\/people\/[^/]+$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Maya Chen' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible()

    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page).toHaveURL(/\/index\/people\/[^/]+\/edit$/)
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'View Profile' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Merge' })).toBeVisible()

    await page.getByRole('button', { name: 'View Profile' }).click()
    await expect(page).toHaveURL(/\/index\/people\/[^/]+$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/index\/people\/[^/]+\/edit$/)
  })

  test('quick-creates a Person and continues to the full canonical editor', async ({
    page,
  }) => {
    await page.goto(`${DEVELOPMENT_MOCK_URL}/index/people`)
    await page.getByRole('button', { name: 'New Person' }).click()

    const dialog = page.getByRole('dialog', { name: 'New Person' })
    await dialog
      .getByRole('textbox', { name: 'Display name' })
      .fill('E2E Person')
    await dialog
      .getByRole('combobox', { name: 'Connection (optional)' })
      .selectOption('Friend')
    await dialog.getByRole('button', { name: 'Create and continue' }).click()

    await expect(dialog).toHaveCount(0)
    await expect(page).toHaveURL(/\/index\/people\/[^/]+\/edit$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'New Person' }),
    ).toBeVisible()
  })
})

test.describe('People responsive containment', () => {
  for (const viewport of [
    { name: 'wide', width: 1440, height: 900 },
    { name: 'intermediate', width: 1024, height: 900 },
    { name: 'compact', width: 390, height: 844 },
  ] as const) {
    test(`${viewport.name} layouts do not overflow and keep People tasks centered`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await page.goto(`${DEVELOPMENT_MOCK_URL}/index`)
      await expect.poll(() => horizontalOverflow(page)).toBeLessThanOrEqual(0)

      await page.goto(`${DEVELOPMENT_MOCK_URL}/index/people`)
      await expect(
        page.getByRole('button', { name: /Maya Chen/ }),
      ).toBeVisible()
      await expect.poll(() => horizontalOverflow(page)).toBeLessThanOrEqual(0)

      await page.getByRole('button', { name: 'New Person' }).click()
      const createTask = page.getByRole('dialog', { name: 'New Person' })
      await expect(createTask).toBeVisible()
      await expectCentered(page, createTask)
      await expect.poll(() => horizontalOverflow(page)).toBeLessThanOrEqual(0)
      await page.keyboard.press('Escape')

      await page.getByRole('button', { name: /Maya Chen/ }).click()
      await expect(
        page.getByRole('heading', { level: 1, name: 'Maya Chen' }),
      ).toBeVisible()
      await expect.poll(() => horizontalOverflow(page)).toBeLessThanOrEqual(0)

      await page.goto(`${DEVELOPMENT_MOCK_URL}/record`)
      await page
        .getByRole('button', { name: /Maya Chen.*Open Person context/ })
        .click()
      const personTask = page.getByRole('dialog', {
        name: /Person in this Entry: Maya Chen/,
      })
      await expectCentered(page, personTask)
      await expect.poll(() => horizontalOverflow(page)).toBeLessThanOrEqual(0)
      await page.keyboard.press('Escape')

      await page
        .getByRole('button', { name: 'Manage People in This Entry' })
        .click()
      const entryManager = page.getByRole('dialog', {
        name: 'Manage People in This Entry',
      })
      await expectCentered(page, entryManager)
      await expect.poll(() => horizontalOverflow(page)).toBeLessThanOrEqual(0)
    })
  }
})

async function expectCentered(page: Page, dialog: Locator) {
  await expect(dialog.locator('..')).toHaveAttribute('data-phase', 'open')
  await expect
    .poll(async () => {
      const [box, viewport] = await Promise.all([
        dialog.boundingBox(),
        page.evaluate(() => ({
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        })),
      ])
      if (!box) return Number.POSITIVE_INFINITY
      return Math.max(
        Math.abs(box.x + box.width / 2 - viewport.width / 2),
        Math.abs(box.y + box.height / 2 - viewport.height / 2),
      )
    })
    .toBeLessThan(3)
}
