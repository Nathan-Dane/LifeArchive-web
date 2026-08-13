import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  clientFailure,
  civilDate,
  failed,
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
import {
  groupRecordPeople,
  toggleRecordPersonRole,
} from './recordPeoplePresentation'

const STORE_ID = stableId('a3000000-0000-4000-8000-000000000301')
const ENTRY_ID = stableId('a3000000-0000-4000-8000-000000000302')
const NEW_ENTRY_ID = stableId('a3000000-0000-4000-8000-000000000303')
const ADA_ID = stableId('a3000000-0000-4000-8000-000000000304')
const GRACE_ID = stableId('a3000000-0000-4000-8000-000000000305')
const MARGARET_ID = stableId('a3000000-0000-4000-8000-000000000306')
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
const MARGARET = person(MARGARET_ID as typeof ADA_ID, 'Margaret Hamilton')

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
          people: [snapshotOf(ADA), snapshotOf(GRACE), snapshotOf(MARGARET)],
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
    case 'upsertLink': {
      const existing = current.links.find(
        ({ person }) => person.id === mutation.link.personId,
      )
      const personValue = [ADA, GRACE, MARGARET].find(
        ({ id }) => id === mutation.link.personId,
      )!
      const next = existing ?? linked(personValue, current.links.length)
      return {
        ...current,
        entryRevision: revisionValue,
        links: existing
          ? current.links.map((value) =>
              value.person.id === mutation.link.personId
                ? {
                    ...value,
                    link: { ...value.link, ...mutation.link },
                  }
                : value,
            )
          : [
              ...current.links,
              {
                ...next,
                link: { ...next.link, ...mutation.link },
              },
            ],
      }
    }
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
  personActions?: {
    readonly onViewPerson?: React.ComponentProps<
      typeof RecordPeopleSection
    >['onViewPerson']
    readonly onEditPerson?: React.ComponentProps<
      typeof RecordPeopleSection
    >['onEditPerson']
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
        onViewPerson={personActions?.onViewPerson}
        onEditPerson={personActions?.onEditPerson}
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

    await user.click(
      screen.getByRole('button', { name: 'People section options' }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Clear People' }))
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
      screen.getByRole('button', {
        name: /Ada Lovelace.*Open Person context/,
      }),
    )
    const task = await screen.findByRole('dialog', {
      name: /Ada Lovelace/,
    })
    await user.click(
      within(task).getByRole('button', { name: 'Remove from This Entry' }),
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

    await user.click(
      screen.getByRole('button', { name: 'People section options' }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Clear People' }))
    await screen.findByText('No People are linked to this Entry.')
    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'People section options' }),
    )
    await user.click(
      screen.getByRole('menuitem', { name: 'Remove People Section' }),
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
      name: /Ada Lovelace/,
    })
    expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: 'Choose Contact date' }),
    )
    const calendar = await screen.findByRole('dialog', {
      name: 'Choose Contact date',
    })
    await user.click(
      within(calendar).getByRole('gridcell', { name: 'March 4, 2026' }),
    )
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

  it('projects the hierarchy by visual priority without flattening independent context', () => {
    const included = linked(ADA, 0)
    const brief = {
      ...linked(GRACE, 1),
      link: {
        ...linked(GRACE, 1).link,
        interactionLevel: 'brief' as const,
        tookPart: true,
      },
    }
    const together = {
      ...linked(MARGARET, 2),
      link: {
        ...linked(MARGARET, 2).link,
        interactionLevel: 'timeTogether' as const,
      },
    }
    const about = {
      ...linked(ADA, 3),
      link: {
        ...linked(ADA, 3).link,
        interactionLevel: 'timeTogether' as const,
        tookPart: true,
        isSubject: true,
      },
    }

    const groups = groupRecordPeople([included, brief, together, about])
    expect(groups.included).toEqual([included])
    expect(groups.brief).toEqual([brief])
    expect(groups.together).toEqual([together])
    expect(groups.about).toEqual([about])

    const original = {
      personId: ADA_ID,
      interactionLevel: 'brief' as const,
      tookPart: true,
      isSubject: true,
    }
    expect(toggleRecordPersonRole(original, 'together')).toEqual({
      ...original,
      interactionLevel: 'timeTogether',
    })
    expect(toggleRecordPersonRole(original, 'included')).toEqual({
      ...original,
      tookPart: false,
    })
    expect(toggleRecordPersonRole(original, 'about')).toEqual({
      ...original,
      isSubject: false,
    })
  })

  it('updates all independent role dimensions in place with check-free pressed controls', async () => {
    const user = userEvent.setup()
    const { client, mutateRecordContext } = makeClient()
    view(client)
    await screen.findByRole('heading', { name: 'People' })
    await user.click(
      screen.getByRole('button', {
        name: /Ada Lovelace.*Open Person context/,
      }),
    )
    const dialog = await screen.findByRole('dialog', { name: /Ada Lovelace/ })
    const included = within(dialog).getByRole('button', { name: 'Included' })
    const brief = within(dialog).getByRole('button', { name: 'Brief' })
    const about = within(dialog).getByRole('button', { name: 'About' })

    expect(included).toHaveAttribute('aria-pressed', 'false')
    await user.click(included)
    await waitFor(() =>
      expect(mutateRecordContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          mutation: {
            kind: 'upsertLink',
            link: {
              personId: ADA_ID,
              interactionLevel: 'none',
              tookPart: true,
              isSubject: false,
            },
          },
        }),
      ),
    )
    expect(included).toHaveAttribute('aria-pressed', 'true')

    await user.click(brief)
    await waitFor(() => expect(brief).toHaveAttribute('aria-pressed', 'true'))
    await user.click(about)
    await waitFor(() => expect(about).toHaveAttribute('aria-pressed', 'true'))
    expect(mutateRecordContext).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mutation: {
          kind: 'upsertLink',
          link: {
            personId: ADA_ID,
            interactionLevel: 'brief',
            tookPart: true,
            isSubject: true,
          },
        },
      }),
    )
    expect(dialog.querySelector('[data-icon="check"]')).toBeNull()
    expect(dialog.closest('.record-overlay')).toHaveAttribute(
      'data-placement',
      'center',
    )
  })

  it('assigns an unlinked Person through the unified manager without plus or check controls', async () => {
    const user = userEvent.setup()
    const { client, mutateRecordContext } = makeClient()
    view(client)
    await screen.findByRole('heading', { name: 'People' })
    await user.click(
      screen.getByRole('button', { name: 'Manage People in This Entry' }),
    )
    const manager = await screen.findByRole('dialog', {
      name: 'Manage People in This Entry',
    })
    expect(manager.closest('.record-overlay')).toHaveAttribute(
      'data-placement',
      'center',
    )
    expect(
      within(manager).queryByRole('button', { name: /add Margaret/i }),
    ).not.toBeInTheDocument()
    const margaretRow = within(manager)
      .getByText('Margaret Hamilton')
      .closest('article')!
    const together = within(margaretRow).getByRole('button', {
      name: 'Together',
    })
    expect(together).toHaveAttribute('aria-pressed', 'false')
    await user.click(together)
    await waitFor(() =>
      expect(mutateRecordContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          mutation: {
            kind: 'upsertLink',
            link: {
              personId: MARGARET_ID,
              interactionLevel: 'timeTogether',
              tookPart: false,
              isSubject: false,
            },
          },
        }),
      ),
    )
    expect(
      within(manager).getByRole('button', {
        name: 'Remove Margaret Hamilton',
      }),
    ).toBeInTheDocument()
  })

  it('quick-creates from Record, attaches Included, then opens the canonical editor', async () => {
    const user = userEvent.setup()
    const made = makeClient()
    const create = vi.fn<LifeArchiveClient['people']['create']>(async () =>
      ok({
        outcome: 'created',
        current: snapshotOf(MARGARET),
        invalidation: INVALIDATION,
      }),
    )
    const client: LifeArchiveClient = {
      ...made.client,
      people: { ...made.client.people, create },
    }
    const onEditPerson = vi.fn()
    view(client, vi.fn(), 'day', undefined, { onEditPerson })
    await screen.findByRole('heading', { name: 'People' })
    await user.click(
      screen.getByRole('button', { name: 'Manage People in This Entry' }),
    )
    const manager = await screen.findByRole('dialog', {
      name: 'Manage People in This Entry',
    })
    const createOpener = within(manager).getByRole('button', {
      name: 'New Person',
    })
    await user.click(createOpener)
    const task = await screen.findByRole('dialog', { name: 'New Person' })
    expect(task.closest('.record-overlay')).toHaveAttribute(
      'data-placement',
      'center',
    )
    await user.type(
      within(task).getByRole('textbox', { name: 'Name' }),
      'Katherine Johnson',
    )
    await user.click(
      within(task).getByRole('button', { name: 'Create and continue' }),
    )

    await waitFor(() =>
      expect(made.mutateRecordContext).toHaveBeenLastCalledWith(
        expect.objectContaining({
          mutation: {
            kind: 'upsertLink',
            link: {
              personId: MARGARET_ID,
              interactionLevel: 'none',
              tookPart: true,
              isSubject: false,
            },
          },
        }),
      ),
    )
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: expect.objectContaining({ displayName: 'Katherine Johnson' }),
      }),
    )
    expect(onEditPerson).toHaveBeenCalledWith(MARGARET_ID, createOpener)
  })

  it('retries only the Record attachment when quick-create already succeeded', async () => {
    const user = userEvent.setup()
    const made = makeClient()
    made.mutateRecordContext.mockResolvedValueOnce(
      failed(
        clientFailure({
          area: 'person',
          code: 'ioFailure',
          phase: 'mutation',
          retryable: true,
        }),
      ),
    )
    const create = vi.fn<LifeArchiveClient['people']['create']>(async () =>
      ok({
        outcome: 'created',
        current: snapshotOf(MARGARET),
        invalidation: INVALIDATION,
      }),
    )
    const client: LifeArchiveClient = {
      ...made.client,
      people: { ...made.client.people, create },
    }
    const onEditPerson = vi.fn()
    view(client, vi.fn(), 'day', undefined, { onEditPerson })
    await screen.findByRole('heading', { name: 'People' })
    await user.click(
      screen.getByRole('button', { name: 'Manage People in This Entry' }),
    )
    await user.click(screen.getByRole('button', { name: 'New Person' }))
    const task = await screen.findByRole('dialog', { name: 'New Person' })
    await user.type(
      within(task).getByRole('textbox', { name: 'Name' }),
      'Katherine Johnson',
    )
    await user.click(
      within(task).getByRole('button', { name: 'Create and continue' }),
    )

    expect(
      await within(task).findByText(
        /Person was created, but could not be added/,
      ),
    ).toBeVisible()
    expect(within(task).getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Katherine Johnson',
    )
    await user.click(within(task).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(onEditPerson).toHaveBeenCalledOnce())
    expect(create).toHaveBeenCalledOnce()
    expect(made.mutateRecordContext).toHaveBeenCalledTimes(2)
  })

  it('hands canonical View and Edit actions to the route origin coordinator', async () => {
    const user = userEvent.setup()
    const { client } = makeClient()
    const onViewPerson = vi.fn()
    const onEditPerson = vi.fn()
    view(client, vi.fn(), 'day', undefined, {
      onViewPerson,
      onEditPerson,
    })
    await screen.findByRole('heading', { name: 'People' })
    const personOpener = screen.getByRole('button', {
      name: /Ada Lovelace.*Open Person context/,
    })
    await user.click(personOpener)
    const dialog = await screen.findByRole('dialog', { name: /Ada Lovelace/ })
    const viewButton = within(dialog).getByRole('button', {
      name: 'View Person',
    })
    await user.click(viewButton)
    expect(onViewPerson).toHaveBeenCalledWith(ADA_ID, personOpener)
    const editButton = within(dialog).getByRole('button', {
      name: 'Edit Person',
    })
    await user.click(editButton)
    expect(onEditPerson).toHaveBeenCalledWith(ADA_ID, personOpener)
  })
})
