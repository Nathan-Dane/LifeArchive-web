import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  civilDate,
  revision,
  stableId,
  type Track,
  type TrackSummary,
} from '../../../core/client'
import { I18nProvider } from '../../../i18n'
import { TrackChooser } from './TrackChooser'
import type { Tracks } from './useTracks'

const ACTIVE_TRACK: Track = {
  id: stableId('9f1c0a10-0000-4000-8000-000000000001'),
  revision: revision('3'),
  name: 'Home chapters',
  iconId: 'home',
  suggestedTagId: 'home',
  isArchived: false,
  createdAtMs: 1,
  updatedAtMs: 2,
}
const ARCHIVED_TRACK: Track = {
  id: stableId('9f1c0a10-0000-4000-8000-000000000002'),
  revision: revision('4'),
  name: 'College years',
  iconId: 'education',
  suggestedTagId: 'education',
  isArchived: true,
  createdAtMs: 1,
  updatedAtMs: 2,
}
const ACTIVE_SUMMARY: TrackSummary = {
  track: ACTIVE_TRACK,
  memberCount: 2,
  ongoingMemberCount: 1,
}
const ARCHIVED_SUMMARY: TrackSummary = {
  track: ARCHIVED_TRACK,
  memberCount: 4,
  ongoingMemberCount: 0,
}
const CREATED_TRACK: Track = {
  ...ACTIVE_TRACK,
  id: stableId('9f1c0a10-0000-4000-8000-000000000003'),
  revision: revision('1'),
  name: 'Fresh chapters',
}
const CREATED_SUMMARY: TrackSummary = {
  track: CREATED_TRACK,
  memberCount: 0,
  ongoingMemberCount: 0,
}
const CREATED_INVALIDATION = {
  storeInstanceId: 'track-chooser-test',
  revision: revision('8'),
}

function makeTracks() {
  return {
    active: false,
    state: {
      status: 'ready',
      tracks: [ACTIVE_SUMMARY],
      includeArchived: false,
      selected: null,
      selectedSummary: null,
      invalidation: null,
      history: [],
      nextCursor: null,
      draft: null,
      memberDraft: null,
      creating: false,
      addingMember: false,
      failure: null,
      conflict: null,
      memberConflict: null,
    },
    setIncludeArchived: vi.fn(),
    loadManagementList: vi.fn(async () => [ACTIVE_SUMMARY, ARCHIVED_SUMMARY]),
    startCreate: vi.fn(),
    cancelCreate: vi.fn(),
    select: vi.fn(),
    clearSelection: vi.fn(),
    updateTrack: vi.fn(),
    create: vi.fn(async () => ({
      summary: CREATED_SUMMARY,
      invalidation: CREATED_INVALIDATION,
    })),
    save: vi.fn(async () => true),
    deleteTrack: vi.fn(async () => true),
  } as unknown as Tracks
}

function renderChooser(tracks: Tracks, onChange = vi.fn()) {
  const chooser = (nextTracks: Tracks) => (
    <I18nProvider locale="en">
      <TrackChooser
        tracks={nextTracks}
        value={ACTIVE_TRACK.id}
        date={civilDate('2025-06-14')}
        onChange={onChange}
      />
    </I18nProvider>
  )
  const rendered = render(chooser(tracks))
  return {
    onChange,
    rerender: (nextTracks: Tracks) => rendered.rerender(chooser(nextTracks)),
  }
}

describe('TrackChooser', () => {
  it('uses one anchored chooser menu and a modal Track task', async () => {
    const user = userEvent.setup()
    const tracks = makeTracks()
    const { onChange } = renderChooser(tracks)
    const trigger = screen.getByRole('button', {
      name: 'Track: Home chapters. Choose Track',
    })

    trigger.focus()
    await user.keyboard('{ArrowDown}')
    let menu = screen.getByRole('menu')
    expect(menu).not.toHaveAttribute('aria-modal')
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Home chapters' }),
    ).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    menu = screen.getByRole('menu')
    const noTrack = within(menu).getByRole('menuitemradio', {
      name: 'No Track',
    })
    expect(noTrack.nextElementSibling).toHaveAttribute('role', 'separator')
    await user.click(noTrack)
    expect(onChange).toHaveBeenCalledWith(null)
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(trigger)
    menu = screen.getByRole('menu')
    await user.click(within(menu).getByRole('menuitem', { name: 'New Track' }))
    expect(tracks.startCreate).toHaveBeenCalledWith(civilDate('2025-06-14'))
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(trigger)
    menu = screen.getByRole('menu')
    await user.click(
      within(menu).getByRole('menuitem', { name: 'Manage Tracks' }),
    )

    expect(tracks.setIncludeArchived).not.toHaveBeenCalled()
    expect(tracks.loadManagementList).toHaveBeenCalledOnce()
    const manager = screen.getByRole('dialog', { name: 'Manage Tracks' })
    expect(await within(manager).findByText('College years')).toBeVisible()
    await user.click(
      within(manager).getByRole('button', { name: 'Close Track management' }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Manage Tracks' }),
      ).toBeNull(),
    )
    expect(trigger).toHaveFocus()
  })

  it('edits within the Manage Tracks modal and returns with Back', async () => {
    const user = userEvent.setup()
    const tracks = makeTracks()
    const { rerender } = renderChooser(tracks)
    const trigger = screen.getByRole('button', {
      name: 'Track: Home chapters. Choose Track',
    })

    await user.click(trigger)
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitem', {
        name: 'Manage Tracks',
      }),
    )
    const manager = screen.getByRole('dialog', { name: 'Manage Tracks' })
    await user.click(
      within(manager).getByRole('button', { name: /Home chapters/ }),
    )
    expect(tracks.select).toHaveBeenCalledWith(ACTIVE_SUMMARY)

    rerender({
      ...tracks,
      active: true,
      state: {
        ...tracks.state,
        selected: ACTIVE_TRACK,
        selectedSummary: ACTIVE_SUMMARY,
        draft: {
          name: ACTIVE_TRACK.name,
          iconId: ACTIVE_TRACK.iconId,
          suggestedTagId: ACTIVE_TRACK.suggestedTagId ?? '',
          isArchived: ACTIVE_TRACK.isArchived,
        },
      },
    })

    const editor = screen.getByRole('dialog', { name: 'Edit Track' })
    expect(
      within(editor).getByRole('button', { name: 'Back to Manage Tracks' }),
    ).toBeVisible()
    expect(
      within(editor).getByRole('button', { name: 'See Track History' }),
    ).toBeDisabled()
    expect(within(editor).getByRole('button', { name: 'Save' })).toBeVisible()
    expect(
      within(editor).getByRole('button', {
        name: /Contained Events and Spans/,
      }),
    ).toHaveAttribute('aria-expanded', 'false')

    await user.click(
      within(editor).getByRole('button', { name: 'Back to Manage Tracks' }),
    )
    expect(tracks.clearSelection).toHaveBeenCalledOnce()
    rerender(tracks)
    expect(screen.getByRole('dialog', { name: 'Manage Tracks' })).toBeVisible()
  })

  it('shows Track creation as a modal and cancels it from Close', async () => {
    const user = userEvent.setup()
    const tracks = makeTracks()
    const { rerender } = renderChooser(tracks)
    const trigger = screen.getByRole('button', {
      name: 'Track: Home chapters. Choose Track',
    })

    await user.click(trigger)
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitem', {
        name: 'New Track',
      }),
    )
    rerender({
      ...tracks,
      active: true,
      state: {
        ...tracks.state,
        status: 'creating',
        selected: null,
        selectedSummary: null,
        draft: {
          name: '',
          iconId: 'event',
          suggestedTagId: '',
          isArchived: false,
        },
        creating: true,
      },
    })

    const editor = screen.getByRole('dialog', { name: 'New Track' })
    expect(within(editor).getByText('Default tag')).toBeVisible()
    expect(
      within(editor).queryByRole('button', { name: 'Archive Track' }),
    ).toBeNull()
    await user.click(
      within(editor).getByRole('button', { name: 'Close Track editor' }),
    )
    expect(tracks.cancelCreate).toHaveBeenCalledOnce()
  })

  it('assigns a Track created from the chooser and closes the task', async () => {
    const user = userEvent.setup()
    const tracks = makeTracks()
    const { onChange, rerender } = renderChooser(tracks)
    const trigger = screen.getByRole('button', {
      name: 'Track: Home chapters. Choose Track',
    })

    await user.click(trigger)
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitem', {
        name: 'New Track',
      }),
    )
    rerender({
      ...tracks,
      active: true,
      state: {
        ...tracks.state,
        status: 'creating',
        draft: {
          name: CREATED_TRACK.name,
          iconId: CREATED_TRACK.iconId,
          suggestedTagId: '',
          isArchived: false,
        },
        creating: true,
      },
    })

    await user.click(
      within(screen.getByRole('dialog', { name: 'New Track' })).getByRole(
        'button',
        { name: 'Save' },
      ),
    )

    expect(tracks.create).toHaveBeenCalledOnce()
    expect(tracks.clearSelection).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith(
      CREATED_TRACK.id,
      CREATED_INVALIDATION,
    )
  })

  it('uses the persistent Track-list token after the chooser remounts', async () => {
    const user = userEvent.setup()
    const tracks = makeTracks()
    const reopenedTracks = {
      ...tracks,
      state: {
        ...tracks.state,
        tracks: [ACTIVE_SUMMARY, CREATED_SUMMARY],
        invalidation: CREATED_INVALIDATION,
      },
    }
    const { onChange } = renderChooser(reopenedTracks)

    await user.click(
      screen.getByRole('button', {
        name: 'Track: Home chapters. Choose Track',
      }),
    )
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitemradio', {
        name: 'Fresh chapters',
      }),
    )

    expect(onChange).toHaveBeenCalledWith(
      CREATED_TRACK.id,
      CREATED_INVALIDATION,
    )
  })

  it('creates from the bottom of management and returns with the Track visible', async () => {
    const user = userEvent.setup()
    const tracks = makeTracks()
    const { onChange, rerender } = renderChooser(tracks)
    const trigger = screen.getByRole('button', {
      name: 'Track: Home chapters. Choose Track',
    })

    await user.click(trigger)
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitem', {
        name: 'Manage Tracks',
      }),
    )
    const manager = screen.getByRole('dialog', { name: 'Manage Tracks' })
    expect(within(manager).getByText('Home chapters')).toBeVisible()
    await user.click(within(manager).getByRole('button', { name: 'New Track' }))
    expect(tracks.startCreate).toHaveBeenCalledWith(civilDate('2025-06-14'))

    rerender({
      ...tracks,
      active: true,
      state: {
        ...tracks.state,
        status: 'creating',
        draft: {
          name: CREATED_TRACK.name,
          iconId: CREATED_TRACK.iconId,
          suggestedTagId: '',
          isArchived: false,
        },
        creating: true,
      },
    })
    vi.mocked(tracks.loadManagementList).mockResolvedValue([
      ACTIVE_SUMMARY,
      ARCHIVED_SUMMARY,
      CREATED_SUMMARY,
    ])
    await user.click(
      within(screen.getByRole('dialog', { name: 'New Track' })).getByRole(
        'button',
        { name: 'Save' },
      ),
    )
    expect(onChange).not.toHaveBeenCalled()

    rerender({
      ...tracks,
      active: false,
      state: {
        ...tracks.state,
        tracks: [ACTIVE_SUMMARY, CREATED_SUMMARY],
        invalidation: CREATED_INVALIDATION,
      },
    })
    const returnedManager = screen.getByRole('dialog', {
      name: 'Manage Tracks',
    })
    expect(
      await within(returnedManager).findByText('Fresh chapters'),
    ).toBeVisible()
    await user.click(
      within(returnedManager).getByRole('button', {
        name: 'Close Track management',
      }),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Manage Tracks' }),
      ).toBeNull(),
    )
    await user.click(trigger)
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitemradio', {
        name: 'Fresh chapters',
      }),
    )
    expect(onChange).toHaveBeenCalledWith(
      CREATED_TRACK.id,
      CREATED_INVALIDATION,
    )
  })

  it('deletes directly from the lower-left footer and returns to management', async () => {
    const user = userEvent.setup()
    const tracks = makeTracks()
    const { rerender } = renderChooser(tracks)
    const trigger = screen.getByRole('button', {
      name: 'Track: Home chapters. Choose Track',
    })

    await user.click(trigger)
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitem', {
        name: 'Manage Tracks',
      }),
    )
    await user.click(
      within(screen.getByRole('dialog', { name: 'Manage Tracks' })).getByRole(
        'button',
        { name: /Home chapters/ },
      ),
    )
    rerender({
      ...tracks,
      active: true,
      state: {
        ...tracks.state,
        selected: ACTIVE_TRACK,
        selectedSummary: ACTIVE_SUMMARY,
        draft: {
          name: ACTIVE_TRACK.name,
          iconId: ACTIVE_TRACK.iconId,
          suggestedTagId: ACTIVE_TRACK.suggestedTagId ?? '',
          isArchived: ACTIVE_TRACK.isArchived,
        },
      },
    })

    const editor = screen.getByRole('dialog', { name: 'Edit Track' })
    const deleteButton = within(editor).getByRole('button', {
      name: 'Delete Track',
    })
    expect(deleteButton.closest('footer')).toHaveClass(
      'record-track-editor__footer',
    )
    await user.click(deleteButton)
    expect(
      within(editor).getByRole('button', { name: 'Confirm Delete' }),
    ).toBeDisabled()
    await user.click(
      within(editor).getByRole('checkbox', {
        name: 'Detach every member without deleting any Event or Span',
      }),
    )
    vi.mocked(tracks.loadManagementList).mockResolvedValue([ARCHIVED_SUMMARY])
    await user.click(
      within(editor).getByRole('button', { name: 'Confirm Delete' }),
    )
    expect(tracks.deleteTrack).toHaveBeenCalledWith(true)
    expect(tracks.save).not.toHaveBeenCalled()

    rerender(tracks)
    const returnedManager = screen.getByRole('dialog', {
      name: 'Manage Tracks',
    })
    expect(returnedManager).toBeVisible()
    await waitFor(() =>
      expect(within(returnedManager).queryByText('Home chapters')).toBeNull(),
    )
  })

  it('closes after deleting a Track opened directly', async () => {
    const user = userEvent.setup()
    const tracks = makeTracks()
    const directlyOpened = {
      ...tracks,
      active: true,
      state: {
        ...tracks.state,
        selected: ACTIVE_TRACK,
        selectedSummary: {
          ...ACTIVE_SUMMARY,
          memberCount: 0,
          ongoingMemberCount: 0,
        },
        draft: {
          name: ACTIVE_TRACK.name,
          iconId: ACTIVE_TRACK.iconId,
          suggestedTagId: ACTIVE_TRACK.suggestedTagId ?? '',
          isArchived: ACTIVE_TRACK.isArchived,
        },
      },
    }
    const { rerender } = renderChooser(directlyOpened)
    const editor = screen.getByRole('dialog', { name: 'Edit Track' })

    await user.click(
      within(editor).getByRole('button', { name: 'Delete Track' }),
    )
    await user.click(
      within(editor).getByRole('button', { name: 'Confirm Delete' }),
    )
    expect(tracks.deleteTrack).toHaveBeenCalledWith(false)
    expect(tracks.save).not.toHaveBeenCalled()

    rerender(tracks)
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Manage Tracks' }),
      ).toBeNull(),
    )
  })
})
