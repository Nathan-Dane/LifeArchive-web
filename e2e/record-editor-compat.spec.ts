import { expect, test, type Locator, type Page } from '@playwright/test'

const DEVELOPMENT_MOCK_URL = 'http://localhost:4191/record'
const MODIFIER = process.platform === 'darwin' ? 'Meta' : 'Control'

async function replaceWriting(page: Page, editor: Locator, text: string) {
  await selectContents(editor)
  await page.keyboard.insertText(text)
}

async function selectContents(locator: Locator) {
  await locator.evaluate((element) => {
    ;(element as HTMLElement).focus()
    const selection = getSelection()
    const range = document.createRange()
    range.selectNodeContents(element)
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
}

test.describe('the cross-engine Markdown command surface', () => {
  test('keeps focus, selection, inline semantics, links, and undo', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_URL)
    const editor = page.getByRole('textbox', { name: 'Writing editor' })
    await expect(editor).toBeFocused()
    await expect
      .poll(() =>
        editor.evaluate((root) => {
          const selection = getSelection()
          if (!selection?.isCollapsed || !selection.anchorNode) return false
          const tail = document.createRange()
          tail.setStart(selection.anchorNode, selection.anchorOffset)
          tail.setEndAfter(root.lastChild!)
          return tail.toString() === ''
        }),
      )
      .toBe(true)

    await replaceWriting(page, editor, 'LifeArchive')
    for (const [button, selector] of [
      ['Bold', '.record-editor__bold'],
      ['Italic', '.record-editor__italic'],
      ['Underline', 'u'],
      ['Strikethrough', '.record-editor__strikethrough'],
      ['Inline code', 'code'],
    ] as const) {
      await editor.click()
      await page.keyboard.press(`${MODIFIER}+A`)
      await page.getByRole('button', { name: button }).click()
      await expect(editor.locator(selector)).toContainText('LifeArchive')
      await selectContents(editor)
      await page.getByRole('button', { name: button }).click()
      await expect(editor.locator(selector)).toHaveCount(0)
      await selectContents(editor)
      await page.getByRole('button', { name: button }).click()
      await expect(editor.locator(selector)).toContainText('LifeArchive')
    }

    await page.keyboard.press(`${MODIFIER}+Z`)
    await expect(editor.locator('code')).toHaveCount(0)
    await page.keyboard.press(`${MODIFIER}+Shift+Z`)
    await expect(editor.locator('code')).toContainText('LifeArchive')

    await selectContents(editor)
    await page.getByRole('button', { name: 'Clear formatting' }).click()
    await expect(editor.locator('strong,em,u,del,code,a')).toHaveCount(0)
    await expect(editor).toContainText('LifeArchive')

    await editor.click()
    await page.keyboard.press(`${MODIFIER}+A`)
    await page.keyboard.press(`${MODIFIER}+K`)
    const linkButton = page.getByRole('button', { name: 'Link' })
    const address = page.getByRole('textbox', { name: 'Web address' })
    await address.fill('https://example.com/one')
    await page.getByRole('button', { name: 'Apply link' }).click()
    const link = editor.getByRole('link', { name: 'LifeArchive' })
    await expect(link).toHaveAttribute('href', 'https://example.com/one')
    await expect(linkButton).toBeFocused()

    await selectContents(link)
    await page.getByRole('button', { name: 'Link' }).click()
    await expect(address).toHaveValue('https://example.com/one')
    await address.fill('https://example.com/two')
    await page.getByRole('button', { name: 'Apply link' }).click()
    await expect(link).toHaveAttribute('href', 'https://example.com/two')

    await selectContents(link)
    await page.getByRole('button', { name: 'Link' }).click()
    await page.getByRole('button', { name: 'Remove link' }).click()
    await expect(editor.getByRole('link')).toHaveCount(0)
    await expect(editor).toContainText('LifeArchive')
  })

  test('supports blocks, list depth, dividers, composition, and safe paste', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_URL)
    const editor = page.getByRole('textbox', { name: 'Writing editor' })

    await replaceWriting(page, editor, 'Subheading')
    await page.getByRole('button', { name: 'Text style' }).click()
    await page.getByRole('menuitemradio', { name: 'Subheading' }).click()
    await expect(
      editor.getByRole('heading', { level: 2, name: 'Subheading' }),
    ).toBeVisible()

    await selectContents(editor)
    await page.getByRole('button', { name: 'Text style' }).click()
    await page.getByRole('menuitemradio', { name: 'Quote' }).click()
    await expect(editor.locator('blockquote')).toContainText('Subheading')

    await selectContents(editor)
    await page.getByRole('button', { name: 'Text style' }).click()
    await page.getByRole('menuitemradio', { name: 'Code block' }).click()
    await expect(editor.locator('pre > code')).toContainText('Subheading')

    await selectContents(editor)
    await page.getByRole('button', { name: 'Text style' }).click()
    await page.getByRole('menuitemradio', { name: 'Paragraph' }).click()
    await expect(editor.locator('p')).toContainText('Subheading')

    await replaceWriting(page, editor, 'one')
    await page.keyboard.press('Enter')
    await page.keyboard.insertText('two')
    await selectContents(editor)
    await page.getByRole('button', { name: 'Bulleted list' }).click()
    await expect(editor.locator('li')).toHaveCount(2)
    const second = editor.locator('li').nth(1)
    await selectContents(second)
    await page.getByRole('button', { name: 'Indent list item' }).click()
    await expect(editor.locator('ul ul li')).toContainText('two')
    await selectContents(editor.locator('ul ul li'))
    await page.getByRole('button', { name: 'Outdent list item' }).click()
    await expect(
      editor.locator('ul').first().locator(':scope > li'),
    ).toHaveCount(2)

    await selectContents(editor)
    await page.getByRole('button', { name: 'Numbered list' }).click()
    await expect(editor.locator('ol > li')).toHaveCount(2)

    await editor.click()
    await page.keyboard.press(`${MODIFIER}+ArrowDown`)
    await page.getByRole('button', { name: 'Insert divider' }).click()
    await expect(editor.locator('hr')).toHaveCount(1)

    await selectContents(editor)
    await page.keyboard.press('Backspace')
    await editor.evaluate((element) => {
      const transfer = new DataTransfer()
      transfer.setData(
        'text/html',
        '<p onclick="alert(1)"><strong>bold</strong> <u>under</u> <a href="javascript:alert(1)">label</a><span style="color:red"> text</span><img src=x onerror=alert(1)><iframe srcdoc=x></iframe><svg onload=alert(1)></svg><script>alert(1)</script></p>',
      )
      transfer.setData('text/plain', 'bold under label text')
      const paste = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: transfer,
      })
      // Firefox does not retain constructor-provided clipboard data for a
      // synthetic event. Real user paste events expose this property.
      Object.defineProperty(paste, 'clipboardData', { value: transfer })
      element.dispatchEvent(paste)
    })
    await expect(editor.locator('strong')).toHaveText('bold')
    await expect(editor.locator('u')).toHaveText('under')
    await expect(editor).toContainText('label text')
    await expect(
      editor.locator(
        'script,img,iframe,svg,[onclick],[onerror],[onload],[style]',
      ),
    ).toHaveCount(0)
    await expect(editor.getByRole('link', { name: 'label' })).toHaveCount(0)

    await editor.evaluate((element) => {
      element.dispatchEvent(new CompositionEvent('compositionstart'))
      element.append(document.createTextNode(' 日本語 A\u030A 👨‍👩‍👧‍👦'))
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertCompositionText',
        }),
      )
      element.dispatchEvent(
        new CompositionEvent('compositionend', {
          bubbles: true,
          data: ' 日本語 A\u030A 👨‍👩‍👧‍👦',
        }),
      )
    })
    await expect(editor).toContainText('日本語 Å 👨‍👩‍👧‍👦')
  })
})
