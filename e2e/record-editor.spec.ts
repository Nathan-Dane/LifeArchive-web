import { expect, test } from '@playwright/test'

const DEVELOPMENT_MOCK_URL = 'http://localhost:4191/record'
const MODIFIER = process.platform === 'darwin' ? 'Meta' : 'Control'

test.describe('the visual Markdown editor', () => {
  test('keeps whitespace-edge formatting visual across reopening', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_URL)
    const editor = page.getByRole('textbox', { name: 'Writing editor' })
    await expect(editor).toContainText('Morning')

    await editor.click()
    await page.keyboard.press(`${MODIFIER}+A`)
    await page.keyboard.type(' bold ')
    await page.keyboard.press(`${MODIFIER}+A`)
    await page.keyboard.press(`${MODIFIER}+B`)

    await expect(editor.locator('.record-editor__bold')).toHaveText(' bold ')
    await expect(editor).toHaveText(' bold ')
    await expect(editor).not.toContainText('**')

    await page.getByRole('button', { name: /^Event: Harbour swim/ }).click()
    await page.getByRole('button', { name: 'Day entry' }).click()

    await expect(editor).toHaveText(' bold ')
    await expect(editor.locator('.record-editor__bold')).toHaveText('bold')
    await expect(editor).not.toContainText('**')
  })

  test('supports clickable formatting controls and keyboard link creation', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_URL)
    const editor = page.getByRole('textbox', { name: 'Writing editor' })
    await editor.click()
    await page.keyboard.press(`${MODIFIER}+A`)
    await page.keyboard.type('LifeArchive')
    await page.keyboard.press(`${MODIFIER}+A`)

    await page.getByRole('button', { name: 'Bold' }).click()
    await expect(editor.locator('.record-editor__bold')).toHaveText(
      'LifeArchive',
    )

    await editor.click()
    await page.keyboard.press(`${MODIFIER}+A`)
    await page.getByRole('button', { name: 'Italic' }).click()
    await expect(editor.locator('.record-editor__italic')).toHaveText(
      'LifeArchive',
    )

    await editor.click()
    await page.keyboard.press(`${MODIFIER}+A`)
    await page.getByRole('button', { name: 'Underline' }).click()
    await expect(editor.locator('u')).toHaveText('LifeArchive')

    await editor.click()
    await page.keyboard.press(`${MODIFIER}+A`)
    await page.getByRole('button', { name: 'Strikethrough' }).click()
    await expect(editor.locator('.record-editor__strikethrough')).toHaveText(
      'LifeArchive',
    )

    await editor.click()
    await page.keyboard.press(`${MODIFIER}+A`)
    await page.getByRole('button', { name: 'Inline code' }).click()
    await expect(editor.locator('code')).toHaveText('LifeArchive')
    await page.keyboard.press(`${MODIFIER}+Z`)
    await expect(editor.locator('code')).toHaveCount(0)

    await editor.click()
    await page.keyboard.press(`${MODIFIER}+A`)
    await page.getByRole('button', { name: 'Text style' }).click()
    await page
      .getByRole('menuitemradio', { name: 'Heading', exact: true })
      .click()
    await expect(
      editor.getByRole('heading', { level: 1, name: 'LifeArchive' }),
    ).toBeVisible()

    await editor.click()
    await page.keyboard.press(`${MODIFIER}+A`)
    await page.getByRole('button', { name: 'Bulleted list' }).click()
    await expect(editor.locator('ul')).toBeVisible()

    await editor.click()
    await page.keyboard.press(`${MODIFIER}+A`)
    await page.keyboard.press(`${MODIFIER}+K`)
    const address = page.getByRole('textbox', { name: 'Web address' })
    await address.fill('https://example.com/archive')
    await page.getByRole('button', { name: 'Apply link' }).click()
    await expect(
      editor.getByRole('link', { name: 'LifeArchive' }),
    ).toHaveAttribute('href', 'https://example.com/archive')
    await expect(editor).not.toContainText(/[*#[\]()]/)
  })
})
