import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  clientFailure,
  failed,
  ok,
  revision,
  stableId,
  type ArchiveEraseResult,
  type ArchiveIdentityState,
  type ArchiveOverview,
  type ClientResult,
  type LifeArchiveClient,
} from '../../../core/client'
import { I18nProvider } from '../../../i18n'
import { ArchiveErasePanel } from './ArchiveErasePanel'

const OLD_ARCHIVE_ID = stableId('7F1C0A10-0000-4000-8000-000000000010')
const FRESH_ARCHIVE_ID = stableId('7F1C0A10-0000-4000-8000-000000000011')
const FRESH_SUBJECT_ID = stableId('7F1C0A10-0000-4000-8000-000000000012')
const INVALIDATION = {
  storeInstanceId: 'fresh-archive',
  revision: revision('1'),
}
const ERASED: ArchiveEraseResult = {
  outcome: 'erased',
  invalidation: INVALIDATION,
}
const FRESH_OVERVIEW: ArchiveOverview = {
  storeId: FRESH_ARCHIVE_ID,
  storeSchemaVersion: '5',
  storeContract: '5',
  visibleEntryCount: 0,
  entryCounts: {
    day: 0,
    week: 0,
    month: 0,
    year: 0,
    event: 0,
    span: 0,
  },
  structuredCounts: { events: 0, spans: 0 },
  trackCounts: { active: 0, archived: 0, ongoingMembers: 0 },
  mediaCount: 0,
  mediaByteTotal: 0,
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
const FRESH_IDENTITY: ArchiveIdentityState = {
  identity: {
    id: FRESH_ARCHIVE_ID,
    title: null,
    subject: {
      id: FRESH_SUBJECT_ID,
      displayName: null,
      shortName: null,
      lifeStatus: 'unspecified',
      dateOfBirth: null,
      dateOfDeath: null,
    },
  },
  invalidation: INVALIDATION,
}

function eraseFailure(
  code: string,
  durableOutcome: 'known' | 'not-started' | 'unknown',
  cleanup: 'complete' | 'incomplete' | null = null,
) {
  return clientFailure({
    area: 'archive',
    code,
    phase: 'mutation',
    retryable: durableOutcome !== 'unknown',
    durableOutcome,
    cleanup,
    subject: { kind: 'archive', id: OLD_ARCHIVE_ID },
  })
}

function clientFor(
  eraseResult: ClientResult<ArchiveEraseResult> = ok(ERASED),
  overviewResult: ClientResult<ArchiveOverview> = ok(FRESH_OVERVIEW),
) {
  const erase = vi.fn(() => Promise.resolve(eraseResult))
  const overview = vi.fn(() => Promise.resolve(overviewResult))
  const loadIdentity = vi.fn(() => Promise.resolve(ok(FRESH_IDENTITY)))
  return {
    client: {
      archive: { erase, overview },
      identity: { load: loadIdentity },
    } as unknown as LifeArchiveClient,
    erase,
    overview,
    loadIdentity,
  }
}

function renderPanel(client: LifeArchiveClient) {
  return render(
    <I18nProvider locale="en">
      <ArchiveErasePanel client={client} />
    </I18nProvider>,
  )
}

async function openConfirmation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Erase archive…' }))
  return screen.getByRole('alertdialog', {
    name: 'Erase this archive permanently?',
  })
}

describe('Archive erase presentation', () => {
  it('does not erase when deliberate confirmation is cancelled', async () => {
    const { client, erase, overview } = clientFor()
    const user = userEvent.setup()
    renderPanel(client)

    const confirmation = await openConfirmation(user)
    expect(confirmation.tagName).toBe('DIALOG')
    expect(
      within(confirmation).getByText(/previously downloaded exports/i),
    ).toBeInTheDocument()
    await user.click(
      within(confirmation).getByRole('button', { name: 'Cancel' }),
    )

    expect(erase).not.toHaveBeenCalled()
    expect(overview).not.toHaveBeenCalled()
    const request = screen.getByRole('button', { name: 'Erase archive…' })
    expect(request).toBeInTheDocument()
    await waitFor(() => expect(request).toHaveFocus())
  })

  it('contains keyboard focus, closes with Escape, and restores the erase trigger', async () => {
    const { client, erase } = clientFor()
    const user = userEvent.setup()
    renderPanel(client)
    const request = screen.getByRole('button', { name: 'Erase archive…' })

    const confirmation = await openConfirmation(user)
    expect(confirmation).toHaveAttribute('aria-modal', 'true')
    expect(confirmation).toHaveAccessibleName('Erase this archive permanently?')
    expect(confirmation).toHaveAccessibleDescription(
      'This removes all writing, structured records, media, and identity stored in this browser. This action cannot be undone. Previously downloaded exports are separate files and will not be deleted.',
    )

    const cancel = within(confirmation).getByRole('button', { name: 'Cancel' })
    const confirm = within(confirmation).getByRole('button', {
      name: 'Erase this archive',
    })
    expect(cancel).toHaveFocus()

    const outsideHeading = screen.getByRole('heading', {
      name: 'Erase this archive',
      level: 2,
    })
    outsideHeading.tabIndex = -1
    outsideHeading.focus()
    expect(cancel).toHaveFocus()

    await user.tab()
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
    await user.tab({ shift: true })
    expect(confirm).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(request).toHaveFocus())
    expect(erase).not.toHaveBeenCalled()
  })

  it('calls one coordinated erase and shows only the freshly read identity and empty state after success', async () => {
    let finishErase:
      ((result: ClientResult<ArchiveEraseResult>) => void) | undefined
    const pendingErase = new Promise<ClientResult<ArchiveEraseResult>>(
      (resolve) => {
        finishErase = resolve
      },
    )
    const { client, erase, overview, loadIdentity } = clientFor()
    erase.mockReturnValueOnce(pendingErase)
    const user = userEvent.setup()
    renderPanel(client)

    const confirmation = await openConfirmation(user)
    await user.click(
      within(confirmation).getByRole('button', {
        name: 'Erase this archive',
      }),
    )
    expect(erase).toHaveBeenCalledOnce()
    expect(erase).toHaveBeenCalledWith({
      confirmation: 'erase-this-archive',
    })
    expect(overview).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('heading', { name: 'Fresh archive created' }),
    ).not.toBeInTheDocument()

    finishErase?.(ok(ERASED))
    expect(
      await screen.findByRole('heading', { name: 'Fresh archive created' }),
    ).toBeInTheDocument()
    expect(overview).toHaveBeenCalledOnce()
    expect(loadIdentity).toHaveBeenCalledOnce()
    expect(
      screen.getByText(
        'Your Archive now has a fresh identity and an empty local store.',
      ),
    ).toBeInTheDocument()
    const result = screen.getByRole('heading', {
      name: 'Fresh archive created',
    }).parentElement
    expect(result).not.toBeNull()
    expect(within(result!).getAllByText('0')).toHaveLength(2)
    expect(screen.getByText(/exports are separate files/i)).toBeInTheDocument()
  })

  it('preserves failure evidence and requires confirmation again after a definitive pre-commit failure', async () => {
    const { client, erase } = clientFor(
      failed(eraseFailure('ioFailure', 'not-started')),
    )
    const user = userEvent.setup()
    renderPanel(client)

    let confirmation = await openConfirmation(user)
    await user.click(
      within(confirmation).getByRole('button', {
        name: 'Erase this archive',
      }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'The archive was not erased',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/prior archive and recovery evidence remain available/i),
    ).toBeInTheDocument()
    expect(erase).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Try erase again…' }))
    confirmation = screen.getByRole('alertdialog')
    expect(erase).toHaveBeenCalledOnce()
    expect(
      within(confirmation).getByRole('button', {
        name: 'Erase this archive',
      }),
    ).toBeInTheDocument()
  })

  it.each([
    [
      'an outcome lost after durable work started',
      'worker-lost',
      'unknown',
      null,
    ],
    ['pending media recovery', 'recoveryIncomplete', 'known', 'incomplete'],
  ] as const)(
    'keeps a recovery path and never automatically retries for %s',
    async (_case, code, durableOutcome, cleanup) => {
      const { client, erase, overview } = clientFor(
        failed(eraseFailure(code, durableOutcome, cleanup)),
      )
      const user = userEvent.setup()
      renderPanel(client)

      const confirmation = await openConfirmation(user)
      await user.click(
        within(confirmation).getByRole('button', {
          name: 'Erase this archive',
        }),
      )

      expect(
        await screen.findByRole('heading', { name: 'Recovery is required' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Reload and recover' }),
      ).toBeInTheDocument()
      expect(erase).toHaveBeenCalledOnce()
      expect(overview).not.toHaveBeenCalled()
    },
  )

  it('retries only the fresh archive reads when post-success overview decoding fails', async () => {
    const { client, erase, overview } = clientFor(
      ok(ERASED),
      failed(eraseFailure('overviewDecodeFailed', 'not-started')),
    )
    const user = userEvent.setup()
    renderPanel(client)

    const confirmation = await openConfirmation(user)
    await user.click(
      within(confirmation).getByRole('button', {
        name: 'Erase this archive',
      }),
    )
    expect(
      await screen.findByRole('heading', { name: 'The archive was erased' }),
    ).toBeInTheDocument()
    expect(erase).toHaveBeenCalledOnce()

    overview.mockResolvedValueOnce(ok(FRESH_OVERVIEW))
    await user.click(
      screen.getByRole('button', { name: 'Check fresh archive' }),
    )
    await waitFor(() => expect(overview).toHaveBeenCalledTimes(2))
    expect(erase).toHaveBeenCalledOnce()
    expect(
      await screen.findByRole('heading', { name: 'Fresh archive created' }),
    ).toBeInTheDocument()
  })
})
