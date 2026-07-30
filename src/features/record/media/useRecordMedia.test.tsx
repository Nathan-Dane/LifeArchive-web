import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  clientFailure,
  failed,
  ok,
  revision,
  stableId,
  type ClientResult,
  type LifeArchiveClient,
  type MediaImportResult,
  type MediaItem,
  type MediaListing,
  type MediaDeleteResult,
  type StableId,
} from '../../../core/client'
import { TestLifeArchiveClient } from '../../../test/TestLifeArchiveClient'
import { useRecordMedia } from './useRecordMedia'

const OWNER_A = stableId('7f1c0a10-0000-4000-8000-000000000901')
const OWNER_B = stableId('7f1c0a10-0000-4000-8000-000000000902')
const MEDIA_ID = stableId('7f1c0a10-0000-4000-8000-000000000903')
const NEW_MEDIA_ID = stableId('7f1c0a10-0000-4000-8000-000000000904')
const REVISION_A = revision('4')
const REVISION_A_AFTER = revision('5')
const REVISION_B = revision('12')
const INVALIDATION = {
  storeInstanceId: 'media-test',
  revision: revision('30'),
}

function item(parentEntryId: StableId = OWNER_A): MediaItem {
  return {
    id: MEDIA_ID,
    parentEntryId,
    fileName: 'exact-name.jpeg',
    kind: 'image',
    mimeType: 'image/jpeg',
    byteSize: 3,
    createdAtMs: 111,
    capturedAtMs: 110,
    durationMs: null,
    width: 42,
    height: 24,
    caption: 'Exact caption',
  }
}

function listing(
  parentEntryId: StableId,
  parentRevision = REVISION_A,
  items: readonly MediaItem[] = [],
): MediaListing {
  return {
    parentEntryId,
    parentRevision,
    items,
    invalidation: INVALIDATION,
  }
}

function mediaClient(overrides: Partial<LifeArchiveClient['media']>) {
  const base = new TestLifeArchiveClient({
    state: 'open',
    archive: {
      storeId: stableId('7f1c0a10-0000-4000-8000-000000000900'),
      productContract: 'test',
      storeSchemaVersion: 'test',
      rootLayoutVersion: 'test',
      invalidation: INVALIDATION,
    },
  }).client
  return {
    ...base,
    media: { ...base.media, ...overrides },
    operations: {
      ...base.operations,
      newStableId: () => NEW_MEDIA_ID,
    },
  } satisfies LifeArchiveClient
}

describe('Record media authority', () => {
  it('captures the owner at admission when selection changes during import', async () => {
    let finishImport:
      ((value: ClientResult<MediaImportResult>) => void) | null = null
    let imported = false
    const importMedia = vi.fn<LifeArchiveClient['media']['import']>(
      () =>
        new Promise<ClientResult<MediaImportResult>>((resolve) => {
          finishImport = resolve
        }),
    )
    const list = vi.fn(async ({ parentEntryId }: { parentEntryId: StableId }) =>
      ok(
        parentEntryId === OWNER_B
          ? listing(OWNER_B, REVISION_B)
          : listing(
              OWNER_A,
              imported ? REVISION_A_AFTER : REVISION_A,
              imported ? [item()] : [],
            ),
      ),
    )
    const client = mediaClient({ list, import: importMedia })
    const rendered = renderHook(
      ({ ownerId }) => useRecordMedia(client, { ownerId }),
      { initialProps: { ownerId: OWNER_A as StableId } },
    )
    await waitFor(() =>
      expect(rendered.result.current.listing.revision).toBe(REVISION_A),
    )

    let operation!: Promise<void>
    act(() => {
      operation = rendered.result.current.importFiles([
        new File([Uint8Array.from([8, 7, 6])], 'captured.bin', {
          type: 'application/octet-stream',
        }),
      ])
    })
    await waitFor(() => expect(importMedia).toHaveBeenCalledTimes(1))
    const request = importMedia.mock.calls[0]?.[0]
    expect(request).toMatchObject({
      newMediaId: NEW_MEDIA_ID,
      parentEntryId: OWNER_A,
      expectedParentRevision: REVISION_A,
      fileName: 'captured.bin',
    })
    expect(new Uint8Array(request?.bytes ?? new ArrayBuffer(0))).toEqual(
      Uint8Array.from([8, 7, 6]),
    )

    rendered.rerender({ ownerId: OWNER_B })
    await waitFor(() =>
      expect(rendered.result.current.listing.revision).toBe(REVISION_B),
    )
    imported = true
    await act(async () => {
      finishImport?.(
        ok({
          outcome: 'imported',
          item: item(),
          invalidation: INVALIDATION,
        }),
      )
      await operation
    })

    expect(rendered.result.current.listing.ownerId).toBe(OWNER_B)
    expect(rendered.result.current.listing.items).toEqual([])
  })

  it('keeps exact listed metadata after a revision conflict and delete failure', async () => {
    const conflict = clientFailure({
      area: 'media',
      code: 'revisionConflict',
      phase: 'mutation',
      retryable: true,
      expectedRevision: REVISION_A,
      actualRevision: REVISION_A_AFTER,
    })
    const list = vi.fn(async () => ok(listing(OWNER_A, REVISION_A, [item()])))
    const client = mediaClient({
      list,
      import: vi.fn<LifeArchiveClient['media']['import']>(async () =>
        failed<MediaImportResult>(conflict),
      ),
      delete: vi.fn<LifeArchiveClient['media']['delete']>(async () =>
        failed<MediaDeleteResult>(conflict),
      ),
    })
    const rendered = renderHook(() =>
      useRecordMedia(client, { ownerId: OWNER_A }),
    )
    await waitFor(() =>
      expect(rendered.result.current.listing.items).toEqual([item()]),
    )

    await act(() =>
      rendered.result.current.importFiles([
        new File([Uint8Array.from([1])], 'conflict.bin'),
      ]),
    )
    expect(rendered.result.current.mutationFailure).toBe(conflict)
    expect(rendered.result.current.listing.items).toEqual([item()])

    let deleted = true
    await act(async () => {
      deleted = await rendered.result.current.deleteItem(item())
    })
    expect(deleted).toBe(false)
    expect(rendered.result.current.mutationFailure).toBe(conflict)
    expect(rendered.result.current.listing.items).toEqual([item()])
    expect(list).toHaveBeenCalledTimes(1)
  })
})
