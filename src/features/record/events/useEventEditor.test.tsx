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
  type StructuredDeleteResult,
  type StructuredMutationResult,
  type StructuredObject,
  type StructuredObjectState,
  type StructuredSummary,
} from '../../../core/client'
import { TestLifeArchiveClient } from '../../../test/TestLifeArchiveClient'
import { useEventEditor } from './useEventEditor'

const ARCHIVE_ID = stableId('7f1c0a10-0000-4000-8000-000000000701')
const EVENT_A = stableId('7f1c0a10-0000-4000-8000-000000000702')
const EVENT_B = stableId('7f1c0a10-0000-4000-8000-000000000703')
const NEW_EVENT = stableId('7f1c0a10-0000-4000-8000-000000000704')
const INVALIDATION = {
  storeInstanceId: 'event-editor-test',
  revision: revision('20'),
}

function summary(
  id = EVENT_A,
  title = 'Harbour swim',
  date = civilDate('2025-06-14'),
  objectRevision = revision('4'),
): StructuredSummary {
  return {
    id,
    revision: objectRevision,
    title,
    placement: { kind: 'event', date },
    iconId: 'life-event',
    tags: { ordered: ['personal'], display: 'personal' },
    trackId: null,
  }
}

function object(
  eventSummary = summary(),
  markdown = 'Cold, clear water.',
): StructuredObject {
  return {
    summary: eventSummary,
    markdown,
    createdAtMs: 1,
    updatedAtMs: 2,
    privacy: 'normal',
    media: [],
    hasMoreMedia: false,
  }
}

function testClient(
  overrides: {
    readonly load?: (
      request: Parameters<LifeArchiveClient['structured']['load']>[0],
    ) => Promise<ClientResult<StructuredObjectState>>
    readonly create?: (
      request: Parameters<LifeArchiveClient['structured']['create']>[0],
    ) => Promise<ClientResult<StructuredMutationResult>>
    readonly save?: (
      request: Parameters<LifeArchiveClient['structured']['save']>[0],
    ) => Promise<ClientResult<StructuredMutationResult>>
    readonly delete?: (
      request: Parameters<LifeArchiveClient['structured']['delete']>[0],
    ) => Promise<ClientResult<StructuredDeleteResult>>
  } = {},
) {
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
  return {
    ...base,
    structured: {
      ...base.structured,
      load:
        overrides.load ??
        (async () =>
          ok({
            presence: 'present' as const,
            object: object(),
            invalidation: INVALIDATION,
          })),
      create: overrides.create ?? base.structured.create,
      save: overrides.save ?? base.structured.save,
      delete: overrides.delete ?? base.structured.delete,
    },
    operations: {
      ...base.operations,
      newStableId: () => NEW_EVENT,
    },
  } satisfies LifeArchiveClient
}

function editor(
  client: LifeArchiveClient,
  selected: StructuredSummary | null,
  callbacks = {
    onCreated: vi.fn(),
    onChanged: vi.fn(),
    onDeleted: vi.fn(),
    refreshObjects: vi.fn(),
  },
) {
  return renderHook(
    ({ current }) =>
      useEventEditor(client, {
        selected: current,
        developmentMock: false,
        register: () => () => undefined,
        ...callbacks,
      }),
    { initialProps: { current: selected } },
  )
}

describe('the revision-safe Event editor', () => {
  it('creates explicitly with the minted stable ID and selects the core result', async () => {
    const created = object(
      summary(NEW_EVENT, 'First Event'),
      'Exact creation buffer.',
    )
    const create = vi.fn(async () =>
      ok<StructuredMutationResult>({
        outcome: 'created',
        object: created,
        invalidation: INVALIDATION,
      }),
    )
    const callbacks = {
      onCreated: vi.fn(),
      onChanged: vi.fn(),
      onDeleted: vi.fn(),
      refreshObjects: vi.fn(),
    }
    const rendered = editor(testClient({ create }), null, callbacks)

    act(() => rendered.result.current.startCreate(civilDate('2025-06-14')))
    act(() => {
      rendered.result.current.update({
        title: 'First Event',
        markdown: 'Exact creation buffer.',
        tagIds: ['personal', 'creative'],
      })
    })
    expect(rendered.result.current.creating).toBe(true)

    await act(() => rendered.result.current.create())

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        newObjectId: NEW_EVENT,
        draft: expect.objectContaining({
          title: 'First Event',
          markdown: 'Exact creation buffer.',
          placement: { kind: 'event', date: '2025-06-14' },
          iconId: 'life-event',
          tags: {
            ordered: ['personal', 'creative'],
            display: 'personal',
          },
        }),
      }),
    )
    expect(callbacks.onCreated).toHaveBeenCalledWith(created.summary)
    rendered.rerender({ current: created.summary })
    expect(rendered.result.current.object?.summary.id).toBe(NEW_EVENT)
    expect(rendered.result.current.status).toBe('saved')
  })

  it('cancels a new draft without calling the core', () => {
    const create = vi.fn()
    const rendered = editor(testClient({ create }), null)

    act(() => rendered.result.current.startCreate(civilDate('2025-06-14')))
    act(() => {
      rendered.result.current.update({
        title: 'Keep only in this draft',
        markdown: 'Unsaved words',
      })
    })
    act(() => rendered.result.current.cancelCreate())

    expect(create).not.toHaveBeenCalled()
    expect(rendered.result.current.creating).toBe(false)
    expect(rendered.result.current.draft).toBeNull()
  })

  it('keeps an invalid creation draft when core validation refuses it', async () => {
    const create = vi.fn(async () =>
      failed<StructuredMutationResult>(
        clientFailure({
          area: 'record',
          code: 'invalidTitle',
          phase: 'validation',
          retryable: false,
          field: 'title',
        }),
      ),
    )
    const rendered = editor(testClient({ create }), null)

    act(() => rendered.result.current.startCreate(civilDate('2025-06-14')))
    act(() => {
      rendered.result.current.update({
        title: '   ',
        markdown: 'Writing that must survive validation.',
      })
    })
    await act(() => rendered.result.current.create())

    expect(rendered.result.current.status).toBe('failed')
    expect(rendered.result.current.creating).toBe(true)
    expect(rendered.result.current.draft).toMatchObject({
      title: '   ',
      markdown: 'Writing that must survive validation.',
    })
  })

  it('keeps the exact buffer through a conflict and retries at current revision', async () => {
    const original = object()
    const current = object(
      summary(
        EVENT_A,
        'Changed elsewhere',
        civilDate('2025-06-14'),
        revision('8'),
      ),
      'Archive version.',
    )
    const saved = object(
      summary(EVENT_A, 'My title', civilDate('2025-06-14'), revision('9')),
      'My exact writing.',
    )
    const save = vi
      .fn<LifeArchiveClient['structured']['save']>()
      .mockResolvedValueOnce(
        ok({
          outcome: 'conflict',
          conflict: {
            expectedRevision: revision('4'),
            actualRevision: revision('8'),
            current: { presence: 'present', object: current },
          },
        }),
      )
      .mockResolvedValueOnce(
        ok({
          outcome: 'updated',
          object: saved,
          invalidation: INVALIDATION,
        }),
      )
    const client = testClient({
      load: async () =>
        ok({
          presence: 'present',
          object: original,
          invalidation: INVALIDATION,
        }),
      save,
    })
    const rendered = editor(client, original.summary)
    await waitFor(() => expect(rendered.result.current.status).toBe('ready'))

    act(() => {
      rendered.result.current.update({
        title: 'My title',
        markdown: 'My exact writing.',
      })
      rendered.result.current.retrySave()
    })
    await waitFor(() =>
      expect(rendered.result.current.status).toBe('conflicted'),
    )
    expect(rendered.result.current.draft?.markdown).toBe('My exact writing.')

    act(() => rendered.result.current.saveMine())
    await waitFor(() => expect(rendered.result.current.status).toBe('saved'))

    expect(save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: EVENT_A,
        expectedRevision: revision('8'),
        draft: expect.objectContaining({
          title: 'My title',
          markdown: 'My exact writing.',
        }),
      }),
    )
  })

  it('moves and soft-deletes only the exact selected ID', async () => {
    const original = object()
    const moved = object(
      summary(EVENT_A, 'Harbour swim', civilDate('2025-06-20'), revision('5')),
    )
    const save = vi.fn(async () =>
      ok<StructuredMutationResult>({
        outcome: 'updated',
        object: moved,
        invalidation: INVALIDATION,
      }),
    )
    const remove = vi.fn(async () =>
      ok<StructuredDeleteResult>({
        outcome: 'deleted',
        deletedId: EVENT_A,
        deletedRevision: revision('5'),
        invalidation: INVALIDATION,
      }),
    )
    const callbacks = {
      onCreated: vi.fn(),
      onChanged: vi.fn(),
      onDeleted: vi.fn(),
      refreshObjects: vi.fn(),
    }
    const rendered = editor(
      testClient({
        load: async () =>
          ok({
            presence: 'present',
            object: original,
            invalidation: INVALIDATION,
          }),
        save,
        delete: remove,
      }),
      original.summary,
      callbacks,
    )
    await waitFor(() => expect(rendered.result.current.status).toBe('ready'))

    act(() => {
      rendered.result.current.update({ date: '2025-06-20' })
      rendered.result.current.retrySave()
    })
    await waitFor(() => expect(rendered.result.current.status).toBe('saved'))
    expect(callbacks.onChanged).toHaveBeenCalledWith(moved.summary)

    await act(() => rendered.result.current.deleteEvent())
    expect(remove).toHaveBeenCalledWith(
      expect.objectContaining({
        id: EVENT_A,
        expectedRevision: revision('5'),
      }),
    )
    expect(callbacks.onDeleted).toHaveBeenCalledWith(EVENT_A)
    expect(callbacks.onDeleted).not.toHaveBeenCalledWith(EVENT_B)
  })
})
