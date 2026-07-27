import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import {
  clientFailure,
  failed,
  ok,
  revision,
  stableId,
  type ArchiveIdentity,
  type ArchiveOverview,
  type LifeArchiveClient,
  type StorageDurability,
  type StorageFacts,
} from '../../../core/client'
import { I18nProvider } from '../../../i18n'
import type { StoragePersistence } from '../../../platform/storage'
import { SettingsPage } from '../SettingsPage'
import { ArchiveManagementPage } from './ArchiveManagementPage'

const ARCHIVE_ID = stableId('7f1c0a10-0000-4000-8000-000000000001')
const SUBJECT_ID = stableId('7f1c0a10-0000-4000-8000-000000000002')
const INVALIDATION = {
  storeInstanceId: 'settings-test',
  revision: revision('4'),
}

const OVERVIEW: ArchiveOverview = {
  storeId: ARCHIVE_ID,
  storeSchemaVersion: '5',
  storeContract: '5',
  visibleEntryCount: 38,
  entryCounts: {
    moment: 0,
    day: 28,
    week: 1,
    month: 0,
    year: 0,
    custom: 9,
  },
  structuredCounts: { events: 4, spans: 2 },
  trackCounts: { active: 1, archived: 0, ongoingMembers: 1 },
  mediaCount: 11,
  mediaByteTotal: 41_900_000,
  health: {
    readable: true,
    schemaCompatible: true,
    recovery: 'clean',
    integrity: 'verified',
    referenceViolationCount: 0,
    overall: 'healthy',
  },
  invalidation: INVALIDATION,
}

function identity(parts: Partial<ArchiveIdentity> = {}): ArchiveIdentity {
  return {
    id: ARCHIVE_ID,
    title: 'Naan’s Archive',
    subject: {
      id: SUBJECT_ID,
      displayName: 'Naan',
      shortName: 'Naan',
      lifeStatus: 'living',
      dateOfBirth: null,
      dateOfDeath: null,
    },
    ...parts,
  }
}

function testClient({
  overview = ok(OVERVIEW),
  archiveIdentity = identity(),
  durability = 'durable',
}: {
  readonly overview?:
    | ReturnType<typeof ok<ArchiveOverview>>
    | ReturnType<typeof failed<ArchiveOverview>>
  readonly archiveIdentity?: ArchiveIdentity
  readonly durability?: StorageDurability
} = {}) {
  const runtimeFacts: StorageFacts = {
    backend: 'browser-runtime',
    durability,
    archiveOpen: true,
    grant: 'unknown',
    estimate: null,
  }
  const calls = {
    overview: vi.fn(() => Promise.resolve(overview)),
    identity: vi.fn(() =>
      Promise.resolve(
        ok({ identity: archiveIdentity, invalidation: INVALIDATION }),
      ),
    ),
    storage: vi.fn(() => Promise.resolve(ok(runtimeFacts))),
  }
  const client = {
    archive: { overview: calls.overview },
    identity: { load: calls.identity },
    runtime: { storage: calls.storage },
  } as unknown as LifeArchiveClient
  return { client, calls }
}

function persistence({
  grant = 'granted',
  estimate = {
    usedBytes: 52_000_000,
    quotaBytes: 2_000_000_000,
    approximate: true as const,
  },
}: {
  readonly grant?: Awaited<ReturnType<StoragePersistence['current']>>
  readonly estimate?: Awaited<ReturnType<StoragePersistence['estimate']>>
} = {}): StoragePersistence {
  return {
    current: vi.fn(() => Promise.resolve(grant)),
    request: vi.fn(() => Promise.resolve(grant)),
    estimate: vi.fn(() => Promise.resolve(estimate)),
  }
}

function renderSettings(
  client: LifeArchiveClient,
  storage: StoragePersistence = persistence(),
  locale = 'en',
) {
  return render(
    <I18nProvider locale={locale}>
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route
            path="/settings"
            element={<SettingsPage client={client} persistence={storage} />}
          />
          <Route
            path="/settings/archive"
            element={<ArchiveManagementPage client={client} />}
          />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}

describe('Settings archive overview', () => {
  it('renders identity, healthy overview, counts, media bytes, and browser facts from their authorities', async () => {
    const { client, calls } = testClient()
    const storage = persistence()
    renderSettings(client, storage)

    expect(
      await screen.findByRole('heading', { name: 'Naan’s Archive' }),
    ).toBeInTheDocument()
    const overview = screen.getByRole('region', { name: 'Naan’s Archive' })
    expect(within(overview).getAllByText('Healthy')).toHaveLength(2)
    expect(within(overview).getByText('38 total')).toBeInTheDocument()
    expect(within(overview).getByText('28 days')).toBeInTheDocument()
    expect(within(overview).getByText('1 week')).toBeInTheDocument()
    expect(within(overview).getByText('11 items · 41.9 MB')).toBeInTheDocument()

    const browserStorage = screen.getByRole('region', {
      name: 'Browser storage',
    })
    expect(
      within(browserStorage).getByText('Granted by this browser'),
    ).toBeInTheDocument()
    expect(
      within(browserStorage).getByText('52 MB used of approximately 2 GB'),
    ).toBeInTheDocument()
    expect(
      within(browserStorage).getByText('Reported as durable by the runtime'),
    ).toBeInTheDocument()

    expect(calls.overview).toHaveBeenCalledOnce()
    expect(calls.identity).toHaveBeenCalledOnce()
    expect(calls.storage).toHaveBeenCalledOnce()
    expect(storage.current).toHaveBeenCalledOnce()
    expect(storage.estimate).toHaveBeenCalledOnce()
  })

  it.each([
    [
      'best effort',
      'best-effort',
      'unknown',
      'Reported as best effort by the runtime',
      'Not confirmed by this browser',
    ],
    [
      'persistent',
      'durable',
      'granted',
      'Reported as durable by the runtime',
      'Granted by this browser',
    ],
  ] as const)(
    'keeps runtime durability and browser grant separate for %s storage',
    async (_case, durability, grant, durabilityText, grantText) => {
      const { client } = testClient({ durability })
      renderSettings(client, persistence({ grant }))

      expect(await screen.findByText(durabilityText)).toBeInTheDocument()
      expect(screen.getByText(grantText)).toBeInTheDocument()
    },
  )

  it('labels an unavailable browser estimate without inventing zero', async () => {
    const { client } = testClient()
    renderSettings(client, persistence({ estimate: null }))

    expect(
      await screen.findByText('No estimate available from this browser'),
    ).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/0 (?:B|bytes).*used/i)
  })

  it.each([
    ['subject display name', identity({ title: null }), 'Naan’s Archive'],
    [
      'generic identity',
      identity({
        title: null,
        subject: {
          ...identity().subject,
          displayName: null,
          shortName: null,
        },
      }),
      'Your Archive',
    ],
  ])('uses the localized %s title fallback', async (_case, value, title) => {
    const { client } = testClient({ archiveIdentity: value })
    renderSettings(client)
    expect(
      await screen.findByRole('heading', { name: title }),
    ).toBeInTheDocument()
  })

  it('formats large runtime counts without narrowing or enumerating records', async () => {
    const { client } = testClient({
      overview: ok({
        ...OVERVIEW,
        visibleEntryCount: 9_876_543,
        mediaCount: 1_234_567,
        mediaByteTotal: 1_200_000_000,
      }),
    })
    renderSettings(client)

    expect(await screen.findByText('9,876,543 total')).toBeInTheDocument()
    expect(screen.getByText('1,234,567 items · 1.2 GB')).toBeInTheDocument()
  })

  it('keeps the accessible Manage Archive navigation when overview loading fails', async () => {
    const unavailable = failed<ArchiveOverview>(
      clientFailure({
        area: 'archive',
        code: 'overviewUnavailable',
        phase: 'snapshot',
        retryable: true,
      }),
    )
    const { client } = testClient({ overview: unavailable })
    const user = userEvent.setup()
    renderSettings(client)

    expect(
      await screen.findByText(/overview could not be loaded/i),
    ).toBeInTheDocument()
    const manage = screen.getByRole('link', { name: /Manage Archive/ })
    expect(manage).toHaveAttribute('href', '/settings/archive')
    await user.click(manage)
    expect(
      screen.getByRole('heading', { name: 'Manage Archive' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Erase archive…' }),
    ).toBeInTheDocument()
  })
})
