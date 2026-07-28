import { expect, test } from '@playwright/test'

const DEVELOPMENT_MOCK_URL = 'http://localhost:4191/record'

test.describe('Event editing', () => {
  test('shows the permanent Entry, Events, and Spans navigation groups', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_URL)

    await expect(page.getByRole('heading', { name: 'Entry' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Spans' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: /^Event: Harbour swim/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /^Span: Living in Aarhus/ }),
    ).toBeVisible()
  })

  test('creates or cancels explicitly and confirms deletion', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_URL)

    await page.getByRole('button', { name: 'New Event' }).click()
    const title = page.getByRole('textbox', { name: 'Title and icon' })
    await expect(title).toBeVisible()
    await title.fill('An exact new Event')
    await expect(page.getByRole('button', { name: 'Create' })).toBeEnabled()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('button', { name: 'Create' })).toHaveCount(0)

    await page.getByRole('button', { name: /^Event: Harbour swim/ }).click()
    await expect(page.getByRole('heading', { name: 'Details' })).toBeVisible()
    await page.getByRole('button', { name: 'Delete Event' }).click()
    await expect(
      page.getByText(
        'Delete this Event? Its exact stable identity will be soft-deleted.',
      ),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(
      page.getByText(
        'Delete this Event? Its exact stable identity will be soft-deleted.',
      ),
    ).toHaveCount(0)
  })
})
