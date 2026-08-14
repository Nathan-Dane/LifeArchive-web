import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  clientFailure,
  failed,
  revision,
  stableId,
  type LifeArchiveClient,
  type PersonSnapshot,
} from '../../core/client'
import { I18nProvider } from '../../i18n'
import { TestLifeArchiveClient } from '../../test/TestLifeArchiveClient'
import { PersonEditorPage } from './PersonEditorPage'
import { PersonProfilePage } from './PersonProfilePage'
import type { People } from './usePeople'

const STORE_ID = stableId('b4000000-0000-4000-8000-000000000001')
const PERSON_ID = stableId('b4000000-0000-4000-8000-000000000002')
const DUPLICATE_ID = stableId('b4000000-0000-4000-8000-000000000003')
const INVALIDATION = {
  storeInstanceId: 'person-pages-test',
  revision: revision('3'),
}

const SELECTED: PersonSnapshot = {
  person: {
    id: PERSON_ID,
    displayName: 'Maya Chen',
    connectionLabels: ['Friend', 'Choir'],
    about: 'A close friend from Copenhagen.',
    otherNames: [{ kindId: 'nickname', value: 'May' }],
    pronouns: 'she/her',
    pronunciation: 'MY-ah',
    lifeStatus: 'living',
    birthDate: {
      precision: 'month',
      year: 1990,
      month: 5,
      day: null,
      approximate: true,
    },
    deathDate: null,
    references: [
      {
        kindId: 'personalWebsite',
        label: 'Portfolio',
        url: 'https://example.com/maya',
      },
    ],
    isArchived: false,
    createdAtMs: 1,
    updatedAtMs: 2,
    deletedAtMs: null,
    mergedIntoPersonId: null,
  },
  revision: revision('2'),
  profilePhoto: {
    id: stableId('b4000000-0000-4000-8000-000000000004'),
    personId: PERSON_ID,
    fileName: 'maya.jpg',
    mimeType: 'image/jpeg',
    sha256: null,
    byteSize: 3,
    createdAtMs: 1,
    capturedAtMs: null,
    width: null,
    height: null,
  },
  lastRecordedContactDate: null,
}

const DUPLICATE: PersonSnapshot = {
  ...SELECTED,
  person: {
    ...SELECTED.person,
    id: DUPLICATE_ID,
    displayName: 'Maya C.',
  },
  profilePhoto: null,
}

function makeClient(): LifeArchiveClient {
  const base = new TestLifeArchiveClient({
    state: 'open',
    archive: {
      storeId: STORE_ID,
      productContract: '11',
      storeSchemaVersion: '12',
      rootLayoutVersion: '1',
      invalidation: INVALIDATION,
    },
  }).client
  return {
    ...base,
    media: {
      ...base.media,
      content: async () =>
        failed(
          clientFailure({
            area: 'media',
            code: 'ioFailure',
            phase: 'media',
            retryable: false,
          }),
        ),
    },
  }
}

function makePeople(overrides: Partial<People> = {}): People {
  return {
    state: {
      status: 'ready',
      people: [SELECTED, DUPLICATE],
      hasMore: false,
      nextCursor: null,
      query: '',
      listedQuery: '',
      selected: SELECTED,
      draft: {
        displayName: SELECTED.person.displayName,
        connectionLabels: SELECTED.person.connectionLabels,
        about: SELECTED.person.about,
        otherNames: SELECTED.person.otherNames,
        pronouns: SELECTED.person.pronouns,
        pronunciation: SELECTED.person.pronunciation,
        lifeStatus: SELECTED.person.lifeStatus,
        birthDate: SELECTED.person.birthDate,
        deathDate: SELECTED.person.deathDate,
        references: SELECTED.person.references,
      },
      creating: false,
      failure: null,
      conflict: null,
      invalidation: INVALIDATION,
      memories: [],
      memoriesHasMore: false,
      contactSummary: null,
      contactHistory: null,
      contactRange: 'thirtyDays',
      contactLogStatus: 'idle',
      contactLogFailure: null,
      mergeConflict: false,
      pendingMutation: null,
    },
    list: vi.fn(async () => true),
    loadMore: vi.fn(async () => true),
    select: vi.fn(async () => true),
    startCreate: vi.fn(),
    closeEditor: vi.fn(),
    update: vi.fn(),
    setQuery: vi.fn(),
    create: vi.fn(async () => null),
    save: vi.fn(async () => true),
    saveMine: vi.fn(async () => true),
    useArchiveVersion: vi.fn(),
    setArchived: vi.fn(async () => true),
    importPhoto: vi.fn(async () => true),
    removePhoto: vi.fn(async () => true),
    deletePerson: vi.fn(async () => true),
    merge: vi.fn(async () => true),
    retryMutation: vi.fn(async () => true),
    dismissMutationConflict: vi.fn(),
    loadMoreMemories: vi.fn(async () => undefined),
    loadContactHistory: vi.fn(async () => true),
    logContact: vi.fn(async () => true),
    resetContactLog: vi.fn(),
    active: true,
    ...overrides,
  } as People
}

function renderPage(node: ReactNode) {
  return render(
    <MemoryRouter>
      <I18nProvider locale="en-GB">{node}</I18nProvider>
    </MemoryRouter>,
  )
}

describe('Person routed pages', () => {
  it('renders the complete read-only profile and exact profile action order', async () => {
    const user = userEvent.setup()
    const people = makePeople()
    const onEdit = vi.fn()
    const onDeleted = vi.fn()
    renderPage(
      <PersonProfilePage
        client={makeClient()}
        people={people}
        onBack={vi.fn()}
        onEdit={onEdit}
        onDeleted={onDeleted}
      />,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Maya Chen',
    )
    const breadcrumbs = screen.getByRole('navigation', {
      name: 'People breadcrumb',
    })
    expect(
      within(breadcrumbs).getByRole('link', { name: 'Index' }),
    ).toHaveAttribute('href', '/index')
    expect(within(breadcrumbs).getByText('Maya Chen')).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByText('A close friend from Copenhagen.')).toBeVisible()
    expect(screen.getByText('May')).toBeVisible()
    expect(screen.getByText('About May 1990')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Portfolio' })).toHaveAttribute(
      'href',
      'https://example.com/maya',
    )

    const actions = screen.getByLabelText('Person actions')
    expect(
      within(actions)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Edit Person', 'Archive Person', 'Delete Person'])

    await user.click(
      within(actions).getByRole('button', { name: 'Edit Person' }),
    )
    expect(onEdit).toHaveBeenCalledOnce()
    await user.click(
      within(actions).getByRole('button', { name: 'Archive Person' }),
    )
    expect(people.setArchived).toHaveBeenCalledWith(true)

    await user.click(
      within(actions).getByRole('button', { name: 'Delete Person' }),
    )
    const task = screen.getByRole('dialog', { name: 'Delete Person' })
    expect(task.parentElement).toHaveAttribute('data-placement', 'center')
    await user.click(
      within(task).getByRole('button', { name: 'Delete Person' }),
    )
    expect(people.deletePerson).toHaveBeenCalledOnce()
    expect(onDeleted).toHaveBeenCalledOnce()
  })

  it('logs contact from a centered one-tap task', async () => {
    const user = userEvent.setup()
    const people = makePeople()
    renderPage(
      <PersonProfilePage
        client={makeClient()}
        people={people}
        onBack={vi.fn()}
        onEdit={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Log Contact' }))
    const task = screen.getByRole('dialog', { name: 'Log Contact' })
    expect(task.parentElement).toHaveAttribute('data-placement', 'center')
    const choices = within(task).getByRole('group', { name: 'Contact kind' })
    expect(
      within(choices)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Brief', 'Involved', 'Activity', 'Central'])
    await user.click(
      within(choices).getByRole('button', { name: /^Activity\./ }),
    )
    expect(people.logContact).toHaveBeenCalledWith(
      expect.any(String),
      'activity',
    )
  })

  it('shares every production field and keeps editor rail actions in order', async () => {
    const user = userEvent.setup()
    const people = makePeople()
    const onViewProfile = vi.fn()
    const onSaved = vi.fn()
    renderPage(
      <PersonEditorPage
        client={makeClient()}
        people={people}
        onBack={vi.fn()}
        onViewProfile={onViewProfile}
        onSaved={onSaved}
        onDeleted={vi.fn()}
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Maya Chen',
    )
    const breadcrumbs = screen.getByRole('navigation', {
      name: 'People breadcrumb',
    })
    await user.click(
      within(breadcrumbs).getByRole('button', { name: 'Maya Chen' }),
    )
    expect(onViewProfile).toHaveBeenCalledOnce()
    onViewProfile.mockClear()
    expect(within(breadcrumbs).getByText('Edit')).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('textbox', { name: 'About' })).toHaveValue(
      'A close friend from Copenhagen.',
    )
    expect(screen.getByRole('group', { name: 'Birth date' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Death date' })).toBeVisible()
    expect(screen.getByLabelText('Reference 1 URL')).toHaveValue(
      'https://example.com/maya',
    )
    expect(screen.getByRole('button', { name: 'Choose photo' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Remove photo' }),
    ).toBeInTheDocument()

    const actions = screen.getByLabelText('Person actions')
    expect(
      within(actions)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual([
      'Save Changes',
      'View Profile',
      'Archive Person',
      'Merge with another Person',
      'Delete Person',
    ])

    await user.click(
      within(actions).getByRole('button', { name: 'Save Changes' }),
    )
    expect(people.save).toHaveBeenCalledOnce()
    expect(onSaved).toHaveBeenCalledOnce()
    await user.click(
      within(actions).getByRole('button', { name: 'View Profile' }),
    )
    expect(onViewProfile).toHaveBeenCalledOnce()

    await user.click(
      within(actions).getByRole('button', {
        name: 'Merge with another Person',
      }),
    )
    const task = screen.getByRole('dialog', {
      name: 'Merge duplicate Person',
    })
    expect(task.parentElement).toHaveAttribute('data-placement', 'center')
    await user.click(
      within(task).getByRole('button', { name: 'Duplicate Person' }),
    )
    await user.click(screen.getByRole('menuitemradio', { name: 'Maya C.' }))
    await user.click(within(task).getByRole('button', { name: 'Merge' }))
    expect(people.merge).toHaveBeenCalledWith(
      DUPLICATE,
      expect.objectContaining({
        displayNameSource: 'retained',
        aboutSource: 'retained',
        photoSource: 'retained',
      }),
    )
  })
})
