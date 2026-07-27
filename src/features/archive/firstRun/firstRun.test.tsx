/**
 * First run, from the reader's side.
 *
 * The properties these tests hold are safety properties rather than layout
 * ones: a refused browser permission is stated instead of glossed over, a
 * failed create leaves the screen saying nothing was created, and Record is
 * never reached before the runtime has confirmed an archive.
 */

import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import {
  clientFailure,
  failed,
  ok,
  revision,
  stableId,
  type ArchiveSession,
  type ClientResult,
  type LifeArchiveClient,
  type OpenArchive,
  type RuntimeStatus,
  type StorageDurability,
} from '../../../core/client'
import type { AppBootstrap } from '../../../core/bootstrap'
import { I18nProvider } from '../../../i18n'
import type { StoragePersistence } from '../../../platform/storage'
import {
  FORBIDDEN_AVAILABILITY_CLAIMS,
  FORBIDDEN_PERSISTENCE_CLAIMS,
} from '../../../test/claims'
import { TestLifeArchiveClient } from '../../../test/TestLifeArchiveClient'
import { renderAppAt } from '../../../test/render'
import { FirstRunPage } from './FirstRunPage'

const OPEN_ARCHIVE: OpenArchive = {
  storeId: stableId('7f1c0a10-0000-4000-8000-000000000001'),
  productContract: 'test',
  storeSchemaVersion: 'test',
  rootLayoutVersion: 'test',
  invalidation: { storeInstanceId: 'test', revision: revision('1') },
}

function runtimeStatus(durability: StorageDurability): RuntimeStatus {
  return {
    state: 'available',
    runtime: {
      mode: 'runtime',
      runtimeVersion: 'test',
      buildId: 'test',
      productContract: 'test',
      browserAbi: 'test',
      backend: 'test',
      durability,
    },
  }
}

interface StubOptions {
  readonly create?: () => Promise<ClientResult<OpenArchive>>
  readonly session?: ArchiveSession
  readonly durability?: StorageDurability
}

function stubClient({
  create = () => Promise.resolve(ok(OPEN_ARCHIVE)),
  session = { state: 'no-archive' },
  durability = 'durable',
}: StubOptions = {}) {
  const createSpy = vi.fn(create)
  const client = {
    runtime: {
      status: () => runtimeStatus(durability),
      observeStatus: () => () => undefined,
    },
    archive: {
      session: () => session,
      observeSession: () => () => undefined,
      create: createSpy,
    },
  } as unknown as LifeArchiveClient
  return { client, createSpy }
}

function stubPersistence(
  parts: Partial<StoragePersistence> = {},
): StoragePersistence {
  return {
    current: () => Promise.resolve('unknown'),
    request: () => Promise.resolve('granted'),
    estimate: () => Promise.resolve(null),
    ...parts,
  }
}

function renderFirstRun(
  client: LifeArchiveClient,
  persistence: StoragePersistence = stubPersistence(),
) {
  return render(
    <I18nProvider locale="en-GB">
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={<FirstRunPage client={client} persistence={persistence} />}
          />
          <Route path="/record" element={<h1>Record</h1>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}

function appBootstrap(session: ArchiveSession): AppBootstrap {
  return async () => ({
    state: 'client',
    client: new TestLifeArchiveClient(session).client,
    developmentMock: true,
  })
}

const CREATE = 'Create archive'

describe('creating the first archive', () => {
  it('explains local-only storage before offering to create anything', async () => {
    const { client, createSpy } = stubClient()
    renderFirstRun(client)

    expect(
      screen.getByRole('heading', { name: 'Create your local archive' }),
    ).toBeInTheDocument()
    expect(document.body).toHaveTextContent(/no account, no server/i)
    expect(document.body).toHaveTextContent(/only copy that survives/i)
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('asks the browser to keep the data, creates, and reaches Record', async () => {
    const user = userEvent.setup()
    const request = vi.fn(() => Promise.resolve('granted' as const))
    const { client, createSpy } = stubClient()
    renderFirstRun(client, stubPersistence({ request }))

    await user.click(screen.getByRole('button', { name: CREATE }))

    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()
    expect(request).toHaveBeenCalledTimes(1)
    expect(createSpy).toHaveBeenCalledTimes(1)
  })

  it('reaches Record only after the runtime confirms the archive', async () => {
    const user = userEvent.setup()
    let confirm: ((result: ClientResult<OpenArchive>) => void) | undefined
    const { client } = stubClient({
      create: () =>
        new Promise((resolve) => {
          confirm = resolve
        }),
    })
    renderFirstRun(client)

    await user.click(screen.getByRole('button', { name: CREATE }))
    expect(
      await screen.findByRole('heading', { name: 'Creating the archive' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Record' })).toBeNull()

    confirm?.(ok(OPEN_ARCHIVE))
    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()
  })

  it('creates one archive however often the control is pressed', async () => {
    const user = userEvent.setup()
    const { client, createSpy } = stubClient({
      create: () => new Promise(() => undefined),
    })
    renderFirstRun(client)

    const create = screen.getByRole('button', { name: CREATE })
    await user.click(create)
    await user.click(create)

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1))
  })

  it('states the durability the runtime reports, and nothing more', () => {
    const { client } = stubClient({ durability: 'best-effort' })
    renderFirstRun(client)

    expect(document.body).toHaveTextContent(/best-effort local storage/i)
    expect(document.body).not.toHaveTextContent(/durable local storage for/i)
  })

  it('makes no forbidden durability or availability claim', () => {
    const { client } = stubClient({ durability: 'unproven' })
    const { container } = renderFirstRun(client)
    const text = container.textContent ?? ''

    for (const claim of [
      ...FORBIDDEN_PERSISTENCE_CLAIMS,
      ...FORBIDDEN_AVAILABILITY_CLAIMS,
    ]) {
      expect(text).not.toMatch(claim)
    }
  })
})

describe('what the browser says about keeping the data', () => {
  it('shows the browser s space estimate when it gives one', async () => {
    const { client } = stubClient()
    renderFirstRun(
      client,
      stubPersistence({
        estimate: () =>
          Promise.resolve({
            usedBytes: 1500,
            quotaBytes: 5_000_000_000,
            approximate: true,
          }),
      }),
    )

    expect(await screen.findByText(/5 GB/)).toBeInTheDocument()
    expect(document.body).toHaveTextContent(/1\.5 kB/)
    expect(document.body).toHaveTextContent(/estimates are approximate/i)
  })

  it('claims nothing about space when the browser gives no estimate', async () => {
    const { client } = stubClient()
    renderFirstRun(
      client,
      stubPersistence({ estimate: () => Promise.resolve(null) }),
    )

    await screen.findByRole('button', { name: CREATE })
    expect(document.body).not.toHaveTextContent(/estimates/i)
    expect(document.body).not.toHaveTextContent(/\bGB\b|\bkB\b/)
  })

  it.each([
    ['denied', /refused the request/i],
    ['unknown', /would not say/i],
    ['unsupported', /cannot be asked/i],
  ] as const)(
    'states a %s permission and still lets the reader decide',
    async (grant, sentence) => {
      const user = userEvent.setup()
      const { client, createSpy } = stubClient()
      renderFirstRun(
        client,
        stubPersistence({ request: () => Promise.resolve(grant) }),
      )

      await user.click(screen.getByRole('button', { name: CREATE }))
      expect(
        await screen.findByRole('heading', {
          name: 'The browser will not promise to keep this data',
        }),
      ).toBeInTheDocument()
      expect(document.body).toHaveTextContent(sentence)
      expect(document.body).toHaveTextContent(/may clear the archive/i)
      /* A refusal is not a runtime failure: nothing was attempted. */
      expect(createSpy).not.toHaveBeenCalled()

      await user.click(
        screen.getByRole('button', { name: 'Create archive anyway' }),
      )
      expect(
        await screen.findByRole('heading', { name: 'Record' }),
      ).toBeInTheDocument()
      expect(createSpy).toHaveBeenCalledTimes(1)
    },
  )

  it('can ask the browser again after a refusal', async () => {
    const user = userEvent.setup()
    const request = vi
      .fn<StoragePersistence['request']>()
      .mockResolvedValueOnce('denied')
      .mockResolvedValueOnce('granted')
    const { client, createSpy } = stubClient()
    renderFirstRun(client, stubPersistence({ request }))

    await user.click(screen.getByRole('button', { name: CREATE }))
    await user.click(
      await screen.findByRole('button', { name: 'Ask the browser again' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()
    expect(request).toHaveBeenCalledTimes(2)
    expect(createSpy).toHaveBeenCalledTimes(1)
  })
})

describe('when the archive cannot be created', () => {
  it('reports another tab s ownership without replacing anything', async () => {
    const user = userEvent.setup()
    const { client } = stubClient({
      create: () =>
        Promise.resolve(
          failed(
            clientFailure({
              area: 'concurrency',
              code: 'storeAlreadyOpen',
              phase: 'lock',
              retryable: true,
            }),
          ),
        ),
    })
    renderFirstRun(client)

    await user.click(screen.getByRole('button', { name: CREATE }))
    expect(
      await screen.findByRole('heading', {
        name: 'Another tab owns the local archive',
      }),
    ).toBeInTheDocument()
    expect(document.body).toHaveTextContent(
      /nothing was created and nothing was replaced/i,
    )
    expect(screen.queryByRole('heading', { name: 'Record' })).toBeNull()
  })

  it('treats a session already owned elsewhere as ownership, not damage', async () => {
    const user = userEvent.setup()
    const { client } = stubClient({
      session: { state: 'open-in-another-tab' },
      create: () =>
        Promise.resolve(
          failed(
            clientFailure({
              area: 'lifecycle',
              code: 'ioFailure',
              phase: 'open',
              retryable: true,
            }),
          ),
        ),
    })
    renderFirstRun(client)

    await user.click(screen.getByRole('button', { name: CREATE }))
    expect(
      await screen.findByRole('heading', {
        name: 'Another tab owns the local archive',
      }),
    ).toBeInTheDocument()
  })

  it('states a failed create, says nothing was created, and retries', async () => {
    const user = userEvent.setup()
    const create = vi
      .fn<LifeArchiveClient['archive']['create']>()
      .mockResolvedValueOnce(
        failed(
          clientFailure({
            area: 'storage',
            code: 'ioFailure',
            phase: 'open',
            retryable: true,
          }),
        ),
      )
      .mockResolvedValueOnce(ok(OPEN_ARCHIVE))
    const request = vi.fn(() => Promise.resolve('granted' as const))
    const { client } = stubClient({ create })
    renderFirstRun(client, stubPersistence({ request }))

    await user.click(screen.getByRole('button', { name: CREATE }))
    expect(
      await screen.findByRole('heading', {
        name: 'The archive was not created',
      }),
    ).toBeInTheDocument()
    expect(document.body).toHaveTextContent(
      /nothing was created and nothing was replaced/i,
    )
    expect(screen.queryByRole('heading', { name: 'Record' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()
    /* The reader answered the permission question once. */
    expect(request).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(2)
  })
})

describe('first run inside the application', () => {
  it('offers creation instead of a dead end, with no route into an editor', async () => {
    renderAppAt('/record', appBootstrap({ state: 'no-archive' }))

    expect(
      await screen.findByRole('heading', { name: 'Create your local archive' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: CREATE })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Record' })).toBeNull()
  })

  it('leaves the first run behind once the runtime reports the archive', async () => {
    const fake = new TestLifeArchiveClient({ state: 'no-archive' })
    renderAppAt('/record', async () => ({
      state: 'client',
      client: fake.client,
      developmentMock: true,
    }))
    await screen.findByRole('heading', { name: 'Create your local archive' })

    act(() => fake.emitSession({ state: 'open', archive: OPEN_ARCHIVE }))

    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Create your local archive' }),
    ).toBeNull()
  })

  it('preserves create intent and its recovery surface across real-client session transitions', async () => {
    const fake = new TestLifeArchiveClient({ state: 'no-archive' })
    const open = vi
      .spyOn(fake.client.archive, 'open')
      .mockImplementation(async () => {
        fake.emitSession({ state: 'opening' })
        await Promise.resolve()
        fake.emitSession({ state: 'no-archive' })
        return failed(
          clientFailure({
            area: 'storage',
            code: 'archiveNotFound',
            phase: 'open',
            retryable: false,
          }),
        )
      })
    let createAttempt = 0
    let finishCreateRetry: (() => void) | null = null
    const create = vi
      .spyOn(fake.client.archive, 'create')
      .mockImplementation(async () => {
        createAttempt += 1
        fake.emitSession({ state: 'opening' })
        await Promise.resolve()
        if (createAttempt === 1) {
          fake.emitSession({ state: 'closed' })
          return failed(
            clientFailure({
              area: 'storage',
              code: 'ioFailure',
              phase: 'open',
              retryable: true,
            }),
          )
        }
        await new Promise<void>((resolve) => {
          finishCreateRetry = resolve
        })
        fake.emitSession({ state: 'open', archive: OPEN_ARCHIVE })
        return ok(OPEN_ARCHIVE)
      })
    const user = userEvent.setup()
    renderAppAt('/record', async () => ({
      state: 'client',
      client: fake.client,
      developmentMock: false,
    }))

    await screen.findByRole('heading', { name: 'Create your local archive' })
    await user.click(screen.getByRole('button', { name: CREATE }))
    await user.click(
      await screen.findByRole('button', { name: 'Create archive anyway' }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'The archive was not created',
      }),
    ).toBeInTheDocument()
    const firstRunSurface = screen
      .getByRole('heading', { name: 'The archive was not created' })
      .closest('section')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
    expect(open).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('heading', { name: 'Creating the archive' }),
    ).toBeInTheDocument()
    expect(
      screen
        .getByRole('heading', { name: 'Creating the archive' })
        .closest('section'),
    ).toBe(firstRunSurface)
    act(() => finishCreateRetry?.())
    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()
    expect(open).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('does not offer to create again on a later start with an archive', async () => {
    renderAppAt(
      '/record',
      appBootstrap({ state: 'open', archive: OPEN_ARCHIVE }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Record' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: CREATE })).toBeNull()
  })
})
