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

function makeTracks() {
  return {
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
    select: vi.fn(),
  } as unknown as Tracks
}

function renderChooser(tracks: Tracks, onChange = vi.fn()) {
  render(
    <I18nProvider locale="en">
      <TrackChooser
        tracks={tracks}
        value={ACTIVE_TRACK.id}
        date={civilDate('2025-06-14')}
        onChange={onChange}
      />
    </I18nProvider>,
  )
  return onChange
}

describe('TrackChooser', () => {
  it('uses one anchored menu and only opens a modal for Manage Tracks', async () => {
    const user = userEvent.setup()
    const tracks = makeTracks()
    const onChange = renderChooser(tracks)
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
    await user.click(within(menu).getByRole('menuitem', { name: 'New track' }))
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

    await user.click(trigger)
    menu = screen.getByRole('menu')
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Home chapters' }),
    ).toBeVisible()
    await user.click(
      within(menu).getByRole('menuitem', { name: 'Manage Tracks' }),
    )
    const reopenedManager = screen.getByRole('dialog', {
      name: 'Manage Tracks',
    })
    await user.click(
      within(reopenedManager).getByRole('button', { name: /Home chapters/ }),
    )
    expect(tracks.select).toHaveBeenCalledWith(ACTIVE_SUMMARY)
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Manage Tracks' }),
      ).toBeNull(),
    )
    expect(trigger).toHaveFocus()
  })
})
