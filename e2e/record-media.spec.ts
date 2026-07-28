import { expect, test } from '@playwright/test'

const DEVELOPMENT_MOCK_URL = 'http://localhost:4191/record'

test.describe('Record media', () => {
  test('offers a keyboard gallery and keeps development durability wording honest', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_URL)

    const preview = page.getByRole('button', {
      name: 'Preview harbour.jpg',
    })
    await expect(preview).toBeVisible()
    await preview.focus()
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('region', { name: 'harbour.jpg' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Close preview' }).click()

    await page.getByLabel('Choose media files').setInputFiles({
      name: 'exact-original.bin',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from([0, 1, 2, 3, 255]),
    })
    await expect(
      page.getByText(
        'Development preview. The selected bytes remain in this tab only.',
      ),
    ).toBeVisible()
    await expect(page.getByText(/durable archive storage/i)).toHaveCount(0)
  })

  test('does not offer ordinary media at Week, Month, or Year scales', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_URL)

    for (const scale of ['Week', 'Month', 'Year']) {
      await page.getByRole('button', { name: scale, exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Media' })).toHaveCount(0)
    }
  })
})
