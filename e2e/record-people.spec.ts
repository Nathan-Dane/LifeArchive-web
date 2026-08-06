import { expect, test } from '@playwright/test'

const DEVELOPMENT_MOCK_RECORD_URL = 'http://localhost:4191/record'
const DEVELOPMENT_MOCK_PEOPLE_URL = 'http://localhost:4191/people'

test.describe('People workflows', () => {
  test('quick-creates a Person from the picker and returns it selected', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_RECORD_URL)

    await page.getByRole('button', { name: 'Add People' }).click()
    const picker = page.getByRole('menu')
    await expect(
      picker.getByRole('menuitemcheckbox', { name: /Maya Chen/ }),
    ).toBeVisible()
    await picker.getByRole('menuitem', { name: /New Person/ }).click()

    const editor = page.getByRole('dialog', { name: 'New Person' })
    await editor
      .getByRole('textbox', { name: 'Display name' })
      .fill('E2E Person')
    await editor.getByRole('button', { name: 'Save' }).click()

    await expect(
      page.getByRole('button', { name: /New Person.*Open Person context/ }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Add People' }).click()
    await expect(
      page.getByRole('menuitemcheckbox', { name: /Maya Chen/ }),
    ).toHaveAttribute('aria-checked', 'true')
  })

  test('exposes complete non-colour Person context and contains the task at large text', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_RECORD_URL)
    await page.addStyleTag({ content: 'html { font-size: 175%; }' })

    const tile = page.getByRole('button', {
      name: /Maya Chen.*Time together.*Took part.*Is not a subject.*Open Person context/,
    })
    await expect(tile).toBeVisible()
    await tile.click()
    const dialog = page.getByRole('dialog', {
      name: 'Person context for Maya Chen',
    })
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole('checkbox', { name: 'Took part' }),
    ).toBeVisible()
    await expect(
      dialog.getByRole('checkbox', { name: 'Is a subject' }),
    ).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: 'Update People' }),
    ).toBeVisible()
  })

  test('edits from Manage People and returns without losing manager search', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_PEOPLE_URL)

    const search = page.getByPlaceholder('Search by name or connection')
    await search.fill('Maya')
    await page.getByRole('button', { name: /Maya Chen/ }).click()

    const editor = page.getByRole('dialog', { name: 'Person' })
    const about = editor.getByRole('textbox', { name: 'About' })
    await about.fill('Still local until Save succeeds.')
    await editor.getByRole('button', { name: 'Save' }).click()
    await editor.getByRole('button', { name: 'Back to People' }).click()

    await expect(search).toHaveValue('Maya')
    await expect(page.getByRole('button', { name: /Maya Chen/ })).toBeVisible()
  })

  test('supports keyboard navigation and restores focus after Escape', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_RECORD_URL)

    const trigger = page.getByRole('button', { name: 'Add People' })
    await trigger.focus()
    await trigger.press('ArrowDown')
    const firstPerson = page.getByRole('menuitemcheckbox', {
      name: /Maya Chen/,
    })
    await expect(firstPerson).toBeFocused()
    await firstPerson.press('ArrowDown')
    await expect(
      page.getByRole('menuitem', { name: /New Person/ }),
    ).toBeFocused()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
})
