import { expect, test } from '@playwright/test'

const DEVELOPMENT_MOCK_URL = 'http://localhost:4191/record'

test.describe('Track workflows', () => {
  test('cancels Track plus first-member capture with the complete draft still local', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_URL)
    await page.getByRole('button', { name: 'New Track' }).click()
    await page.getByRole('textbox', { name: 'Name' }).fill('Unsubmitted Track')
    await page
      .getByRole('checkbox', { name: 'Create with a first member' })
      .check()
    await page.getByRole('textbox', { name: 'Title' }).fill('First member')
    await page
      .getByRole('textbox', { name: 'Writing' })
      .fill('Exact local draft')
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(
      page.getByRole('heading', { name: 'Track details' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: /Where I lived/ }),
    ).toBeVisible()
  })

  test('shows Rust-ordered mixed history and explicit populated deletion consequences', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_URL)
    await page.getByRole('button', { name: /Where I lived/ }).click()

    await expect(
      page.getByRole('heading', { name: 'Where I lived' }),
    ).toBeVisible()
    await expect(page.locator('[data-member-kind="span"]')).toContainText(
      'Living in Aarhus',
    )
    await expect(
      page
        .getByRole('region', { name: 'Where I lived' })
        .getByText(/August 1, 2024 to Present/),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Delete Track' }).click()
    await expect(
      page.getByText(
        'Delete this Track and detach its 3 members? The Events and Spans, including all their writing and metadata, will remain in the archive.',
      ),
    ).toBeVisible()
    const confirm = page.getByRole('button', { name: 'Delete Track' }).last()
    await expect(confirm).toBeDisabled()
    await page
      .getByRole('checkbox', {
        name: 'Detach every member without deleting any Event or Span',
      })
      .check()
    await expect(confirm).toBeEnabled()
  })

  test('offers a Track chooser for both Event and Span membership', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_URL)
    await page.getByRole('button', { name: /^Event: Harbour swim/ }).click()
    await expect(page.getByRole('combobox', { name: 'Track' })).toContainText(
      'Where I lived',
    )

    await page.getByRole('button', { name: /^Span: Living in Aarhus/ }).click()
    await expect(page.getByRole('combobox', { name: 'Track' })).toContainText(
      'Where I lived',
    )
  })
})
