import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  ok,
  revision,
  stableId,
  type LifeArchiveClient,
} from '../../core/client'
import { I18nProvider } from '../../i18n'
import { TestLifeArchiveClient } from '../../test/TestLifeArchiveClient'
import { PersonAvatar } from './PersonAvatar'

const STORE_ID = stableId('bd000000-0000-4000-8000-000000000001')
const PERSON_ID = stableId('bd000000-0000-4000-8000-000000000002')
const PHOTO_ID = stableId('bd000000-0000-4000-8000-000000000003')

describe('PersonAvatar', () => {
  it('falls back to initials when durable photo bytes cannot be decoded', async () => {
    const base = new TestLifeArchiveClient({
      state: 'open',
      archive: {
        storeId: STORE_ID,
        productContract: '11',
        storeSchemaVersion: '12',
        rootLayoutVersion: '1',
        invalidation: {
          storeInstanceId: 'person-avatar-test',
          revision: revision('1'),
        },
      },
    }).client
    const client: LifeArchiveClient = {
      ...base,
      media: {
        ...base.media,
        content: async () =>
          ok({
            mediaId: PHOTO_ID,
            bytes: new Uint8Array([0, 1, 2]),
            byteSize: 3,
            sha256: null,
          }),
      },
    }

    render(
      <I18nProvider locale="en">
        <PersonAvatar
          client={client}
          name="Maya Chen"
          photo={{
            id: PHOTO_ID,
            personId: PERSON_ID,
            fileName: 'maya.jpg',
            mimeType: 'image/jpeg',
            sha256: null,
            byteSize: 3,
            createdAtMs: 1,
            capturedAtMs: null,
            width: null,
            height: null,
          }}
        />
      </I18nProvider>,
    )

    const photo = await screen.findByRole('img', {
      name: 'Profile photo for Maya Chen',
    })
    fireEvent.error(photo)
    expect(
      screen.getByRole('img', { name: 'Initials for Maya Chen: MC' }),
    ).toBeVisible()
  })
})
