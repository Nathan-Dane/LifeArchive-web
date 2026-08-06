import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  civilDate,
  ok,
  revision,
  stableId,
  type ClientResult,
  type LifeArchiveClient,
  type PersonListPage,
  type PersonMutationResult,
  type PersonSnapshot,
} from '../../core/client'
import { TestLifeArchiveClient } from '../../test/TestLifeArchiveClient'
import { usePeople } from './usePeople'

const STORE_ID = stableId('a1000000-0000-4000-8000-000000000101')
const PERSON_ID = stableId('a1000000-0000-4000-8000-000000000102')
const OTHER_ID = stableId('a1000000-0000-4000-8000-000000000103')
const ENTRY_ID = stableId('a1000000-0000-4000-8000-000000000104')
const PHOTO_ID = stableId('a1000000-0000-4000-8000-000000000105')
const INVALIDATION = {
  storeInstanceId: 'people-hook-test',
  revision: revision('8'),
}

function snapshot(
  id = PERSON_ID,
  displayName = 'Ada Lovelace',
  personRevision = '2',
): PersonSnapshot {
  return {
    person: {
      id,
      displayName,
      connectionLabels: ['Friend'],
      about: null,
      otherNames: [],
      pronouns: null,
      pronunciation: null,
      lifeStatus: 'notSpecified',
      birthDate: null,
      deathDate: null,
      references: [],
      isArchived: false,
      createdAtMs: 1,
      updatedAtMs: 2,
      deletedAtMs: null,
      mergedIntoPersonId: null,
    },
    revision: revision(personRevision),
    profilePhoto: null,
    lastRecordedContactDate: null,
  }
}

function client(
  overrides: Partial<LifeArchiveClient['people']> = {},
): LifeArchiveClient {
  const base = new TestLifeArchiveClient({
    state: 'open',
    archive: {
      storeId: STORE_ID,
      productContract: '9',
      storeSchemaVersion: '12',
      rootLayoutVersion: '1',
      invalidation: INVALIDATION,
    },
  }).client
  return {
    ...base,
    people: {
      ...base.people,
      load: async (id) =>
        ok({
          current: snapshot(id as typeof PERSON_ID),
          invalidation: INVALIDATION,
        }),
      list: async () =>
        ok({
          people: [snapshot()],
          hasMore: false,
          nextCursor: null,
          invalidation: INVALIDATION,
        }),
      memories: async () =>
        ok({ memories: [], hasMore: false, invalidation: INVALIDATION }),
      contactSummary: async () =>
        ok({
          summary: {
            lastRecordedContactDate: null,
            current30DayContactDays: 0,
            previous30DayContactDays: 0,
            current30DayTimeTogetherDays: 0,
          },
          invalidation: INVALIDATION,
        }),
      ...overrides,
    },
    operations: {
      ...base.operations,
      newStableId: () => PHOTO_ID,
    },
  }
}

describe('usePeople', () => {
  it('rejects stale search responses and sends the core cursor for paging', async () => {
    const opaqueCursor = {
      displayName: 'core-owned cursor value',
      createdAtMs: 99,
      personId: PERSON_ID,
    }
    const pending = new Map<
      string,
      (page: ClientResult<PersonListPage>) => void
    >()
    const list = vi.fn<LifeArchiveClient['people']['list']>(
      ({ query, after }) => {
        if (query === null) {
          return Promise.resolve(
            ok({
              people: [snapshot()],
              hasMore: true,
              nextCursor: opaqueCursor,
              invalidation: INVALIDATION,
            }),
          )
        }
        if (after) {
          return Promise.resolve(
            ok({
              people: [snapshot(OTHER_ID, 'Grace Hopper')],
              hasMore: false,
              nextCursor: null,
              invalidation: INVALIDATION,
            }),
          )
        }
        return new Promise((resolve) => pending.set(query ?? '', resolve))
      },
    )
    const testClient = client({ list })
    const rendered = renderHook(() => usePeople(testClient))
    await waitFor(() =>
      expect(rendered.result.current.state.people).toHaveLength(1),
    )

    let first!: Promise<boolean>
    let second!: Promise<boolean>
    act(() => {
      first = rendered.result.current.list('Ada')
      second = rendered.result.current.list('Grace')
    })
    await act(async () => {
      pending.get('Grace')!(
        ok({
          people: [snapshot(OTHER_ID, 'Grace Hopper')],
          hasMore: true,
          nextCursor: opaqueCursor,
          invalidation: INVALIDATION,
        }),
      )
      await second
      pending.get('Ada')!(
        ok({
          people: [snapshot(PERSON_ID, 'Stale Ada')],
          hasMore: false,
          nextCursor: null,
          invalidation: INVALIDATION,
        }),
      )
      await first
    })
    expect(rendered.result.current.state.people[0]?.person.displayName).toBe(
      'Grace Hopper',
    )

    await act(async () => rendered.result.current.loadMore())
    expect(list).toHaveBeenLastCalledWith({
      query: 'Grace',
      includeArchived: true,
      limit: 25,
      after: opaqueCursor,
    })
    expect(
      rendered.result.current.state.people.map(
        ({ person }) => person.displayName,
      ),
    ).toEqual(['Grace Hopper'])
  })

  it('preserves the submitted draft through a revision conflict and retries against the core snapshot', async () => {
    const current = snapshot(PERSON_ID, 'Archive Ada', '3')
    const saved = snapshot(PERSON_ID, 'Edited Ada', '4')
    const save = vi
      .fn<LifeArchiveClient['people']['save']>()
      .mockResolvedValueOnce(
        ok<PersonMutationResult>({
          outcome: 'conflict',
          conflict: {
            expectedRevision: revision('2'),
            actualRevision: revision('3'),
            current,
          },
        }),
      )
      .mockResolvedValueOnce(
        ok<PersonMutationResult>({
          outcome: 'updated',
          current: saved,
          invalidation: INVALIDATION,
        }),
      )
    const testClient = client({ save })
    const rendered = renderHook(() => usePeople(testClient))
    await waitFor(() =>
      expect(rendered.result.current.state.people).toHaveLength(1),
    )
    await act(async () => rendered.result.current.select(snapshot()))
    act(() => rendered.result.current.update({ displayName: 'Edited Ada' }))

    await act(async () => rendered.result.current.save())
    expect(rendered.result.current.state.draft?.displayName).toBe('Edited Ada')
    expect(rendered.result.current.state.conflict).toEqual(current)

    await act(async () => rendered.result.current.saveMine())
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expectedRevision: revision('3'),
        profile: expect.objectContaining({ displayName: 'Edited Ada' }),
      }),
    )
    expect(rendered.result.current.state.selected).toEqual(saved)
  })

  it('transfers acquired photo bytes and uses the latest Person revision for removal', async () => {
    const withPhoto: PersonSnapshot = {
      ...snapshot(PERSON_ID, 'Ada Lovelace', '3'),
      profilePhoto: {
        id: PHOTO_ID,
        personId: PERSON_ID,
        fileName: 'ada.png',
        mimeType: 'image/png',
        sha256: 'a'.repeat(64),
        byteSize: 3,
        createdAtMs: 4,
        capturedAtMs: null,
        width: null,
        height: null,
      },
    }
    const importPhoto = vi.fn<LifeArchiveClient['people']['importPhoto']>(
      async () =>
        ok({ outcome: 'set', current: withPhoto, invalidation: INVALIDATION }),
    )
    const removePhoto = vi.fn<LifeArchiveClient['people']['removePhoto']>(
      async () =>
        ok({
          outcome: 'removed',
          current: snapshot(PERSON_ID, 'Ada Lovelace', '4'),
          invalidation: INVALIDATION,
        }),
    )
    const testClient = client({ importPhoto, removePhoto })
    const rendered = renderHook(() => usePeople(testClient))
    await waitFor(() =>
      expect(rendered.result.current.state.people).toHaveLength(1),
    )
    await act(async () => rendered.result.current.select(snapshot()))
    const file = new File([Uint8Array.from([4, 5, 6])], 'ada.png', {
      type: 'image/png',
    })

    await act(async () => rendered.result.current.importPhoto(file))
    const request = importPhoto.mock.calls[0]![0]
    expect(Array.from(new Uint8Array(request.bytes))).toEqual([4, 5, 6])
    expect(request).toMatchObject({
      personId: PERSON_ID,
      expectedRevision: revision('2'),
      newPhotoId: PHOTO_ID,
      fileName: 'ada.png',
      mimeType: 'image/png',
    })

    await act(async () => rendered.result.current.removePhoto())
    expect(removePhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: PERSON_ID,
        expectedRevision: revision('3'),
      }),
    )
  })

  it('pages bounded memories using the last exact core summary', async () => {
    const first = {
      entryId: ENTRY_ID,
      entryType: 'day' as const,
      civilStartDate: civilDate('2026-01-02'),
      civilEndDate: null,
      title: null,
      hasWriting: true,
      interactionLevel: 'brief' as const,
      tookPart: false,
      isSubject: false,
    }
    const memories = vi
      .fn<LifeArchiveClient['people']['memories']>()
      .mockResolvedValueOnce(
        ok({ memories: [first], hasMore: true, invalidation: INVALIDATION }),
      )
      .mockResolvedValueOnce(
        ok({ memories: [], hasMore: false, invalidation: INVALIDATION }),
      )
    const testClient = client({ memories })
    const rendered = renderHook(() => usePeople(testClient))
    await waitFor(() =>
      expect(rendered.result.current.state.people).toHaveLength(1),
    )
    await act(async () => rendered.result.current.select(snapshot()))
    await act(async () => rendered.result.current.loadMoreMemories())
    expect(memories).toHaveBeenLastCalledWith({
      personId: PERSON_ID,
      limit: 10,
      before: first,
    })
    expect(rendered.result.current.state.memoriesHasMore).toBe(false)
  })

  it('archives, atomically merges, and deletes with each latest expected revision', async () => {
    const duplicate = snapshot(OTHER_ID, 'Grace Hopper', '6')
    const merged = snapshot(PERSON_ID, 'Ada Lovelace', '3')
    const archived: PersonSnapshot = {
      ...snapshot(PERSON_ID, 'Ada Lovelace', '4'),
      person: { ...snapshot().person, isArchived: true },
    }
    const save = vi.fn<LifeArchiveClient['people']['save']>(async () =>
      ok({ outcome: 'updated', current: archived, invalidation: INVALIDATION }),
    )
    const merge = vi.fn<LifeArchiveClient['people']['merge']>(async () =>
      ok({
        outcome: 'merged',
        current: merged,
        mergedPersonId: OTHER_ID,
        invalidation: INVALIDATION,
      }),
    )
    const deletePerson = vi.fn<LifeArchiveClient['people']['delete']>(
      async () =>
        ok({ outcome: 'deleted', current: merged, invalidation: INVALIDATION }),
    )
    const testClient = client({
      list: async () =>
        ok({
          people: [snapshot(), duplicate],
          hasMore: false,
          nextCursor: null,
          invalidation: INVALIDATION,
        }),
      save,
      merge,
      delete: deletePerson,
    })
    const rendered = renderHook(() => usePeople(testClient))
    await waitFor(() =>
      expect(rendered.result.current.state.people).toHaveLength(2),
    )
    await act(async () => rendered.result.current.select(snapshot()))

    await act(async () =>
      rendered.result.current.merge(duplicate, {
        displayNameSource: 'retained',
        aboutSource: 'combined',
        photoSource: 'none',
      }),
    )
    expect(merge).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRetainedRevision: revision('2'),
        expectedDuplicateRevision: revision('6'),
        duplicatePersonId: OTHER_ID,
      }),
    )
    expect(rendered.result.current.state.people).toHaveLength(1)

    await act(async () => rendered.result.current.setArchived(true))
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRevision: revision('3'),
        isArchived: true,
      }),
    )

    await act(async () => rendered.result.current.deletePerson())
    expect(deletePerson).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRevision: revision('4'),
      }),
    )
    expect(rendered.result.current.active).toBe(false)
  })

  it('pages contact history by the last exact contact day', async () => {
    const firstDay = {
      date: civilDate('2026-02-03'),
      interactionLevel: 'brief' as const,
      memories: [],
    }
    const contactHistory = vi
      .fn<LifeArchiveClient['people']['contactHistory']>()
      .mockResolvedValueOnce(
        ok({
          days: [firstDay],
          hasMore: true,
          totalContactDays: 1,
          totalTimeTogetherDays: 0,
          periodSummaries: [],
          invalidation: INVALIDATION,
        }),
      )
      .mockResolvedValueOnce(
        ok({
          days: [],
          hasMore: false,
          totalContactDays: 1,
          totalTimeTogetherDays: 0,
          periodSummaries: [],
          invalidation: INVALIDATION,
        }),
      )
    const testClient = client({ contactHistory })
    const rendered = renderHook(() => usePeople(testClient))
    await waitFor(() =>
      expect(rendered.result.current.state.people).toHaveLength(1),
    )
    await act(async () => rendered.result.current.select(snapshot()))
    await act(async () =>
      rendered.result.current.loadContactHistory('sixMonths'),
    )
    await act(async () =>
      rendered.result.current.loadContactHistory('sixMonths', true),
    )
    expect(contactHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        personId: PERSON_ID,
        range: 'sixMonths',
        limit: 30,
        beforeDate: civilDate('2026-02-03'),
      }),
    )
    expect(rendered.result.current.state.contactHistory?.hasMore).toBe(false)
  })

  it('rejects a stale contact-history response after the range changes', async () => {
    const pending = new Map<
      string,
      (
        result: Awaited<
          ReturnType<LifeArchiveClient['people']['contactHistory']>
        >,
      ) => void
    >()
    const contactHistory = vi.fn<LifeArchiveClient['people']['contactHistory']>(
      ({ range }) => new Promise((resolve) => pending.set(range, resolve)),
    )
    const testClient = client({ contactHistory })
    const rendered = renderHook(() => usePeople(testClient))
    await waitFor(() =>
      expect(rendered.result.current.state.people).toHaveLength(1),
    )
    await act(async () => rendered.result.current.select(snapshot()))

    let first!: Promise<boolean>
    let second!: Promise<boolean>
    act(() => {
      first = rendered.result.current.loadContactHistory('thirtyDays')
      second = rendered.result.current.loadContactHistory('all')
    })
    await act(async () => {
      pending.get('all')!(
        ok({
          days: [],
          hasMore: false,
          totalContactDays: 8,
          totalTimeTogetherDays: 3,
          periodSummaries: [],
          invalidation: INVALIDATION,
        }),
      )
      await second
      pending.get('thirtyDays')!(
        ok({
          days: [],
          hasMore: false,
          totalContactDays: 1,
          totalTimeTogetherDays: 0,
          periodSummaries: [],
          invalidation: INVALIDATION,
        }),
      )
      await first
    })

    expect(rendered.result.current.state.contactRange).toBe('all')
    expect(rendered.result.current.state.contactHistory?.totalContactDays).toBe(
      8,
    )
  })

  it('retains an acquired photo and retries its conflict against the current revision', async () => {
    const current = snapshot(PERSON_ID, 'Archive Ada', '3')
    const imported = {
      ...snapshot(PERSON_ID, 'Archive Ada', '4'),
      profilePhoto: {
        id: PHOTO_ID,
        personId: PERSON_ID,
        fileName: 'ada.png',
        mimeType: 'image/png',
        sha256: 'b'.repeat(64),
        byteSize: 3,
        createdAtMs: 4,
        capturedAtMs: null,
        width: null,
        height: null,
      },
    }
    const importPhoto = vi
      .fn<LifeArchiveClient['people']['importPhoto']>()
      .mockResolvedValueOnce(
        ok({
          outcome: 'conflict',
          conflict: {
            expectedRevision: revision('2'),
            actualRevision: revision('3'),
            current,
          },
        }),
      )
      .mockResolvedValueOnce(
        ok({ outcome: 'set', current: imported, invalidation: INVALIDATION }),
      )
    const testClient = client({ importPhoto })
    const rendered = renderHook(() => usePeople(testClient))
    await waitFor(() =>
      expect(rendered.result.current.state.people).toHaveLength(1),
    )
    await act(async () => rendered.result.current.select(snapshot()))
    const file = new File([Uint8Array.from([1, 2, 3])], 'ada.png', {
      type: 'image/png',
    })

    await act(async () => rendered.result.current.importPhoto(file))
    expect(rendered.result.current.state.pendingMutation?.kind).toBe(
      'importPhoto',
    )
    await act(async () => rendered.result.current.retryMutation())

    expect(importPhoto).toHaveBeenCalledTimes(2)
    expect(importPhoto.mock.calls[1]![0]).toMatchObject({
      personId: PERSON_ID,
      expectedRevision: revision('3'),
      fileName: 'ada.png',
    })
    expect(
      Array.from(new Uint8Array(importPhoto.mock.calls[1]![0].bytes)),
    ).toEqual([1, 2, 3])
  })
})
