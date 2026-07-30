import { expect, test } from '@playwright/test'

const DEVELOPMENT_MOCK_URL = 'http://localhost:4191/record'

test.describe('Span editing', () => {
  test('creates or cancels explicitly and presents ongoing ranges without an end date', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_URL)

    await page.getByRole('button', { name: 'New Span' }).click()
    const title = page.getByRole('textbox', { name: 'Title and icon' })
    await expect(title).toBeVisible()
    await title.fill('An exact new Span')
    await expect(
      page.getByRole('button', { name: 'Create Span' }),
    ).toBeEnabled()

    await expect(page.getByRole('button', { name: 'Ongoing' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(
      page.locator('.record-details').getByText('Present', { exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('button', { name: 'Create Span' })).toHaveCount(
      0,
    )
  })

  test('configures derived markers and confirms conversion and deletion explicitly', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_URL)
    await page.getByRole('button', { name: /^Span: Living in Aarhus/ }).click()

    await expect(
      page.locator('.record-details').getByText('Present', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText(
        'Markers are derived from this Span and have no separate writing or identity.',
      ),
    ).toBeVisible()
    const beginMarker = page.getByRole('switch', {
      name: 'Show begin marker',
    })
    await expect(beginMarker).toHaveAttribute('aria-checked', 'true')
    const markerTitle = page.getByRole('textbox', {
      name: 'Custom title',
    })
    await expect(markerTitle).toHaveValue('Moved to Aarhus')
    await page.getByRole('button', { name: 'Use automatic title' }).click()
    await expect(markerTitle).toHaveValue('')

    const convert = page.getByRole('button', {
      name: 'Convert one-day Span to Event',
    })
    await expect(convert).toBeEnabled()
    await convert.click()
    await expect(
      page.getByText(
        'Choose the Event date for this Span. Its writing and stable identity will be preserved.',
      ),
    ).toBeVisible()
    await expect(page.getByLabel('Event date')).toHaveValue('2024-08-01')
    await expect(
      page.getByRole('button', { name: 'Convert to Event' }),
    ).toBeEnabled()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('button', { name: 'Delete Span' }).click()
    await expect(
      page.getByText(
        'Delete this Span? Its exact stable identity will be soft-deleted. Its markers are derived and will disappear with it.',
      ),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
  })
})
