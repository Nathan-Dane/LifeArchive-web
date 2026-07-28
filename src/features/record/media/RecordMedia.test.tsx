import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clientFailure,
  failed,
  ok,
  revision,
  stableId,
  type LifeArchiveClient,
  type MediaDeleteResult,
  type MediaItem,
} from '../../../core/client'
import { I18nProvider } from '../../../i18n'
import { TestLifeArchiveClient } from '../../../test/TestLifeArchiveClient'
import { RecordMedia } from './RecordMedia'

const OWNER = stableId('7f1c0a10-0000-4000-8000-000000000951')
const MEDIA = stableId('7f1c0a10-0000-4000-8000-000000000952')
const INVALIDATION = {
  storeInstanceId: 'record-media-component',
  revision: revision('40'),
}
const EXACT_BYTES = Uint8Array.from([0xff, 0xd8, 0xff])
const ITEM: MediaItem = {
  id: MEDIA,
  parentEntryId: OWNER,
  fileName: 'Morgen ved havnen.jpeg',
  kind: 'image',
  mimeType: 'image/jpeg',
  byteSize: EXACT_BYTES.byteLength,
  createdAtMs: 100,
  capturedAtMs: 90,
  durationMs: null,
  width: 1200,
  height: 800,
  caption: 'No metadata is reconstructed',
}

function client(overrides: Partial<LifeArchiveClient['media']> = {}) {
  const base = new TestLifeArchiveClient({
    state: 'open',
    archive: {
      storeId: stableId('7f1c0a10-0000-4000-8000-000000000950'),
      productContract: 'test',
      storeSchemaVersion: 'test',
      rootLayoutVersion: 'test',
      invalidation: INVALIDATION,
    },
  }).client
  return {
    ...base,
    media: {
      ...base.media,
      list: async () =>
        ok({
          parentEntryId: OWNER,
          parentRevision: revision('8'),
          items: [ITEM],
          invalidation: INVALIDATION,
        }),
      content: async () =>
        ok({
          mediaId: MEDIA,
          bytes: EXACT_BYTES,
          byteSize: EXACT_BYTES.byteLength,
          sha256: null,
        }),
      ...overrides,
    },
  } satisfies LifeArchiveClient
}

function renderMedia(mediaClient: LifeArchiveClient) {
  return render(
    <I18nProvider locale="en">
      <RecordMedia client={mediaClient} ownerId={OWNER} />
    </I18nProvider>,
  )
}

describe('Record media gallery', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders exact core metadata, supports keyboard preview, and cleans up on reopen', async () => {
    const createUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:archived-preview')
    const revokeUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})
    const mediaClient = client()
    const first = renderMedia(mediaClient)
    const preview = await screen.findByRole('button', {
      name: 'Preview Morgen ved havnen.jpeg',
    })
    expect(screen.getByText('Morgen ved havnen.jpeg')).toBeVisible()
    expect(screen.getByText(/^Image · 3 byte/)).toBeVisible()

    preview.focus()
    await userEvent.keyboard('{Enter}')
    expect(
      await screen.findByRole('img', {
        name: 'Preview of Morgen ved havnen.jpeg',
      }),
    ).toHaveAttribute('src', 'blob:archived-preview')
    expect(createUrl).toHaveBeenCalledTimes(1)

    first.unmount()
    expect(revokeUrl).toHaveBeenCalledWith('blob:archived-preview')
    renderMedia(mediaClient)
    expect(
      await screen.findByRole('button', {
        name: 'Preview Morgen ved havnen.jpeg',
      }),
    ).toBeVisible()
  })

  it('keeps metadata when content is missing or confirmed deletion fails', async () => {
    const failure = clientFailure({
      area: 'media',
      code: 'ioFailure',
      phase: 'media',
      retryable: true,
      cleanup: 'complete',
    })
    const deleteMedia = vi.fn<LifeArchiveClient['media']['delete']>(async () =>
      failed<MediaDeleteResult>(failure),
    )
    renderMedia(
      client({
        content: async () => failed(failure),
        delete: deleteMedia,
      }),
    )
    const user = userEvent.setup()
    await user.click(
      await screen.findByRole('button', {
        name: 'Preview Morgen ved havnen.jpeg',
      }),
    )
    expect(
      await screen.findByText(/archived content is unavailable for preview/i),
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', {
        name: 'Remove Morgen ved havnen.jpeg',
      }),
    )
    expect(
      screen.getByText(
        'Remove Morgen ved havnen.jpeg from this entry and the archive?',
      ),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Remove media' }))

    await waitFor(() => expect(deleteMedia).toHaveBeenCalledTimes(1))
    expect(screen.getAllByText('Morgen ved havnen.jpeg')[0]).toBeVisible()
    expect(screen.getByText(/media change did not complete/i)).toBeVisible()
  })
})
