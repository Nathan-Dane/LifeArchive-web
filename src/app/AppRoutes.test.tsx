import { StrictMode } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clientFailure,
  failed,
  ok,
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
import { enMessages } from '../i18n/messages/en'
import { renderAppAt } from '../test/render'
import { TestLifeArchiveClient } from '../test/TestLifeArchiveClient'
import { setClientMedia } from '../test/clientMedia'
import { BROWSER_PREFERENCE_STORAGE_KEYS } from '../features/settings'
import { AppShell } from './AppShell'
import { AppStateProvider } from './providers/AppStateProvider'

const ROUTES = [
  { path: '/', heading: 'Record' },
  { path: '/record', heading: 'Record' },
  { path: '/timeline', heading: 'Timeline' },
  { path: '/settings', heading: 'Overview' },
  { path: '/settings/overview', heading: 'Overview' },
  { path: '/settings/life-details', heading: 'Life Details' },
  { path: '/settings/general', heading: 'General' },
  { path: '/settings/appearance', heading: 'Appearance' },
  { path: '/settings/record', heading: 'Record' },
  { path: '/settings/timeline', heading: 'Timeline' },
  { path: '/settings/about', heading: 'About' },
  { path: '/settings/not-a-destination', heading: 'Overview' },
  { path: '/settings/archive', heading: 'Manage Archive' },
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

beforeEach(() => {
  globalThis.localStorage.clear()
})

function clientWithSession(session: ArchiveSession): TestLifeArchiveClient {
  return new TestLifeArchiveClient(session)
}

function clientBootstrap(client: TestLifeArchiveClient): AppBootstrap {
  return async () => ({
    state: 'client',
    client: client.client,
    developmentMock: true,
  })
}

function runtimeBootstrap(client: TestLifeArchiveClient): AppBootstrap {
  return async () => ({
    state: 'client',
    client: client.client,
    developmentMock: false,
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

    for (const heading of ['Timeline', 'Overview', 'Record']) {
      const linkName = heading === 'Overview' ? 'Settings' : heading
      await user.click(within(nav).getByRole('link', { name: linkName }))
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
  })

  it('resolves the Settings index and invalid destinations to Overview', async () => {
    function LocationProbe() {
      return <output>{useLocation().pathname}</output>
    }

    const indexView = renderAppAt('/settings', undefined, {
      within: <LocationProbe />,
    })
    expect(
      await screen.findByRole('heading', { name: 'Overview' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('/settings/overview', { selector: 'output' }),
    ).toBeInTheDocument()
    indexView.unmount()

    renderAppAt('/settings/unknown', undefined, {
      within: <LocationProbe />,
    })
    expect(
      await screen.findByRole('heading', { name: 'Overview' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('/settings/overview', { selector: 'output' }),
    ).toBeInTheDocument()
  })

  it('applies the browser startup destination only at the root address', async () => {
    globalThis.localStorage.setItem(
      BROWSER_PREFERENCE_STORAGE_KEYS.openAppTo,
      'timeline',
    )
    renderAppAt('/')
    expect(
      await screen.findByRole('heading', { name: 'Timeline' }),
    ).toBeInTheDocument()
  })

  it('restores the last Record or Timeline destination at startup', async () => {
    globalThis.localStorage.setItem(
      BROWSER_PREFERENCE_STORAGE_KEYS.openAppTo,
      'last',
    )
    globalThis.localStorage.setItem(
      BROWSER_PREFERENCE_STORAGE_KEYS.lastOpenedPage,
      'timeline',
    )
    renderAppAt('/')
    expect(
      await screen.findByRole('heading', { name: 'Timeline' }),
    ).toBeInTheDocument()
  })

  it('navigates Settings destinations and keeps Settings active globally', async () => {
    const user = userEvent.setup()
    renderAppAt('/settings/overview')

    const main = await screen.findByRole('navigation', { name: 'Main' })
    expect(
      within(main).getByRole('link', { name: 'Settings' }),
    ).toHaveAttribute('aria-current', 'page')
    const settings = screen.getByRole('navigation', { name: 'Settings' })
    expect(
      within(settings).getByRole('link', { name: 'Overview' }),
    ).toHaveAttribute('aria-current', 'page')

    await user.click(within(settings).getByRole('link', { name: 'Appearance' }))
    expect(
      screen.getByRole('heading', { name: 'Appearance' }),
    ).toBeInTheDocument()
    expect(
      within(settings).getByRole('link', { name: 'Appearance' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('restores archive management in Settings with all four operations', async () => {
    renderAppAt('/settings/archive')

    expect(
      await screen.findByRole('heading', { name: 'Manage Archive' }),
    ).toBeInTheDocument()
    for (const heading of ['Export', 'Verify', 'Import', 'Erase archive']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
    expect(screen.queryByText('Portable archive')).toBeNull()
    expect(screen.queryByText('Archive lifecycle')).toBeNull()
    expect(screen.queryByText('Read-only check')).toBeNull()
    expect(
      within(screen.getByRole('navigation', { name: 'Settings' })).getByRole(
        'link',
        { name: 'Manage Archive' },
      ),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('keeps unimplemented Record and Timeline controls visibly disabled', async () => {
    const record = renderAppAt('/settings/record')
    expect(
      await screen.findByRole('combobox', { name: 'Initial scale' }),
    ).toBeEnabled()
    expect(
      screen.getByRole('switch', { name: /Show scale buttons/ }),
    ).toBeDisabled()
    expect(
      screen.getByRole('combobox', { name: 'Page greeting' }),
    ).toBeDisabled()
    record.unmount()

    renderAppAt('/settings/timeline')
    await screen.findByRole('heading', { name: 'Timeline' })
    for (const control of [
      ...screen.getAllByRole('switch'),
      ...screen.getAllByRole('combobox'),
    ]) {
      expect(control).toBeDisabled()
    }
  })

  it('saves complete life details while preserving stable identity IDs', async () => {
    const client = clientWithSession(OPEN_SESSION)
    const save = vi
      .spyOn(client.client.identity, 'save')
      .mockImplementation(async (identity) =>
        ok({
          outcome: 'updated',
          identity,
          invalidation: {
            storeInstanceId: 'identity-test',
            revision: revision('2'),
          },
        }),
      )
    const user = userEvent.setup()
    renderAppAt('/settings/life-details', clientBootstrap(client))

    const archiveName = await screen.findByRole('textbox', {
      name: 'Archive name',
    })
    await user.clear(archiveName)
    expect(archiveName).toHaveAttribute(
      'placeholder',
      'Sample Subject’s Archive',
    )
    await user.type(archiveName, 'Our family archive')
    await user.clear(screen.getByRole('textbox', { name: 'Display name' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Display name' }),
      'Ada Example',
    )
    await user.click(screen.getByRole('button', { name: 'Save life details' }))

    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Our family archive',
        subject: expect.objectContaining({
          displayName: 'Ada Example',
        }),
      }),
    )
    const request = save.mock.calls[0]?.[0]
    expect(request?.id).toBeTruthy()
    expect(request?.subject.id).toBeTruthy()
    expect(await screen.findByText('Life details updated.')).toBeInTheDocument()
  })

  it('hides future Backup, Sync, and AI sections', async () => {
    renderAppAt('/settings/overview')
    await screen.findByRole('heading', { name: 'Overview' })
    const settings = screen.getByRole('navigation', { name: 'Settings' })
    expect(within(settings).queryByText(/backup/i)).toBeNull()
    expect(within(settings).queryByText(/sync/i)).toBeNull()
    expect(within(settings).queryByText(/^ai$/i)).toBeNull()
  })

  it('shares one archive overview read between the Settings rail and content', async () => {
    const client = clientWithSession(OPEN_SESSION)
    const overview = vi.spyOn(client.client.archive, 'overview')
    const identity = vi.spyOn(client.client.identity, 'load')
    const storage = vi.spyOn(client.client.runtime, 'storage')

    renderAppAt('/settings/overview', clientBootstrap(client))
    await screen.findByRole('heading', { name: 'Overview' })
    await waitFor(() => expect(overview).toHaveBeenCalledOnce())

    expect(identity).toHaveBeenCalledOnce()
    expect(storage).toHaveBeenCalledOnce()
  })

  it('applies theme changes from Appearance settings', async () => {
    globalThis.localStorage.clear()
    const user = userEvent.setup()
    renderAppAt('/settings/appearance')

    const theme = await screen.findByRole('combobox', { name: 'Theme' })
    expect(theme).toHaveValue('system')
    expect(screen.queryByRole('button', { name: /Appearance:/ })).toBeNull()

    await user.selectOptions(theme, 'dark')
    expect(document.documentElement).toHaveAttribute('data-appearance', 'dark')
    expect(theme).toHaveValue('dark')
  })

  it('closes the compact Settings drawer after selecting a destination', async () => {
    setClientMedia('(max-width: 820px)')
    const user = userEvent.setup()
    const { container } = renderAppAt('/settings/overview')

    await screen.findByRole('heading', { name: 'Overview' })
    await user.click(await screen.findByRole('button', { name: 'Navigation' }))
    const workspace = container.querySelector<HTMLElement>('.workspace')
    expect(workspace).toHaveAttribute('data-open', 'navigation')

    await user.click(
      within(screen.getByRole('navigation', { name: 'Settings' })).getByRole(
        'link',
        { name: 'General' },
      ),
    )
    expect(workspace).toHaveAttribute('data-open', 'none')
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument()
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
  it('automatically reopens the canonical archive after reload or browser restart', async () => {
    const openAfterStart = (client: TestLifeArchiveClient) =>
      vi.spyOn(client.client.archive, 'open').mockImplementation(async () => {
        client.emitSession({ state: 'opening' })
        client.emitSession(OPEN_SESSION)
        return ok(OPEN_ARCHIVE)
      })

    const firstClient = clientWithSession({ state: 'no-archive' })
    const firstOpen = openAfterStart(firstClient)
    const firstView = renderAppAt('/record', runtimeBootstrap(firstClient))
    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()
    expect(firstOpen).toHaveBeenCalledOnce()
    firstView.unmount()

    const restartedClient = clientWithSession({ state: 'no-archive' })
    const restartedOpen = openAfterStart(restartedClient)
    renderAppAt('/record', runtimeBootstrap(restartedClient))
    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()
    expect(restartedOpen).toHaveBeenCalledOnce()
  })

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

  it('keeps route-local state mounted through recoverable failure and retry', async () => {
    const client = clientWithSession(OPEN_SESSION)
    let finishOpen:
      ((result: ReturnType<typeof ok<OpenArchive>>) => void) | null = null
    vi.spyOn(client.client.archive, 'open').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishOpen = resolve
          client.emitSession({ state: 'opening' })
        }),
    )
    const user = userEvent.setup()
    renderAppAt('/record', clientBootstrap(client))
    const routeHeading = await screen.findByRole('heading', { name: 'Record' })

    act(() => client.emitSession({ state: 'needs-recovery' }))
    expect(screen.getByRole('heading', { name: 'Record' })).toBe(routeHeading)

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Recovering archive')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Record' })).toBe(routeHeading)

    act(() => {
      client.emitSession(OPEN_SESSION)
      finishOpen?.(ok(OPEN_ARCHIVE))
    })
    expect(screen.getByRole('heading', { name: 'Record' })).toBe(routeHeading)
  })

  it('resets routes only when the archive generation changes', async () => {
    const client = clientWithSession(OPEN_SESSION)
    const user = userEvent.setup()
    renderAppAt('/record', clientBootstrap(client))
    const originalHeading = await screen.findByRole('heading', {
      name: 'Record',
    })

    act(() =>
      client.emitSession({
        state: 'open',
        archive: {
          ...OPEN_ARCHIVE,
          invalidation: {
            ...OPEN_ARCHIVE.invalidation,
            revision: revision('2'),
          },
        },
      }),
    )
    expect(screen.getByRole('heading', { name: 'Record' })).toBe(
      originalHeading,
    )

    act(() =>
      client.emitSession({
        state: 'open',
        transition: 'erased',
        archive: {
          ...OPEN_ARCHIVE,
          storeId: stableId('7f1c0a10-0000-4000-8000-000000000002'),
          invalidation: {
            storeInstanceId: 'replacement',
            revision: revision('1'),
          },
        },
      }),
    )
    expect(screen.getByRole('heading', { name: 'Record' })).not.toBe(
      originalHeading,
    )
    const replacementHeading = screen.getByRole('heading', { name: 'Record' })
    const transition = screen
      .getByText(
        /prior archive was erased and a fresh empty archive was created/i,
      )
      .closest('[role="status"]')
    expect(transition).not.toBeNull()
    await user.click(
      screen.getByRole('button', { name: 'Dismiss erase result' }),
    )
    expect(
      screen.queryByText(
        /prior archive was erased and a fresh empty archive was created/i,
      ),
    ).toBeNull()
    expect(screen.getByRole('heading', { name: 'Record' })).toBe(
      replacementHeading,
    )
  })

  it('unmounts the prior route generation when recovery says it is invalid', async () => {
    const client = clientWithSession(OPEN_SESSION)
    renderAppAt('/record', clientBootstrap(client))
    const priorRouteHeading = await screen.findByRole('heading', {
      name: 'Record',
    })

    act(() =>
      client.emitSession({
        state: 'needs-recovery',
        previousArchiveInvalid: true,
      }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Archive needs attention' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Record' })).toBeNull()
    expect(priorRouteHeading).not.toBeInTheDocument()

    act(() =>
      client.emitSession({
        state: 'open',
        archive: {
          ...OPEN_ARCHIVE,
          storeId: stableId('7f1c0a10-0000-4000-8000-000000000003'),
          invalidation: {
            storeInstanceId: 'post-erase',
            revision: revision('1'),
          },
        },
      }),
    )
    expect(screen.getByRole('heading', { name: 'Record' })).not.toBe(
      priorRouteHeading,
    )
  })

  it('retries worker loss with a fresh client and ignores the superseded client', async () => {
    const lostClient = clientWithSession(OPEN_SESSION)
    const freshClient = clientWithSession(OPEN_SESSION)
    const bootstrap = vi
      .fn<AppBootstrap>()
      .mockResolvedValueOnce({
        state: 'client',
        client: lostClient.client,
        developmentMock: false,
      })
      .mockResolvedValueOnce({
        state: 'client',
        client: freshClient.client,
        developmentMock: false,
      })
    const user = userEvent.setup()
    renderAppAt('/record', bootstrap)
    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()

    act(() => {
      lostClient.emitRuntime({
        state: 'unavailable',
        reason: 'worker-lost',
      })
    })
    await user.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()
    expect(bootstrap).toHaveBeenCalledTimes(2)

    act(() => {
      lostClient.emitSession({ state: 'incompatible' })
      lostClient.emitRuntime({
        state: 'incompatible',
        reason: 'contract-mismatch',
      })
    })
    expect(screen.getByRole('heading', { name: 'Record' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'LifeArchive is incompatible' }),
    ).toBeNull()
  })

  it('replaces a definitively closed client instead of reopening its dead transport', async () => {
    const closedClient = clientWithSession(OPEN_SESSION)
    const freshClient = clientWithSession(OPEN_SESSION)
    const reopenClosed = vi.spyOn(closedClient.client.archive, 'open')
    const bootstrap = vi
      .fn<AppBootstrap>()
      .mockResolvedValueOnce({
        state: 'client',
        client: closedClient.client,
        developmentMock: false,
      })
      .mockResolvedValueOnce({
        state: 'client',
        client: freshClient.client,
        developmentMock: false,
      })
    const user = userEvent.setup()
    renderAppAt('/record', bootstrap)
    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()

    act(() => closedClient.emitSession({ state: 'closed' }))
    await user.click(
      await screen.findByRole('button', { name: 'Open archive' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()
    expect(bootstrap).toHaveBeenCalledTimes(2)
    expect(reopenClosed).not.toHaveBeenCalled()
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

  it.each([
    ['unsupportedSchema', 'Archive needs a newer LifeArchive'],
    ['corruptStore', 'Archive could not be read safely'],
    ['recoveryIncomplete', 'Archive recovery did not finish'],
    ['ioFailure', 'Storage could not open the archive'],
  ] as const)(
    'maps %s without offering a new empty archive',
    async (code, title) => {
      const client = clientWithSession({ state: 'no-archive' })
      vi.spyOn(client.client.archive, 'open').mockResolvedValue(
        failed(
          clientFailure({
            area: 'storage',
            code,
            phase: code === 'recoveryIncomplete' ? 'recovery' : 'open',
            retryable: true,
          }),
        ),
      )
      renderAppAt('/record', runtimeBootstrap(client))

      expect(
        await screen.findByRole('heading', { name: title }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { name: 'Create your local archive' }),
      ).toBeNull()
    },
  )

  it('shows unsupported browser and runtime incompatibility as distinct states', async () => {
    const unsupported = renderAppAt('/record', async () => ({
      state: 'runtime',
      runtime: { state: 'unavailable', reason: 'worker-unsupported' },
    }))
    expect(
      await screen.findByRole('heading', { name: 'Browser not supported' }),
    ).toBeInTheDocument()
    unsupported.unmount()

    const unsupportedEnvironment = renderAppAt('/record', async () => ({
      state: 'runtime',
      runtime: {
        state: 'incompatible',
        reason: 'environment-unsupported',
      },
    }))
    expect(
      await screen.findByRole('heading', { name: 'Browser not supported' }),
    ).toBeInTheDocument()
    unsupportedEnvironment.unmount()

    renderAppAt('/record', async () => ({
      state: 'runtime',
      runtime: { state: 'incompatible', reason: 'abi-mismatch' },
    }))
    expect(
      await screen.findByRole('heading', {
        name: 'LifeArchive is incompatible',
      }),
    ).toBeInTheDocument()
  })

  it.each([
    ['browser-engine-unsupported', 'app.status.browserUnsupported.engine'],
    ['browser-version-unsupported', 'app.status.browserUnsupported.version'],
    ['browser-device-unsupported', 'app.status.browserUnsupported.device'],
    ['browser-storage-unsupported', 'app.status.browserUnsupported.storage'],
  ] as const)(
    'shows a localized, data-safe diagnostic for %s',
    async (reason, detailKey) => {
      const view = renderAppAt('/record', async () => ({
        state: 'runtime',
        runtime: { state: 'incompatible', reason },
      }))

      expect(
        await screen.findByRole('heading', {
          name: enMessages['app.status.browserUnsupported.title'],
        }),
      ).toBeInTheDocument()
      expect(screen.getByText(enMessages[detailKey])).toBeInTheDocument()
      expect(document.body).not.toHaveTextContent(reason)
      view.unmount()
    },
  )

  it('shows recovery progress when retrying a recovery-required archive', async () => {
    const client = clientWithSession({ state: 'needs-recovery' })
    let finishOpen:
      ((result: ReturnType<typeof ok<OpenArchive>>) => void) | null = null
    vi.spyOn(client.client.archive, 'open').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishOpen = resolve
          client.emitSession({ state: 'opening' })
        }),
    )
    const user = userEvent.setup()
    renderAppAt('/record', clientBootstrap(client))

    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('heading', { name: 'Recovering archive' }),
    ).toBeInTheDocument()
    act(() => {
      client.emitSession(OPEN_SESSION)
      finishOpen?.(ok(OPEN_ARCHIVE))
    })
    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()
  })

  it('ignores a stale failed open after a newer open session is confirmed', async () => {
    const client = clientWithSession({ state: 'no-archive' })
    let finishOpen:
      ((result: ReturnType<typeof failed<OpenArchive>>) => void) | null = null
    vi.spyOn(client.client.archive, 'open').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishOpen = resolve
        }),
    )
    renderAppAt('/record', runtimeBootstrap(client))
    expect(
      await screen.findByRole('heading', { name: 'Opening archive' }),
    ).toBeInTheDocument()

    act(() => client.emitSession(OPEN_SESSION))
    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()
    act(() =>
      finishOpen?.(
        failed(
          clientFailure({
            area: 'storage',
            code: 'corruptStore',
            phase: 'open',
            retryable: false,
          }),
        ),
      ),
    )
    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()
  })

  it('presents clean closing and closed states without treating them as first run', async () => {
    const client = clientWithSession(OPEN_SESSION)
    renderAppAt('/record', clientBootstrap(client))
    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()

    act(() => client.emitSession({ state: 'closing' }))
    expect(
      await screen.findByRole('heading', { name: 'Closing archive' }),
    ).toBeInTheDocument()
    act(() => client.emitSession({ state: 'closed' }))
    expect(
      await screen.findByRole('heading', { name: 'Archive closed' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Create your local archive' }),
    ).toBeNull()
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
      await screen.findByRole('heading', { name: 'Overview' }),
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
