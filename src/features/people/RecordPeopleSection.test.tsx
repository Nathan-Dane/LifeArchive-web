import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  civilDate,
  ok,
  revision,
  stableId,
  type EntryPeopleSnapshot,
  type LifeArchiveClient,
  type Person,
  type PersonSnapshot,
  type RecordPeopleMutation,
  type TimeWindow,
} from '../../core/client'
import { I18nProvider } from '../../i18n'
import { TestLifeArchiveClient } from '../../test/TestLifeArchiveClient'
import { RecordPeopleSection } from './RecordPeopleSection'

const STORE_ID = stableId('a3000000-0000-4000-8000-000000000301')
const ENTRY_ID = stableId('a3000000-0000-4000-8000-000000000302')
const NEW_ENTRY_ID = stableId('a3000000-0000-4000-8000-000000000303')
const ADA_ID = stableId('a3000000-0000-4000-8000-000000000304')
const GRACE_ID = stableId('a3000000-0000-4000-8000-000000000305')
const INVALIDATION = {
  storeInstanceId: 'record-people-test',
  revision: revision('9'),
}

function person(id: typeof ADA_ID, displayName: string): Person {
  return {
    id,
    displayName,
    connectionLabels: ['Friend'],
    about: null,
    otherNames: [],
    pronouns: null,
    pronunciation: null,
    lifeStatus: 'notSpecified',
    birthDate: null,
    deathDate: null,
    references: [],
    isArchived: false,
    createdAtMs: 1,
    updatedAtMs: 2,
    deletedAtMs: null,
    mergedIntoPersonId: null,
  }
}

const ADA = person(ADA_ID, 'Ada Lovelace')
const GRACE = person(GRACE_ID as typeof ADA_ID, 'Grace Hopper')

function linked(personValue: Person, position: number) {
  return {
    link: {
      entryId: ENTRY_ID,
      personId: personValue.id,
      interactionLevel: 'none' as const,
      tookPart: false,
      isSubject: false,
      opaqueLegacyRoleId: null,
      position,
    },
    person: personValue,
    personRevision: revision('2'),
    profilePhoto: null,
  }
}

const INITIAL: EntryPeopleSnapshot = {
  entryId: ENTRY_ID,
  entryRevision: revision('3'),
  sectionIds: ['people'],
  peopleSectionVisible: true,
  links: [linked(ADA, 0), linked(GRACE, 1)],
}

function snapshotOf(personValue: Person): PersonSnapshot {
  return {
    person: personValue,
    revision: revision('2'),
    profilePhoto: null,
    lastRecordedContactDate: null,
  }
}

function makeClient(initial: EntryPeopleSnapshot | null = INITIAL) {
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
  let current = initial
  const mutateRecordContext = vi.fn<
    LifeArchiveClient['people']['mutateRecordContext']
  >(async ({ mutation }) => {
    current = applyMutation(current, mutation)
    return ok({
      outcome: current ? 'updated' : 'unchangedAbsent',
      current,
      invalidation: INVALIDATION,
    })
  })
  const client: LifeArchiveClient = {
    ...base,
    people: {
      ...base.people,
      loadRecordContext: async () =>
        ok(
          current
            ? { outcome: 'loaded', current, invalidation: INVALIDATION }
            : { outcome: 'absent', current: null, invalidation: INVALIDATION },
        ),
      mutateRecordContext,
      list: async () =>
        ok({
          people: [snapshotOf(ADA), snapshotOf(GRACE)],
          hasMore: false,
          nextCursor: null,
          invalidation: INVALIDATION,
        }),
    },
    operations: { ...base.operations, newStableId: () => NEW_ENTRY_ID },
  }
  return { client, mutateRecordContext }
}

function applyMutation(
  current: EntryPeopleSnapshot | null,
  mutation: RecordPeopleMutation,
): EntryPeopleSnapshot | null {
  if (!current) {
    if (mutation.kind !== 'addSection') return null
    return {
      entryId: NEW_ENTRY_ID,
      entryRevision: revision('1'),
      sectionIds: ['people'],
      peopleSectionVisible: true,
      links: [],
    }
  }
  const revisionValue = revision(String(Number(current.entryRevision) + 1))
  switch (mutation.kind) {
    case 'clearLinks':
      return { ...current, entryRevision: revisionValue, links: [] }
    case 'removeSection':
      return {
        ...current,
        entryRevision: revisionValue,
        sectionIds: [],
        peopleSectionVisible: false,
        links: [],
      }
    case 'removePeople':
      return {
        ...current,
        entryRevision: revisionValue,
        links: current.links.filter(
          ({ person }) => !mutation.personIds.includes(person.id),
        ),
      }
    case 'replaceLinks':
      return {
        ...current,
        entryRevision: revisionValue,
        links: mutation.links.map((draft, position) => {
          const prior = INITIAL.links.find(
            ({ person }) => person.id === draft.personId,
          )!
          return {
            ...prior,
            link: { ...prior.link, ...draft, position },
          }
        }),
      }
    case 'upsertLink':
    case 'addLinks':
    case 'addSection':
      return current
  }
}

function view(
  client: LifeArchiveClient,
  onEntryRevision = vi.fn(),
  entryKind: 'day' | 'week' = 'day',
  contactDateBounds?: {
    readonly minimum: ReturnType<typeof civilDate>
    readonly maximum: ReturnType<typeof civilDate>
  },
) {
  render(
    <I18nProvider locale="en">
      <RecordPeopleSection
        client={client}
        target={{ kind: 'entry', entryId: ENTRY_ID }}
        entryKind={entryKind}
        contactDateBounds={contactDateBounds}
        onEntryRevision={onEntryRevision}
      />
    </I18nProvider>,
  )
  return onEntryRevision
}

describe('RecordPeopleSection', () => {
  it('reconciles a revision conflict from the core and retries the same intent once', async () => {
    const user = userEvent.setup()
    const base = makeClient().client
    const current = {
      ...INITIAL,
      entryRevision: revision('4'),
      links: [linked(GRACE, 0)],
    }
    const mutateRecordContext = vi
      .fn<LifeArchiveClient['people']['mutateRecordContext']>()
      .mockResolvedValueOnce(
        ok({
          outcome: 'conflict',
          conflict: {
            expectedRevision: revision('3'),
            actualRevision: revision('4'),
            current,
          },
        }),
      )
      .mockResolvedValueOnce(
        ok({
          outcome: 'updated',
          current: { ...current, entryRevision: revision('5'), links: [] },
          invalidation: INVALIDATION,
        }),
      )
    const client: LifeArchiveClient = {
      ...base,
      people: { ...base.people, mutateRecordContext },
    }
    view(client)
    await screen.findByRole('heading', { name: 'People' })

    await user.click(screen.getByRole('button', { name: 'Clear People' }))
    expect(
      await screen.findByText(/People in this Entry changed elsewhere/),
    ).toBeInTheDocument()
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(mutateRecordContext).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expectedRevision: revision('4'),
        mutation: { kind: 'clearLinks' },
      }),
    )
    expect(
      await screen.findByText('No People are linked to this Entry.'),
    ).toBeInTheDocument()
  })

  it('creates durable optional-section presence only after Add Context is chosen', async () => {
    const user = userEvent.setup()
    const { client, mutateRecordContext } = makeClient(null)
    const onEntryRevision = view(client)
    expect(await screen.findByText('Add Context')).toBeInTheDocument()
    expect(mutateRecordContext).not.toHaveBeenCalled()

    await user.click(screen.getByText('Add Context'))
    await user.click(screen.getByRole('button', { name: 'People' }))
    await screen.findByRole('heading', { name: 'People' })
    expect(mutateRecordContext).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRevision: null,
        newEntryId: NEW_ENTRY_ID,
        mutation: { kind: 'addSection', sectionId: 'people' },
      }),
    )
    expect(onEntryRevision).toHaveBeenCalledWith(NEW_ENTRY_ID, revision('1'))
  })

  it('offers Add Context for an existing Entry whose People section is absent', async () => {
    const user = userEvent.setup()
    const hidden: EntryPeopleSnapshot = {
      ...INITIAL,
      sectionIds: [],
      peopleSectionVisible: false,
      links: [],
    }
    const { client, mutateRecordContext } = makeClient(hidden)
    view(client)

    await user.click(await screen.findByText('Add Context'))
    await user.click(screen.getByRole('button', { name: 'People' }))
    expect(mutateRecordContext).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRevision: hidden.entryRevision,
        newEntryId: null,
        mutation: { kind: 'addSection', sectionId: 'people' },
      }),
    )
  })

  it('restores the complete ordered snapshot with Undo and supports explicit reordering, clear, and remove-section', async () => {
    const user = userEvent.setup()
    const { client, mutateRecordContext } = makeClient()
    view(client)
    await screen.findByRole('heading', { name: 'People' })

    await user.click(
      screen.getByRole('button', { name: 'Remove Ada Lovelace' }),
    )
    await screen.findByText('Removed Ada Lovelace.')
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await screen.findByText('Ada Lovelace')
    expect(mutateRecordContext).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mutation: {
          kind: 'replaceLinks',
          links: [
            expect.objectContaining({ personId: ADA_ID }),
            expect.objectContaining({ personId: GRACE_ID }),
          ],
        },
      }),
    )

    await user.click(
      screen.getByRole('button', { name: 'Manage People in This Entry' }),
    )
    const manager = await screen.findByRole('dialog', {
      name: 'Manage People in This Entry',
    })
    await user.click(
      within(manager).getByRole('button', { name: 'Move Grace Hopper up' }),
    )
    expect(mutateRecordContext).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mutation: {
          kind: 'replaceLinks',
          links: [
            expect.objectContaining({ personId: GRACE_ID }),
            expect.objectContaining({ personId: ADA_ID }),
          ],
        },
      }),
    )
    await user.click(
      within(manager).getByRole('button', {
        name: 'Close People in This Entry manager',
      }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: 'Clear People' }))
    await screen.findByText('No People are linked to this Entry.')
    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Remove People Section' }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'People' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('keeps broad-record interaction unset and logs contact on an exact core-produced Day', async () => {
    const user = userEvent.setup()
    const base = makeClient().client
    const day = {
      id: 'day:2026-03-04',
      scale: 'day',
      startMs: 1,
      endMs: 2,
      startDate: civilDate('2026-03-04'),
      endDate: civilDate('2026-03-04'),
      weekNumber: 10,
      calendarId: 'gregorian',
      timeZoneId: 'Europe/Prague',
    } as TimeWindow
    const window = vi.fn<LifeArchiveClient['time']['window']>(async () =>
      ok(day),
    )
    const logContact = vi.fn<LifeArchiveClient['people']['logContact']>(
      async () =>
        ok({
          outcome: 'created',
          current: INITIAL,
          invalidation: INVALIDATION,
        }),
    )
    const client: LifeArchiveClient = {
      ...base,
      time: { ...base.time, window },
      people: { ...base.people, logContact },
    }
    view(client, vi.fn(), 'week', {
      minimum: civilDate('2026-03-01'),
      maximum: civilDate('2026-03-07'),
    })
    await screen.findByRole('heading', { name: 'People' })
    expect(logContact).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', {
        name: /Ada Lovelace.*Open Person context/,
      }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Person context for Ada Lovelace',
    })
    expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument()
    const contactDate = within(dialog).getByLabelText('Contact date')
    expect(contactDate).toHaveAttribute('min', '2026-03-01')
    expect(contactDate).toHaveAttribute('max', '2026-03-07')
    await user.type(contactDate, '2026-03-04')
    await user.click(
      within(dialog).getByRole('button', { name: 'Log Contact' }),
    )
    await waitFor(() => expect(logContact).toHaveBeenCalledOnce())
    expect(window).toHaveBeenCalledWith(
      expect.objectContaining({
        scale: 'day',
        containing: civilDate('2026-03-04'),
        weekRules: { firstWeekday: 2, minimumDaysInFirstWeek: 4 },
      }),
    )
    expect(logContact).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: ADA_ID,
        interactionLevel: 'brief',
        day,
        newEntryId: NEW_ENTRY_ID,
      }),
    )
  })
})
