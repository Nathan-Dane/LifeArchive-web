import { expect, test } from '@playwright/test'

const DEVELOPMENT_MOCK_URL = 'http://localhost:4191/record'

test.describe('Track workflows', () => {
  test('cancels quick Track creation and restores focus to the chooser', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_URL)
    await page.getByRole('button', { name: /^Event: Harbour swim/ }).click()
    const chooser = page.getByRole('button', {
      name: 'Track: Not in a Track. Choose Track',
    })
    await chooser.click()
    await page.getByRole('menuitem', { name: 'New Track' }).click()

    const editor = page.getByRole('dialog', { name: 'New Track' })
    await editor
      .getByRole('textbox', { name: 'Icon and title' })
      .fill('Unsubmitted Track')
    await editor.getByRole('button', { name: 'Close Track editor' }).click()

    await expect(page.getByRole('dialog', { name: 'New Track' })).toHaveCount(0)
    await expect(chooser).toBeFocused()
  })

  test('shows Rust-ordered mixed history and explicit populated deletion consequences', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_URL)
    await page.getByRole('button', { name: /^Event: Harbour swim/ }).click()
    await page
      .getByRole('button', { name: 'Track: Not in a Track. Choose Track' })
      .click()
    await page.getByRole('menuitem', { name: 'Manage Tracks' }).click()
    const manager = page.getByRole('dialog', { name: 'Manage Tracks' })
    await manager.getByRole('button', { name: /Where I lived/ }).click()

    await expect(page.getByRole('dialog', { name: 'Edit Track' })).toBeVisible()
    await page
      .getByRole('button', { name: /Contained Events and Spans/ })
      .click()
    await expect(page.locator('[data-member-kind="span"]')).toContainText(
      'Living in Aarhus',
    )
    await expect(
      page
        .getByRole('region', { name: 'Contained Events and Spans' })
        .getByText(/August 1, 2024 to Present/),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Delete Track' }).click()
    await expect(
      page.getByText(
        'Delete this Track and detach its 3 members? The Events and Spans, including all their writing and metadata, will remain in the archive.',
      ),
    ).toBeVisible()
    const confirm = page.getByRole('button', { name: 'Confirm Delete' })
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
    const eventChooser = page.getByRole('button', {
      name: 'Track: Not in a Track. Choose Track',
    })
    await eventChooser.click()
    await expect(
      page.getByRole('menuitemradio', { name: 'Where I lived' }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(eventChooser).toBeFocused()

    await page.getByRole('button', { name: /^Span: Living in Aarhus/ }).click()
    const spanChooser = page.getByRole('button', {
      name: 'Track: Where I lived. Choose Track',
    })
    await spanChooser.click()
    await expect(
      page.getByRole('menuitemradio', { name: 'Where I lived' }),
    ).toHaveAttribute('aria-checked', 'true')
  })
})
