import { expect, test } from '@playwright/test'

const DEVELOPMENT_MOCK_RECORD_URL = 'http://localhost:4191/record'

test.describe('People in Record', () => {
  test('presents the durable Person context through the four role controls', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_RECORD_URL)

    const person = page.getByRole('button', {
      name: /Maya Chen.*Open Person context/,
    })
    await expect(person).toBeVisible()
    await person.click()

    const task = page.getByRole('dialog', {
      name: /Person in this Entry: Maya Chen/,
    })
    await expect(task).toBeVisible()
    const roles = task.getByRole('group', { name: 'Context for Maya Chen' })

    await expect(roles.getByRole('button')).toHaveCount(4)
    await expect(
      roles.getByRole('button', { name: 'Included' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(roles.getByRole('button', { name: 'Brief' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(
      roles.getByRole('button', { name: 'Together' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(roles.getByRole('button', { name: 'About' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(
      task.getByRole('button', { name: 'Remove from This Entry' }),
    ).toBeVisible()
  })

  test('manages assigned and unassigned People without picker checkbox semantics', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_RECORD_URL)

    const trigger = page.getByRole('button', {
      name: 'Manage People in This Entry',
    })
    await trigger.click()

    const manager = page.getByRole('dialog', {
      name: 'Manage People in This Entry',
    })
    await expect(manager).toBeVisible()
    await expect(
      manager.getByPlaceholder('Search by name or connection'),
    ).toBeVisible()
    await expect(
      manager.getByRole('heading', { name: 'In this Entry', exact: true }),
    ).toBeVisible()
    await expect(
      manager.getByRole('heading', { name: 'Other People' }),
    ).toBeVisible()
    await expect(
      manager.getByRole('group', { name: 'Context for Maya Chen' }),
    ).toBeVisible()
    await expect(
      manager.getByRole('button', { name: 'Remove Maya Chen' }),
    ).toBeVisible()
    await expect(manager.getByRole('menu')).toHaveCount(0)
    await expect(manager.getByRole('menuitemcheckbox')).toHaveCount(0)
  })

  test('restores the invoking control after dismissing each centered task', async ({
    page,
  }) => {
    await page.goto(DEVELOPMENT_MOCK_RECORD_URL)

    const person = page.getByRole('button', {
      name: /Maya Chen.*Open Person context/,
    })
    await person.click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(person).toBeFocused()

    const managerTrigger = page.getByRole('button', {
      name: 'Manage People in This Entry',
    })
    await managerTrigger.click()
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('dialog', { name: 'Manage People in This Entry' }),
    ).toHaveCount(0)
    await expect(managerTrigger).toBeFocused()
  })

  test('hands View and Edit to canonical Person routes and restores Record', async ({
    page,
  }) => {
    await page.goto(`${DEVELOPMENT_MOCK_RECORD_URL}?scale=day&date=2025-06-15`)
    const person = page.getByRole('button', {
      name: /Maya Chen.*Open Person context/,
    })

    await person.click()
    const view = page.getByRole('button', { name: 'View Person' })
    const edit = page.getByRole('button', { name: 'Edit Person' })
    await expect(view).toBeVisible()
    await expect(edit).toBeVisible()
    await view.click()

    await expect(page).toHaveURL(/\/index\/people\/[^/]+$/)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Maya Chen' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Back to Record' }).click()
    await expect(page).toHaveURL(
      `${DEVELOPMENT_MOCK_RECORD_URL}?scale=day&date=2025-06-15`,
    )
    await expect(person).toBeFocused()

    await person.click()
    await page.getByRole('button', { name: 'Edit Person' }).click()
    await expect(page).toHaveURL(/\/index\/people\/[^/]+\/edit$/)
    await expect(
      page.getByRole('button', { name: 'View Profile' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'View Profile' }).click()
    await expect(page).toHaveURL(/\/index\/people\/[^/]+$/)
    await page.getByRole('button', { name: 'Back to Record' }).click()
    await expect(page).toHaveURL(
      `${DEVELOPMENT_MOCK_RECORD_URL}?scale=day&date=2025-06-15`,
    )
    await expect(person).toBeFocused()
  })
})
