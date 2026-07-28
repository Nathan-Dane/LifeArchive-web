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
import type { RecordDraftRegistration } from '../recordDraftSession'
import { useSpanEditor } from './useSpanEditor'

const ARCHIVE_ID = stableId('8f1c0a10-0000-4000-8000-000000000701')
const SPAN_ID = stableId('8f1c0a10-0000-4000-8000-000000000702')
const NEW_SPAN_ID = stableId('8f1c0a10-0000-4000-8000-000000000703')
const INVALIDATION = {
  storeInstanceId: 'span-editor-test',
  revision: revision('20'),
}

function summary({
  objectRevision = revision('4'),
  startDate = civilDate('2024-08-01'),
  endDate = null,
  beginTitle = null,
  endTitle = null,
}: {
  readonly objectRevision?: ReturnType<typeof revision>
  readonly startDate?: ReturnType<typeof civilDate>
  readonly endDate?: ReturnType<typeof civilDate> | null
  readonly beginTitle?: string | null
  readonly endTitle?: string | null
} = {}): StructuredSummary {
  return {
    id: SPAN_ID,
    revision: objectRevision,
    title: 'Living in Aarhus',
    placement: {
      kind: 'span',
      startDate,
      endDate,
      beginMarker: { enabled: beginTitle !== null, titleOverride: beginTitle },
      endMarker: { enabled: endTitle !== null, titleOverride: endTitle },
    },
    iconId: 'life-span',
    tags: { ordered: ['home'], display: 'home' },
    trackId: null,
  }
}

function object(
  spanSummary = summary(),
  markdown = 'Exact Span writing.',
): StructuredObject {
  return {
    summary: spanSummary,
    markdown,
    createdAtMs: 1,
    updatedAtMs: 2,
    privacy: 'normal',
    media: [],
    hasMoreMedia: false,
  }
}

type Overrides = {
  readonly load?: LifeArchiveClient['structured']['load']
  readonly create?: LifeArchiveClient['structured']['create']
  readonly save?: LifeArchiveClient['structured']['save']
  readonly delete?: LifeArchiveClient['structured']['delete']
  readonly convertSpanToEvent?: LifeArchiveClient['structured']['convertSpanToEvent']
  readonly attachMember?: LifeArchiveClient['tracks']['attachMember']
  readonly detachMember?: LifeArchiveClient['tracks']['detachMember']
}

function testClient(overrides: Overrides = {}): LifeArchiveClient {
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
      convertSpanToEvent:
        overrides.convertSpanToEvent ?? base.structured.convertSpanToEvent,
    },
    tracks: {
      ...base.tracks,
      attachMember: overrides.attachMember ?? base.tracks.attachMember,
      detachMember: overrides.detachMember ?? base.tracks.detachMember,
    },
    operations: {
      ...base.operations,
      newStableId: () => NEW_SPAN_ID,
    },
  }
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
  let registration: RecordDraftRegistration | null = null
  const rendered = renderHook(
    ({ current }) =>
      useSpanEditor(client, {
        selected: current,
        developmentMock: false,
        register: (value) => {
          registration = value
          return () => undefined
        },
        ...callbacks,
      }),
    { initialProps: { current: selected } },
  )
  return {
    ...rendered,
    flush: async () => {
      if (!registration) throw new Error('Span editor did not register')
      await registration.flush()
    },
  }
}

function updated(
  savedObject: StructuredObject,
): ClientResult<StructuredMutationResult> {
  return ok({
    outcome: 'updated',
    object: savedObject,
    invalidation: INVALIDATION,
  })
}

describe('the revision-safe Span editor', () => {
  it('finishes an in-flight exact load after the selected summary refreshes', async () => {
    let resolveLoad:
      ((result: ClientResult<StructuredObjectState>) => void) | undefined
    const load = vi.fn(
      () =>
        new Promise<ClientResult<StructuredObjectState>>((resolve) => {
          resolveLoad = resolve
        }),
    )
    const savedSummary = {
      ...summary({ objectRevision: revision('5') }),
      title: 'Updated safely',
    }
    const save = vi.fn(async () => updated(object(savedSummary)))
    const rendered = editor(testClient({ load, save }), summary())
    await waitFor(() => expect(rendered.result.current.status).toBe('loading'))

    rendered.rerender({ current: { ...summary() } })
    expect(load).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveLoad?.(
        ok({
          presence: 'present',
          object: object(),
          invalidation: INVALIDATION,
        }),
      )
      await Promise.resolve()
    })
    await waitFor(() => expect(rendered.result.current.status).toBe('ready'))

    act(() => rendered.result.current.update({ title: 'Updated safely' }))
    await act(rendered.flush)

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: SPAN_ID,
        expectedRevision: revision('4'),
        draft: expect.objectContaining({ title: 'Updated safely' }),
      }),
    )
    expect(rendered.result.current.status).toBe('saved')
  })

  it('opens and closes an ongoing end and saves marker configuration exactly', async () => {
    const saved = object(
      summary({
        objectRevision: revision('5'),
        endDate: civilDate('2025-06-14'),
        beginTitle: 'Arrived',
      }),
      'Exact Span writing.',
    )
    const save = vi.fn(async () => updated(saved))
    const rendered = editor(testClient({ save }), summary())
    await waitFor(() => expect(rendered.result.current.status).toBe('ready'))

    expect(rendered.result.current.draft).toMatchObject({
      ongoing: true,
      endDate: '',
    })
    act(() =>
      rendered.result.current.update({
        ongoing: false,
        endDate: '2025-06-14',
        beginMarkerEnabled: true,
        beginMarkerTitle: 'Arrived',
        endMarkerEnabled: true,
        endMarkerTitle: '',
      }),
    )
    await act(rendered.flush)

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: SPAN_ID,
        expectedRevision: revision('4'),
        draft: expect.objectContaining({
          markdown: 'Exact Span writing.',
          placement: {
            kind: 'span',
            startDate: '2024-08-01',
            endDate: '2025-06-14',
            beginMarker: {
              enabled: true,
              titleOverride: 'Arrived',
            },
            endMarker: { enabled: true, titleOverride: null },
          },
        }),
      }),
    )
    expect(rendered.result.current.movedRange).toBe(true)

    act(() => rendered.result.current.update({ ongoing: true }))
    await act(rendered.flush)
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({
          placement: expect.objectContaining({ endDate: null }),
        }),
      }),
    )
  })

  it('resets a marker override to the derived automatic title', async () => {
    const save = vi.fn(async () =>
      updated(object(summary({ beginTitle: null }))),
    )
    const rendered = editor(
      testClient({
        load: async () =>
          ok({
            presence: 'present',
            object: object(summary({ beginTitle: 'Old override' })),
            invalidation: INVALIDATION,
          }),
        save,
      }),
      summary({ beginTitle: 'Old override' }),
    )
    await waitFor(() => expect(rendered.result.current.status).toBe('ready'))

    act(() => rendered.result.current.resetMarkerTitle('begin'))
    await act(rendered.flush)

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({
          placement: expect.objectContaining({
            beginMarker: { enabled: true, titleOverride: null },
          }),
        }),
      }),
    )
  })

  it('keeps a reversed creation draft when core validation rejects it', async () => {
    const create = vi.fn(async () =>
      failed<StructuredMutationResult>(
        clientFailure({
          area: 'record',
          code: 'invalidRange',
          phase: 'validation',
          retryable: false,
          field: 'endDate',
        }),
      ),
    )
    const rendered = editor(testClient({ create }), null)
    act(() => rendered.result.current.startCreate(civilDate('2025-06-14')))
    expect(rendered.result.current.draft).toEqual(
      expect.objectContaining({
        iconId: 'span',
        tagIds: ['personal'],
        displayTagId: 'personal',
      }),
    )
    act(() =>
      rendered.result.current.update({
        title: 'Reversed but preserved',
        markdown: 'Do not lose this buffer.',
        ongoing: false,
        endDate: '2025-06-13',
      }),
    )

    await act(() => rendered.result.current.create())

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        newObjectId: NEW_SPAN_ID,
        draft: expect.objectContaining({
          markdown: 'Do not lose this buffer.',
          iconId: 'span',
          tags: { ordered: ['personal'], display: 'personal' },
          placement: expect.objectContaining({
            startDate: '2025-06-14',
            endDate: '2025-06-13',
          }),
        }),
      }),
    )
    expect(rendered.result.current.status).toBe('failed')
    expect(rendered.result.current.draft?.markdown).toBe(
      'Do not lose this buffer.',
    )
  })

  it('preserves the complete buffer and stable ID when one-day conversion conflicts', async () => {
    const closedSpan = summary({
      startDate: civilDate('2025-06-01'),
      endDate: civilDate('2025-06-20'),
    })
    const current = object(
      summary({
        objectRevision: revision('9'),
        startDate: civilDate('2025-06-01'),
        endDate: civilDate('2025-06-20'),
      }),
      'Archive version',
    )
    const convertSpanToEvent = vi.fn(
      async (): Promise<ClientResult<StructuredMutationResult>> =>
        ok({
          outcome: 'conflict',
          conflict: {
            expectedRevision: revision('4'),
            actualRevision: revision('9'),
            current: { presence: 'present', object: current },
          },
        }),
    )
    const rendered = editor(
      testClient({
        load: async () =>
          ok({
            presence: 'present',
            object: object(closedSpan, 'My exact buffer'),
            invalidation: INVALIDATION,
          }),
        convertSpanToEvent,
      }),
      closedSpan,
    )
    await waitFor(() => expect(rendered.result.current.status).toBe('ready'))

    await act(() => rendered.result.current.convertToEvent('2025-06-14'))

    expect(convertSpanToEvent).toHaveBeenCalledWith({
      spanId: SPAN_ID,
      expectedRevision: revision('4'),
      requestedStartDate: civilDate('2025-06-14'),
      requestedEndDate: civilDate('2025-06-14'),
      nowMs: expect.any(Number),
    })
    expect(rendered.result.current.status).toBe('conflicted')
    expect(rendered.result.current.object?.summary.id).toBe(SPAN_ID)
    expect(rendered.result.current.draft?.markdown).toBe('My exact buffer')
  })

  it('converts a chosen date in place and reports the same stable ID and writing', async () => {
    const closedSpan = summary({
      startDate: civilDate('2025-06-01'),
      endDate: civilDate('2025-06-20'),
    })
    const converted: StructuredObject = {
      ...object(closedSpan, 'Writing crosses conversion.'),
      summary: {
        ...closedSpan,
        revision: revision('5'),
        placement: { kind: 'event', date: civilDate('2025-06-14') },
      },
    }
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
            object: object(closedSpan, 'Writing crosses conversion.'),
            invalidation: INVALIDATION,
          }),
        convertSpanToEvent: async () =>
          ok({
            outcome: 'converted',
            object: converted,
            invalidation: INVALIDATION,
          }),
      }),
      closedSpan,
      callbacks,
    )
    await waitFor(() => expect(rendered.result.current.status).toBe('ready'))

    expect(
      await act(() => rendered.result.current.convertToEvent('2025-06-14')),
    ).toBe(true)
    expect(converted.summary.id).toBe(SPAN_ID)
    expect(converted.markdown).toBe('Writing crosses conversion.')
    expect(callbacks.onChanged).toHaveBeenCalledWith(converted.summary)
  })

  it('deletes only the exact Span ID after revision-safe flush', async () => {
    const deleteOperation = vi.fn(
      async (): Promise<ClientResult<StructuredDeleteResult>> =>
        ok({
          outcome: 'deleted',
          deletedId: SPAN_ID,
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
      testClient({ delete: deleteOperation }),
      summary(),
      callbacks,
    )
    await waitFor(() => expect(rendered.result.current.status).toBe('ready'))

    expect(await act(() => rendered.result.current.deleteSpan())).toBe(true)

    expect(deleteOperation).toHaveBeenCalledWith({
      id: SPAN_ID,
      expectedRevision: revision('4'),
      nowMs: expect.any(Number),
    })
    expect(callbacks.onDeleted).toHaveBeenCalledWith(SPAN_ID)
  })

  it('reloads the exact saved identity, writing, range, and markers', async () => {
    const reopened = object(
      summary({
        objectRevision: revision('8'),
        startDate: civilDate('2023-01-01'),
        endDate: civilDate('2025-06-14'),
        beginTitle: 'Exact beginning',
        endTitle: 'Exact ending',
      }),
      'Whitespace stays.\n\nUnicode: Ærø 🌊',
    )
    const load = vi.fn(async (): Promise<ClientResult<StructuredObjectState>> =>
      ok({
        presence: 'present',
        object: reopened,
        invalidation: INVALIDATION,
      }),
    )
    const first = editor(testClient({ load }), reopened.summary)
    await waitFor(() => expect(first.result.current.status).toBe('ready'))
    first.unmount()
    const second = editor(testClient({ load }), reopened.summary)
    await waitFor(() => expect(second.result.current.status).toBe('ready'))

    expect(load).toHaveBeenCalledTimes(2)
    expect(second.result.current.object?.summary.id).toBe(SPAN_ID)
    expect(second.result.current.draft).toMatchObject({
      markdown: 'Whitespace stays.\n\nUnicode: Ærø 🌊',
      startDate: '2023-01-01',
      endDate: '2025-06-14',
      beginMarkerTitle: 'Exact beginning',
      endMarkerTitle: 'Exact ending',
    })
  })

  it('moves membership without changing ongoing dates, writing, tags, privacy, or markers', async () => {
    const TRACK_ID = stableId('8f1c0a10-0000-4000-8000-000000000710')
    const original = {
      ...object(
        {
          ...summary({
            beginTitle: 'Exact beginning',
            endTitle: 'Exact current edge',
          }),
          iconId: 'unknown.span-icon',
          tags: {
            ordered: ['home', 'personal'],
            display: 'personal',
          },
        },
        'Exact ongoing writing  \nkept.',
      ),
      privacy: 'sensitive' as const,
    }
    const moved = {
      ...original,
      summary: {
        ...original.summary,
        revision: revision('5'),
        trackId: TRACK_ID,
      },
    }
    const attachMember = vi.fn(async () =>
      ok<StructuredMutationResult>({
        outcome: 'updated',
        object: moved,
        invalidation: INVALIDATION,
      }),
    )
    const rendered = editor(
      testClient({
        load: async () =>
          ok({
            presence: 'present',
            object: original,
            invalidation: INVALIDATION,
          }),
        attachMember,
      }),
      original.summary,
    )
    await waitFor(() =>
      expect(rendered.result.current.object).toEqual(original),
    )

    await act(() => rendered.result.current.changeTrack(TRACK_ID))

    expect(attachMember).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: SPAN_ID,
        memberKind: 'span',
        expectedMemberRevision: revision('4'),
        trackId: TRACK_ID,
      }),
    )
    expect(rendered.result.current.object).toEqual(moved)
    expect(rendered.result.current.draft).toMatchObject({
      markdown: 'Exact ongoing writing  \nkept.',
      startDate: '2024-08-01',
      ongoing: true,
      iconId: 'unknown.span-icon',
      tagIds: ['home', 'personal'],
      displayTagId: 'personal',
      beginMarkerEnabled: true,
      beginMarkerTitle: 'Exact beginning',
      endMarkerEnabled: true,
      endMarkerTitle: 'Exact current edge',
      privacy: 'sensitive',
    })
  })
})
