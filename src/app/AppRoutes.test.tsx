import { StrictMode } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import {
  revision,
  stableId,
  type ArchiveSession,
  type OpenArchive,
  type RuntimeStatus,
} from '../core/client'
import type { AppBootstrap } from '../core/bootstrap'
import {
  FORBIDDEN_AVAILABILITY_CLAIMS,
  FORBIDDEN_PERSISTENCE_CLAIMS,
} from '../test/claims'
import { renderAppAt } from '../test/render'
import { FakeLifeArchiveClient } from '../test/FakeLifeArchiveClient'
import { AppShell } from './AppShell'
import { AppStateProvider } from './providers/AppStateProvider'

const ROUTES = [
  { path: '/', heading: 'Record' },
  { path: '/record', heading: 'Record' },
  { path: '/timeline', heading: 'Timeline' },
  { path: '/settings', heading: 'Settings' },
  { path: '/not-a-route', heading: 'Record' },
] as const

const OPEN_ARCHIVE: OpenArchive = {
  storeId: stableId('7f1c0a10-0000-4000-8000-000000000001'),
  productContract: 'test',
  storeSchemaVersion: 'test',
  rootLayoutVersion: 'test',
  invalidation: { storeInstanceId: 'test', revision: revision('1') },
}

const OPEN_SESSION: ArchiveSession = { state: 'open', archive: OPEN_ARCHIVE }

function clientWithSession(session: ArchiveSession): FakeLifeArchiveClient {
  return new FakeLifeArchiveClient(session)
}

function clientBootstrap(client: FakeLifeArchiveClient): AppBootstrap {
  return async () => ({
    state: 'client',
    client: client.client,
    developmentMock: true,
  })
}

describe('ready application routes', () => {
  it.each(ROUTES)('routes $path to $heading', async ({ path, heading }) => {
    renderAppAt(path)
    expect(
      await screen.findByRole('heading', { name: heading }),
    ).toBeInTheDocument()
  })

  it('navigates between feature boundaries', async () => {
    const user = userEvent.setup()
    renderAppAt('/')
    const nav = await screen.findByRole('navigation', { name: 'Main' })

    for (const heading of ['Timeline', 'Settings', 'Record']) {
      await user.click(within(nav).getByRole('link', { name: heading }))
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
  })

  it('keeps a direct deep link after asynchronous boot', async () => {
    let finish: ((value: Awaited<ReturnType<AppBootstrap>>) => void) | undefined
    const bootstrap: AppBootstrap = () =>
      new Promise((resolve) => {
        finish = resolve
      })

    renderAppAt('/timeline', bootstrap)
    expect(
      screen.getByRole('heading', { name: 'Starting LifeArchive' }),
    ).toBeInTheDocument()

    finish?.({
      state: 'client',
      client: clientWithSession(OPEN_SESSION).client,
      developmentMock: true,
    })
    expect(
      await screen.findByRole('heading', { name: 'Timeline' }),
    ).toBeInTheDocument()
  })
})

describe('application availability states', () => {
  it('shows booting without mounting feature routes', () => {
    renderAppAt('/record', () => new Promise(() => undefined))
    expect(
      screen.getByRole('heading', { name: 'Starting LifeArchive' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Record' })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
  })

  it('shows runtime unavailable with a retry action', async () => {
    const bootstrap = vi
      .fn<AppBootstrap>()
      .mockResolvedValueOnce({
        state: 'runtime',
        runtime: { state: 'unavailable', reason: 'not-integrated' },
      })
      .mockResolvedValueOnce({
        state: 'client',
        client: clientWithSession(OPEN_SESSION).client,
        developmentMock: true,
      })
    const user = userEvent.setup()
    renderAppAt('/record', bootstrap)

    expect(
      await screen.findByRole('heading', { name: 'LifeArchive cannot start' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Record' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()
    expect(bootstrap).toHaveBeenCalledTimes(2)
  })

  it('shows no archive, opening, locked, and fatal states explicitly', async () => {
    const cases: readonly [ArchiveSession, string][] = [
      [{ state: 'no-archive' }, 'Create your local archive'],
      [{ state: 'opening' }, 'Opening archive'],
      [{ state: 'open-in-another-tab' }, 'Archive in use'],
      [{ state: 'incompatible' }, 'LifeArchive is incompatible'],
    ]

    for (const [session, heading] of cases) {
      const view = renderAppAt(
        '/record',
        clientBootstrap(clientWithSession(session)),
      )
      expect(
        await screen.findByRole('heading', { name: heading }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Record' })).toBeNull()
      view.unmount()
    }
  })

  it('shows a fatal runtime incompatibility without editors', async () => {
    renderAppAt('/record', async () => ({
      state: 'runtime',
      runtime: { state: 'incompatible', reason: 'contract-mismatch' },
    }))
    expect(
      await screen.findByRole('heading', {
        name: 'LifeArchive is incompatible',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Record' })).toBeNull()
  })

  it('preserves the last confirmed route on recoverable runtime loss', async () => {
    const client = clientWithSession(OPEN_SESSION)
    renderAppAt('/timeline', clientBootstrap(client))
    expect(
      await screen.findByRole('heading', { name: 'Timeline' }),
    ).toBeInTheDocument()

    act(() => {
      client.emitRuntime({
        state: 'unavailable',
        reason: 'worker-lost',
      })
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /last confirmed view remains visible/i,
    )
    expect(
      screen.getByRole('heading', { name: 'Timeline' }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).queryAllByRole(
        'link',
      ),
    ).toEqual([])
  })

  it('shows recovery without inventing an empty archive', async () => {
    const client = clientWithSession({ state: 'needs-recovery' })
    renderAppAt('/record', clientBootstrap(client))
    expect(
      await screen.findByRole('heading', { name: 'Archive needs attention' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Record' })).toBeNull()
    expect(document.body).not.toHaveTextContent(/empty archive/i)
  })

  it('reacts to session and runtime observations', async () => {
    const client = clientWithSession({ state: 'no-archive' })
    renderAppAt('/settings', clientBootstrap(client))
    expect(
      await screen.findByRole('heading', { name: 'Create your local archive' }),
    ).toBeInTheDocument()

    act(() => client.emitSession({ state: 'opening' }))
    expect(
      await screen.findByRole('heading', { name: 'Opening archive' }),
    ).toBeInTheDocument()
    act(() => client.emitSession(OPEN_SESSION))
    expect(
      await screen.findByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
  })
})

describe('composition safety', () => {
  it('boots only once and leaves no live reactions under StrictMode', async () => {
    const client = clientWithSession(OPEN_SESSION)
    const bootstrap = vi.fn(clientBootstrap(client))
    const view = render(
      <StrictMode>
        <MemoryRouter initialEntries={['/record']}>
          <AppStateProvider bootstrap={bootstrap}>
            <AppShell />
          </AppStateProvider>
        </MemoryRouter>
      </StrictMode>,
    )

    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()
    expect(bootstrap).toHaveBeenCalledTimes(1)
    expect(client.subscriptionCounts()).toEqual({ runtime: 1, session: 1 })

    view.unmount()
    act(() => {
      client.emitSession({ state: 'opening' })
      client.emitRuntime({ state: 'checking' })
    })
    await waitFor(() => expect(document.body).toHaveTextContent(''))
  })

  it.each(ROUTES)('makes no forbidden claim on $path', async ({ path }) => {
    const { container } = renderAppAt(path)
    await screen.findByRole('navigation', { name: 'Main' })
    const text = container.textContent ?? ''

    for (const claim of [
      ...FORBIDDEN_PERSISTENCE_CLAIMS,
      ...FORBIDDEN_AVAILABILITY_CLAIMS,
    ]) {
      expect(text).not.toMatch(claim)
    }
  })

  it('does not expose feature routes for any unavailable runtime status', async () => {
    const statuses: RuntimeStatus[] = [
      { state: 'checking' },
      { state: 'unavailable', reason: 'worker-unsupported' },
      { state: 'incompatible', reason: 'abi-mismatch' },
    ]
    for (const status of statuses) {
      const client = clientWithSession(OPEN_SESSION)
      client.emitRuntime(status)
      const view = renderAppAt('/record', clientBootstrap(client))
      await waitFor(() =>
        expect(screen.queryByRole('heading', { name: 'Record' })).toBeNull(),
      )
      view.unmount()
    }
  })
})
