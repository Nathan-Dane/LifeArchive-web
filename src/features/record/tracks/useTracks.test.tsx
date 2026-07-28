import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  civilDate,
  clientFailure,
  failed,
  ok,
  revision,
  stableId,
  type ClientResult,
  type LifeArchiveClient,
  type Track,
  type TrackHistoryPage,
  type TrackHistoryCursor,
  type TrackMutationResult,
  type TrackState,
  type TrackWithFirstMember,
} from '../../../core/client'
import { TestLifeArchiveClient } from '../../../test/TestLifeArchiveClient'
import { useTracks } from './useTracks'

const ARCHIVE_ID = stableId('8f1c0a10-0000-4000-8000-000000000801')
const TRACK_ID = stableId('8f1c0a10-0000-4000-8000-000000000802')
const MEMBER_ID = stableId('8f1c0a10-0000-4000-8000-000000000803')
const EVENT_ID = stableId('8f1c0a10-0000-4000-8000-000000000804')
const INVALIDATION = {
  storeInstanceId: 'tracks-test',
  revision: revision('20'),
}
const TRACK: Track = {
  id: TRACK_ID,
  revision: revision('5'),
  name: 'Home chapters',
  iconId: 'icon.home',
  suggestedTagId: 'tag.home',
  isArchived: false,
  createdAtMs: 1,
  updatedAtMs: 2,
}
const SUMMARY = {
  track: TRACK,
  memberCount: 2,
  ongoingMemberCount: 1,
}
function client(
  overrides: Partial<LifeArchiveClient['tracks']> = {},
  ids = [TRACK_ID, MEMBER_ID],
): LifeArchiveClient {
  const base = new TestLifeArchiveClient({
    state: 'open',
    archive: {
      storeId: ARCHIVE_ID,
      productContract: 'test',
      storeSchemaVersion: 'test',
      rootLayoutVersion: 'test',
      invalidation: INVALIDATION,
    },
  }).client
  const minted = [...ids]
  return {
    ...base,
    tracks: {
      ...base.tracks,
      list: async () => ok({ tracks: [SUMMARY], invalidation: INVALIDATION }),
      load: async () =>
        ok<TrackState>({
          presence: 'present',
          track: TRACK,
          invalidation: INVALIDATION,
        }),
      history: async () =>
        ok<TrackHistoryPage>({
          track: TRACK,
          members: [],
          nextCursor: null,
          invalidation: INVALIDATION,
        }),
      ...overrides,
    },
    operations: {
      ...base.operations,
      newStableId: () => minted.shift() ?? MEMBER_ID,
    },
  }
}

function tracks(testClient: LifeArchiveClient) {
  const callbacks = {
    onMemberCreated: vi.fn(),
    refreshObjects: vi.fn(),
  }
  return {
    callbacks,
    rendered: renderHook(() =>
      useTracks(testClient, {
        developmentMock: false,
        ...callbacks,
      }),
    ),
  }
}

describe('Track management and capture', () => {
  it('cancels a complete Track draft without making a mutation', async () => {
    const create = vi.fn()
    const { rendered } = tracks(client({ create }))
    await waitFor(() =>
      expect(rendered.result.current.state.tracks).toHaveLength(1),
    )

    act(() => rendered.result.current.startCreate(civilDate('2025-06-14')))
    act(() =>
      rendered.result.current.updateTrack({
        name: 'Unsubmitted Track',
        suggestedTagId: 'tag.personal',
      }),
    )
    act(() => rendered.result.current.cancelCreate())

    expect(create).not.toHaveBeenCalled()
    expect(rendered.result.current.state.creating).toBe(false)
    expect(rendered.result.current.state.draft).toBeNull()
  })

  it('keeps the full Track and first-member draft after atomic failure', async () => {
    const createWithFirstMember = vi.fn(
      async (): Promise<ClientResult<TrackWithFirstMember>> =>
        failed(
          clientFailure({
            area: 'record',
            code: 'atomicCaptureFailed',
            phase: 'mutation',
            retryable: true,
          }),
        ),
    )
    const { rendered } = tracks(client({ createWithFirstMember }))
    await waitFor(() =>
      expect(rendered.result.current.state.tracks).toHaveLength(1),
    )
    act(() => rendered.result.current.startCreate(civilDate('2025-06-14')))
    act(() =>
      rendered.result.current.updateTrack({
        name: 'My exact Track',
        iconId: 'icon.journey',
        suggestedTagId: 'tag.travel',
      }),
    )
    act(() =>
      rendered.result.current.includeFirstMember(true, civilDate('2025-06-14')),
    )
    act(() =>
      rendered.result.current.updateMember({
        kind: 'span',
        title: 'Long journey',
        markdown: 'Café  日本語\tkept',
        endDate: '2025-06-20',
        ongoing: false,
        tagIds: ['tag.travel', 'tag.personal'],
        displayTagId: 'tag.travel',
        tagStateOmitted: false,
        beginMarkerEnabled: true,
        beginMarkerTitle: 'Departed',
        endMarkerEnabled: true,
        endMarkerTitle: 'Arrived',
        privacy: 'sensitive',
      }),
    )

    await act(() => rendered.result.current.create())

    expect(createWithFirstMember).toHaveBeenCalledWith(
      expect.objectContaining({
        newTrackId: TRACK_ID,
        newMemberId: MEMBER_ID,
        tagStateOmitted: false,
        track: expect.objectContaining({
          name: 'My exact Track',
          iconId: 'icon.journey',
          suggestedTagId: 'tag.travel',
        }),
        member: expect.objectContaining({
          title: 'Long journey',
          markdown: 'Café  日本語\tkept',
          privacy: 'sensitive',
          tags: {
            ordered: ['tag.travel', 'tag.personal'],
            display: 'tag.travel',
          },
          placement: expect.objectContaining({
            beginMarker: { enabled: true, titleOverride: 'Departed' },
            endMarker: { enabled: true, titleOverride: 'Arrived' },
          }),
        }),
      }),
    )
    expect(rendered.result.current.state.draft?.name).toBe('My exact Track')
    expect(rendered.result.current.state.memberDraft?.markdown).toBe(
      'Café  日本語\tkept',
    )
    expect(rendered.result.current.state.failure?.code).toBe(
      'atomicCaptureFailed',
    )
  })

  it('keeps mixed-member core order and advances only with its opaque cursor', async () => {
    const next = 'next-page' as TrackHistoryCursor
    const history = vi
      .fn<LifeArchiveClient['tracks']['history']>()
      .mockResolvedValueOnce(
        ok({
          track: TRACK,
          members: [
            {
              id: EVENT_ID,
              revision: revision('2'),
              kind: 'event',
              title: 'Event first from core',
              primaryDate: civilDate('2025-01-03'),
              endDate: null,
              iconId: 'icon.event',
              displayTagId: null,
              beginMarkerTitleOverride: null,
              endMarkerTitleOverride: null,
            },
            {
              id: MEMBER_ID,
              revision: revision('7'),
              kind: 'span',
              title: 'Ongoing second from core',
              primaryDate: civilDate('2024-01-01'),
              endDate: null,
              iconId: 'icon.span',
              displayTagId: null,
              beginMarkerTitleOverride: 'Start',
              endMarkerTitleOverride: null,
            },
          ],
          nextCursor: next,
          invalidation: INVALIDATION,
        }),
      )
      .mockResolvedValueOnce(
        ok({
          track: TRACK,
          members: [
            {
              id: stableId('8f1c0a10-0000-4000-8000-000000000805'),
              revision: revision('1'),
              kind: 'span',
              title: 'Second page',
              primaryDate: civilDate('2020-01-01'),
              endDate: civilDate('2020-01-02'),
              iconId: 'icon.span',
              displayTagId: null,
              beginMarkerTitleOverride: null,
              endMarkerTitleOverride: null,
            },
          ],
          nextCursor: null,
          invalidation: INVALIDATION,
        }),
      )
    const { rendered } = tracks(client({ history }))
    await waitFor(() =>
      expect(rendered.result.current.state.tracks).toHaveLength(1),
    )
    act(() => rendered.result.current.select(SUMMARY))
    await waitFor(() =>
      expect(rendered.result.current.state.history).toHaveLength(2),
    )
    expect(
      rendered.result.current.state.history.map(({ title }) => title),
    ).toEqual(['Event first from core', 'Ongoing second from core'])

    await act(() => rendered.result.current.loadMore())

    expect(history.mock.calls[1]?.[0].cursor).toBe(next)
    expect(
      rendered.result.current.state.history.map(({ title }) => title),
    ).toEqual([
      'Event first from core',
      'Ongoing second from core',
      'Second page',
    ])
  })

  it('creates another ongoing member with omitted tag state and keeps the draft on failure', async () => {
    const createMember = vi.fn(async (): Promise<ClientResult<never>> =>
      failed(
        clientFailure({
          area: 'record',
          code: 'memberCreateFailed',
          phase: 'mutation',
          retryable: true,
        }),
      ),
    )
    const { rendered } = tracks(
      client({
        createMember:
          createMember as LifeArchiveClient['tracks']['createMember'],
      }),
    )
    await waitFor(() =>
      expect(rendered.result.current.state.tracks).toHaveLength(1),
    )
    act(() => rendered.result.current.select(SUMMARY))
    await waitFor(() =>
      expect(rendered.result.current.state.selected).toEqual(TRACK),
    )
    act(() => rendered.result.current.startAddMember(civilDate('2025-06-14')))
    act(() =>
      rendered.result.current.updateMember({
        kind: 'span',
        title: 'Another current chapter',
        markdown: 'Still ongoing.',
      }),
    )

    await act(() => rendered.result.current.createMember())

    expect(createMember).toHaveBeenCalledWith(
      expect.objectContaining({
        trackId: TRACK_ID,
        expectedTrackRevision: TRACK.revision,
        tagStateOmitted: true,
        member: expect.objectContaining({
          title: 'Another current chapter',
          placement: expect.objectContaining({
            kind: 'span',
            endDate: null,
          }),
          tags: { ordered: [], display: null },
        }),
      }),
    )
    expect(rendered.result.current.state.memberDraft?.markdown).toBe(
      'Still ongoing.',
    )
  })

  it('preserves a Track draft through a revision conflict and detaches only after confirmation', async () => {
    const currentTrack = {
      ...TRACK,
      revision: revision('9'),
      name: 'Archive name',
    }
    const save = vi.fn(async () =>
      ok<TrackMutationResult>({
        outcome: 'conflict',
        conflict: {
          expectedRevision: TRACK.revision,
          actualRevision: currentTrack.revision,
          current: { presence: 'present', track: currentTrack },
        },
      }),
    )
    const deleteTrack = vi.fn(async () =>
      ok<TrackMutationResult>({
        outcome: 'deleted',
        track: currentTrack,
        detachedMemberCount: 2,
        invalidation: INVALIDATION,
      }),
    )
    const { rendered } = tracks(client({ save, delete: deleteTrack }))
    await waitFor(() =>
      expect(rendered.result.current.state.tracks).toHaveLength(1),
    )
    act(() => rendered.result.current.select(SUMMARY))
    await waitFor(() =>
      expect(rendered.result.current.state.selected).toEqual(TRACK),
    )
    act(() => rendered.result.current.updateTrack({ name: 'My unlost name' }))

    await act(() => rendered.result.current.save())
    expect(rendered.result.current.state.draft?.name).toBe('My unlost name')
    expect(rendered.result.current.state.status).toBe('conflicted')

    await act(() => rendered.result.current.deleteTrack(true))
    expect(deleteTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        id: TRACK_ID,
        detachMembers: true,
      }),
    )
  })

  it('archives with the exact revision and re-reads the same Track after reopening', async () => {
    const archived = {
      ...TRACK,
      revision: revision('6'),
      isArchived: true,
    }
    const list = vi.fn(async () =>
      ok({ tracks: [SUMMARY], invalidation: INVALIDATION }),
    )
    const save = vi.fn(async () =>
      ok<TrackMutationResult>({
        outcome: 'updated',
        track: archived,
        detachedMemberCount: 0,
        invalidation: INVALIDATION,
      }),
    )
    const testClient = client({ list, save })
    const first = tracks(testClient).rendered
    await waitFor(() =>
      expect(first.result.current.state.tracks).toHaveLength(1),
    )
    act(() => first.result.current.select(SUMMARY))
    await waitFor(() =>
      expect(first.result.current.state.selected).toEqual(TRACK),
    )
    act(() => first.result.current.updateTrack({ isArchived: true }))
    await act(() => first.result.current.save())

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: TRACK_ID,
        expectedRevision: revision('5'),
        draft: expect.objectContaining({ isArchived: true }),
      }),
    )
    expect(first.result.current.state.selected).toEqual(archived)
    first.unmount()

    const reopened = tracks(testClient).rendered
    await waitFor(() =>
      expect(reopened.result.current.state.tracks[0]?.track.id).toBe(TRACK_ID),
    )
    expect(list).toHaveBeenCalledTimes(3)
  })
})
