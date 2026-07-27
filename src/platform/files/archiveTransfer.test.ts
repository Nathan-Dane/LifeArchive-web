import { describe, expect, it, vi } from 'vitest'

import {
  ARCHIVE_TRANSPORT_EXTENSION,
  ARCHIVE_TRANSPORT_MIME_TYPE,
  deliverArchiveDownload,
  prepareArchiveDownload,
  selectArchiveTransport,
} from './archiveTransfer'

function syntheticFile(
  name = `Synthetic${ARCHIVE_TRANSPORT_EXTENSION}`,
  type = ARCHIVE_TRANSPORT_MIME_TYPE,
): File {
  const file = new File([new Uint8Array([0x61, 0x62, 0x63])], name, { type })
  Object.defineProperty(file, 'stream', {
    configurable: true,
    value: () =>
      new ReadableStream<Uint8Array<ArrayBuffer>>({
        start(controller) {
          const bytes = new Uint8Array(new ArrayBuffer(3))
          bytes.set([0x61, 0x62, 0x63])
          controller.enqueue(bytes)
          controller.close()
        },
      }),
  })
  return file
}

describe('archive transport file handoff', () => {
  it('hands the selected browser-backed file and stream onward unchanged', () => {
    const file = syntheticFile()
    const stream = new ReadableStream<Uint8Array<ArrayBuffer>>()
    const streamSpy = vi.spyOn(file, 'stream').mockReturnValue(stream)

    expect(selectArchiveTransport(file)).toEqual({
      outcome: 'selected',
      file,
      stream,
      byteLength: 3,
    })
    expect(streamSpy).toHaveBeenCalledOnce()
  })

  it.each([
    ['Synthetic.zip', ARCHIVE_TRANSPORT_MIME_TYPE, 'invalid-extension'],
    [
      'Synthetic.LIFEARCHIVE.TAR',
      ARCHIVE_TRANSPORT_MIME_TYPE,
      'invalid-extension',
    ],
    [
      `Synthetic${ARCHIVE_TRANSPORT_EXTENSION}`,
      'application/zip',
      'invalid-mime',
    ],
  ] as const)(
    'rejects unsupported filename or MIME inputs',
    (name, type, failure) => {
      expect(selectArchiveTransport(syntheticFile(name, type))).toEqual({
        outcome: 'rejected',
        failure,
      })
    },
  )

  it('accepts an empty or generic picker MIME without weakening the suffix', () => {
    expect(selectArchiveTransport(syntheticFile(undefined, '')).outcome).toBe(
      'selected',
    )
    expect(
      selectArchiveTransport(
        syntheticFile(undefined, 'application/octet-stream'),
      ).outcome,
    ).toBe('selected')
  })

  it('rejects an empty outer file before worker handoff', () => {
    const file = new File([], `Synthetic${ARCHIVE_TRANSPORT_EXTENSION}`, {
      type: ARCHIVE_TRANSPORT_MIME_TYPE,
    })
    expect(selectArchiveTransport(file)).toEqual({
      outcome: 'rejected',
      failure: 'empty-file',
    })
  })

  it('prepares the exact download metadata and revokes its URL once', () => {
    const file = syntheticFile()
    const objectUrls = {
      createObjectURL: vi.fn(() => 'blob:synthetic-archive'),
      revokeObjectURL: vi.fn(),
    }

    const download = prepareArchiveDownload(file, objectUrls)

    expect(objectUrls.createObjectURL).toHaveBeenCalledWith(file)
    expect(download).toMatchObject({
      url: 'blob:synthetic-archive',
      filename: file.name,
      mimeType: ARCHIVE_TRANSPORT_MIME_TYPE,
    })

    download.release()
    download.release()
    expect(objectUrls.revokeObjectURL).toHaveBeenCalledOnce()
    expect(objectUrls.revokeObjectURL).toHaveBeenCalledWith(
      'blob:synthetic-archive',
    )
  })

  it('hands the download to the browser without choosing a destination and cleans up', () => {
    const file = syntheticFile()
    const anchor = document.createElement('a')
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => undefined)
    const remove = vi.spyOn(anchor, 'remove')
    const objectUrls = {
      createObjectURL: vi.fn(() => 'blob:synthetic-archive'),
      revokeObjectURL: vi.fn(),
    }
    const releases: Array<() => void> = []

    expect(
      deliverArchiveDownload(file, {
        document: {
          body: document.body,
          createElement: () => anchor,
        },
        objectUrls,
        releaseLater: (release) => releases.push(release),
      }),
    ).toEqual({ outcome: 'handed-off', filename: file.name })
    expect(anchor.download).toBe(file.name)
    expect(anchor.href).toBe('blob:synthetic-archive')
    expect(click).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledOnce()
    expect(objectUrls.revokeObjectURL).not.toHaveBeenCalled()

    releases[0]?.()
    expect(objectUrls.revokeObjectURL).toHaveBeenCalledOnce()
  })

  it('does not claim a handoff and still revokes the URL when browser delivery fails', () => {
    const file = syntheticFile()
    const anchor = document.createElement('a')
    vi.spyOn(anchor, 'click').mockImplementation(() => {
      throw new Error('download blocked')
    })
    const objectUrls = {
      createObjectURL: vi.fn(() => 'blob:blocked-archive'),
      revokeObjectURL: vi.fn(),
    }

    expect(
      deliverArchiveDownload(file, {
        document: {
          body: document.body,
          createElement: () => anchor,
        },
        objectUrls,
      }),
    ).toEqual({
      outcome: 'failed',
      failure: 'download-handoff-failed',
    })
    expect(objectUrls.revokeObjectURL).toHaveBeenCalledWith(
      'blob:blocked-archive',
    )
    expect(document.body).not.toContainElement(anchor)
  })
})
