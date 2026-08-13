import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  ok,
  revision,
  stableId,
  type LifeArchiveClient,
  type PersonSnapshot,
} from '../../core/client'
import { I18nProvider } from '../../i18n'
import { TestLifeArchiveClient } from '../../test/TestLifeArchiveClient'
import { PeopleChooser } from './PeopleChooser'

const STORE_ID = stableId('a2000000-0000-4000-8000-000000000201')
const ADA_ID = stableId('a2000000-0000-4000-8000-000000000202')
const GRACE_ID = stableId('a2000000-0000-4000-8000-000000000203')
const ARCHIVED_ID = stableId('a2000000-0000-4000-8000-000000000204')
const CREATED_ID = stableId('a2000000-0000-4000-8000-000000000205')
const INVALIDATION = {
  storeInstanceId: 'people-chooser-test',
  revision: revision('4'),
}

function person(
  id: typeof ADA_ID,
  displayName: string,
  isArchived = false,
): PersonSnapshot {
  return {
    person: {
      id,
      displayName,
      connectionLabels: [],
      about: null,
      otherNames: [],
      pronouns: null,
      pronunciation: null,
      lifeStatus: 'notSpecified',
      birthDate: null,
      deathDate: null,
      references: [],
      isArchived,
      createdAtMs: 1,
      updatedAtMs: 2,
      deletedAtMs: null,
      mergedIntoPersonId: null,
    },
    revision: revision('2'),
    profilePhoto: null,
    lastRecordedContactDate: null,
  }
}

const ADA = person(ADA_ID, 'Ada Lovelace')
const GRACE = person(GRACE_ID as typeof ADA_ID, 'Grace Hopper')
const ARCHIVED = person(ARCHIVED_ID as typeof ADA_ID, 'Archived Person', true)

function makeClient() {
  const base = new TestLifeArchiveClient({
    state: 'open',
    archive: {
      storeId: STORE_ID,
      productContract: '9',
      storeSchemaVersion: '12',
      rootLayoutVersion: '1',
      invalidation: INVALIDATION,
    },
  }).client
  const create = vi.fn<LifeArchiveClient['people']['create']>(
    async (request) => {
      const current: PersonSnapshot = {
        ...person(CREATED_ID as typeof ADA_ID, request.profile.displayName),
        person: {
          ...person(CREATED_ID as typeof ADA_ID, request.profile.displayName)
            .person,
          ...request.profile,
        },
      }
      return ok({ outcome: 'created', current, invalidation: INVALIDATION })
    },
  )
  const client: LifeArchiveClient = {
    ...base,
    people: {
      ...base.people,
      list: async () =>
        ok({
          people: [ADA, GRACE, ARCHIVED],
          hasMore: false,
          nextCursor: null,
          invalidation: INVALIDATION,
        }),
      create,
      memories: async () =>
        ok({ memories: [], hasMore: false, invalidation: INVALIDATION }),
      contactSummary: async () =>
        ok({
          summary: {
            lastRecordedContactDate: null,
            current30DayContactDays: 0,
            previous30DayContactDays: 0,
            current30DayTimeTogetherDays: 0,
          },
          invalidation: INVALIDATION,
        }),
    },
    operations: { ...base.operations, newStableId: () => CREATED_ID },
  }
  return { client, create }
}

function Harness({ client }: { readonly client: LifeArchiveClient }) {
  const [value, setValue] = useState<readonly (typeof ADA_ID)[]>([])
  return (
    <I18nProvider locale="en">
      <PeopleChooser client={client} value={value} onChange={setValue} />
      <output aria-label="selected-order">{value.join(',')}</output>
    </I18nProvider>
  )
}

function RejectedHandoff({ client }: { readonly client: LifeArchiveClient }) {
  return (
    <I18nProvider locale="en">
      <PeopleChooser client={client} value={[]} onChange={async () => false} />
    </I18nProvider>
  )
}

describe('PeopleChooser', () => {
  it('keeps active People in core order, uses checkbox semantics, and restores keyboard focus', async () => {
    const user = userEvent.setup()
    const { client } = makeClient()
    render(<Harness client={client} />)
    const trigger = await screen.findByRole('button', { name: '0 People' })
    await user.click(trigger)
    const menu = await screen.findByRole('menu')
    const choices = within(menu).getAllByRole('menuitemcheckbox')
    expect(choices.map((choice) => choice.textContent)).toEqual([
      expect.stringContaining('Ada Lovelace'),
      expect.stringContaining('Grace Hopper'),
    ])
    expect(within(menu).queryByText('Archived Person')).not.toBeInTheDocument()

    await user.click(choices[1]!)
    await user.click(choices[0]!)
    expect(screen.getByLabelText('selected-order')).toHaveTextContent(
      `${GRACE_ID},${ADA_ID}`,
    )
    expect(choices[0]).toHaveAttribute('aria-checked', 'true')
    expect(choices[1]).toHaveAttribute('aria-checked', 'true')

    choices[0]!.focus()
    await user.keyboard('{ArrowDown}{Escape}')
    expect(trigger).toHaveFocus()
  })

  it('quick-creates a complete profile and returns it selected', async () => {
    const user = userEvent.setup()
    const { client, create } = makeClient()
    render(<Harness client={client} />)
    await user.click(await screen.findByRole('button', { name: '0 People' }))
    await user.click(screen.getByRole('menuitem', { name: /New Person/ }))

    const dialog = await screen.findByRole('dialog', { name: 'New Person' })
    const displayName = within(dialog).getByRole('textbox', {
      name: 'Name',
    })
    await user.type(displayName, '   ')
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.clear(displayName)
    await user.type(displayName, 'Katherine Johnson')
    await user.click(
      within(dialog).getByRole('button', { name: 'Choose connections' }),
    )
    const connections = await screen.findByRole('menu', {
      name: 'How you know them',
    })
    const standardConnections =
      within(connections).getAllByRole('menuitemcheckbox')
    expect(
      standardConnections.slice(0, 3).map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining('Friend'),
      expect.stringContaining('Family'),
      expect.stringContaining('Colleague'),
    ])
    await user.click(
      within(connections).getByRole('menuitemcheckbox', { name: 'Friend' }),
    )
    await user.click(
      within(connections).getByRole('menuitemcheckbox', { name: 'Family' }),
    )
    await user.click(
      within(connections).getByRole('menuitem', { name: 'Make primary' }),
    )
    expect(
      within(connections)
        .getAllByRole('menuitemcheckbox')
        .slice(0, 3)
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining('Friend'),
      expect.stringContaining('Family'),
      expect.stringContaining('Colleague'),
    ])
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(
        screen.queryByRole('menu', { name: 'How you know them' }),
      ).not.toBeInTheDocument(),
    )

    const birth = within(dialog).getByRole('group', { name: 'Birth date' })
    await user.click(
      within(birth).getByRole('checkbox', { name: 'Not recorded' }),
    )
    await user.click(within(birth).getByRole('button', { name: 'Precision' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'Month' }))
    expect(
      within(birth).getByRole('spinbutton', { name: 'Month' }),
    ).toHaveValue(null)
    await user.type(
      within(birth).getByRole('spinbutton', { name: 'Month' }),
      '8',
    )
    const year = within(birth).getByRole('spinbutton', { name: 'Year' })
    await user.click(year)
    await user.keyboard('1918')
    await user.click(
      within(birth).getByRole('checkbox', { name: 'Approximate' }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    expect(create.mock.calls[0]![0].profile.displayName).toBe(
      'Katherine Johnson',
    )
    expect(create.mock.calls[0]![0].profile.connectionLabels).toEqual([
      'Family',
      'Friend',
    ])
    expect(create.mock.calls[0]![0].profile.birthDate).toEqual({
      precision: 'month',
      year: 1918,
      month: 8,
      day: null,
      approximate: true,
    })
    await waitFor(() =>
      expect(screen.getByLabelText('selected-order')).toHaveTextContent(
        CREATED_ID,
      ),
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

  it('keeps a newly created Person open when linking it fails', async () => {
    const user = userEvent.setup()
    const { client } = makeClient()
    render(<RejectedHandoff client={client} />)
    await user.click(await screen.findByRole('button', { name: '0 People' }))
    await user.click(screen.getByRole('menuitem', { name: /New Person/ }))
    const dialog = await screen.findByRole('dialog', { name: 'New Person' })
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Name' }),
      'Katherine Johnson',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(
      await within(dialog).findByText(
        /Person was created, but could not be added/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('preserves manager search while editing and returning, with archived disclosure', async () => {
    const user = userEvent.setup()
    const { client } = makeClient()
    render(<Harness client={client} />)
    await user.click(await screen.findByRole('button', { name: '0 People' }))
    await user.click(screen.getByRole('menuitem', { name: /Manage People/ }))
    const manager = await screen.findByRole('dialog', { name: 'Manage People' })
    const search = within(manager).getByPlaceholderText(
      'Search by name or connection',
    )
    await user.type(search, 'Ada')
    await user.click(
      within(manager).getByRole('button', { name: /Ada Lovelace/ }),
    )

    const editor = await screen.findByRole('dialog', { name: 'Person' })
    await user.click(
      within(editor).getByRole('button', { name: 'Back to People' }),
    )
    const returned = await screen.findByRole('dialog', {
      name: 'Manage People',
    })
    expect(
      within(returned).getByPlaceholderText('Search by name or connection'),
    ).toHaveValue('Ada')
    await user.click(
      within(returned).getByRole('button', { name: 'Archived People' }),
    )
    expect(within(returned).getByText('Archived Person')).toBeInTheDocument()
  })
})
