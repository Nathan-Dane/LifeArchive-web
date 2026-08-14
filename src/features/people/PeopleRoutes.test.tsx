import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppBootstrap } from '../../core/bootstrap'
import { revision, stableId, type ArchiveSession } from '../../core/client'
import { renderAppAt } from '../../test/render'
import { TestLifeArchiveClient } from '../../test/TestLifeArchiveClient'

const PERSON_ID = stableId('7f1c0a10-0000-4000-8000-000000000050')
const OPEN_SESSION: ArchiveSession = {
  state: 'open',
  archive: {
    storeId: stableId('b5000000-0000-4000-8000-000000000001'),
    productContract: '11',
    storeSchemaVersion: '12',
    rootLayoutVersion: '1',
    invalidation: {
      storeInstanceId: 'people-routes-test',
      revision: revision('1'),
    },
  },
}

const originalInnerWidth = globalThis.innerWidth

function bootstrap(client: TestLifeArchiveClient): AppBootstrap {
  return async () => ({
    state: 'client',
    client: client.client,
    developmentMock: true,
  })
}

function PersonRouteControl() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(`/index/people/${PERSON_ID}`)}
    >
      Open test Person route
    </button>
  )
}

beforeEach(() => {
  globalThis.localStorage.clear()
})

afterEach(() => {
  Object.defineProperty(globalThis, 'innerWidth', {
    configurable: true,
    value: originalInnerWidth,
  })
})

describe('People route lifecycle', () => {
  it('publishes the first directory result without a search or manage nudge', async () => {
    const client = new TestLifeArchiveClient(OPEN_SESSION)
    const list = vi.spyOn(client.client.people, 'list')

    renderAppAt('/index/people', bootstrap(client))

    expect(await screen.findByText('Maya Chen')).toBeVisible()
    expect(list).toHaveBeenCalledOnce()
    expect(list).toHaveBeenCalledWith({
      query: null,
      includeArchived: true,
      limit: 25,
      after: null,
    })
  })

  it('preserves directory query, manage mode, and scroll across a profile route', async () => {
    const client = new TestLifeArchiveClient(OPEN_SESSION)
    const user = userEvent.setup()
    renderAppAt('/index/people', bootstrap(client), {
      within: <PersonRouteControl />,
    })

    await screen.findByText('Maya Chen')
    const manage = screen.getAllByRole('button', { name: 'Manage' })[0]!
    await user.click(manage)
    expect(manage).toHaveAttribute('aria-pressed', 'true')

    const search = screen.getByRole('searchbox', { name: 'Search People' })
    await user.type(search, 'Maya')
    const directoryBody = search.closest<HTMLElement>('.people-manager__body')
    expect(directoryBody).not.toBeNull()
    directoryBody!.scrollTop = 144
    fireEvent.scroll(directoryBody!)

    await user.click(
      screen.getByRole('button', { name: 'Open test Person route' }),
    )
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Maya Chen' }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Back to People' }))

    const restoredSearch = await screen.findByRole('searchbox', {
      name: 'Search People',
    })
    expect(restoredSearch).toHaveValue('Maya')
    expect(screen.getAllByRole('button', { name: 'Done' })[0]).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      restoredSearch.closest<HTMLElement>('.people-manager__body')?.scrollTop,
    ).toBe(144)
  })

  it('keeps the quick-create task centred, modal, trapped, and focus-restoring at compact width', async () => {
    Object.defineProperty(globalThis, 'innerWidth', {
      configurable: true,
      value: 390,
    })
    fireEvent.resize(globalThis.window)
    const client = new TestLifeArchiveClient(OPEN_SESSION)
    const user = userEvent.setup()
    renderAppAt('/index/people', bootstrap(client))

    await screen.findByText('Maya Chen')
    const opener = screen.getByRole('button', { name: 'New Person' })
    await user.click(opener)

    const dialog = await screen.findByRole('dialog', { name: 'New Person' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog.parentElement).toHaveAttribute('data-placement', 'center')
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus()

    await user.tab({ shift: true })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    await user.keyboard('{Escape}')

    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('renders an invalid canonical Person deep link as a recoverable route state', async () => {
    const client = new TestLifeArchiveClient(OPEN_SESSION)
    const load = vi.spyOn(client.client.people, 'load')

    renderAppAt('/index/people/not-a-stable-id', bootstrap(client))

    expect(
      await screen.findByRole('heading', { name: 'Person not available' }),
    ).toBeVisible()
    expect(
      screen.getByText(
        'This Person could not be found in the current archive.',
      ),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Back to People' })).toBeEnabled()
    expect(load).not.toHaveBeenCalled()
  })
})
