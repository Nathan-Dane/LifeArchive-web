/**
 * Browser-only acquisition and delivery for the opaque archive transport.
 *
 * This layer never opens the TAR or interprets LifeArchive paths or records.
 * The dedicated worker/runtime consumes and produces the selected File.
 */

export const ARCHIVE_TRANSPORT_EXTENSION = '.lifearchive.tar'
export const ARCHIVE_TRANSPORT_MIME_TYPE = 'application/x-tar'

const ACCEPTED_PICKER_MIME_TYPES = new Set([
  '',
  ARCHIVE_TRANSPORT_MIME_TYPE,
  'application/octet-stream',
])

export type ArchiveTransportFailure =
  'invalid-extension' | 'invalid-mime' | 'empty-file'

export type ArchiveTransportSelection =
  | {
      outcome: 'selected'
      file: File
      stream: ReadableStream<Uint8Array>
      byteLength: number
    }
  | {
      outcome: 'rejected'
      failure: ArchiveTransportFailure
    }

export interface PreparedArchiveDownload {
  readonly url: string
  readonly filename: string
  readonly mimeType: typeof ARCHIVE_TRANSPORT_MIME_TYPE
  release(): void
}

interface ObjectUrlApi {
  createObjectURL(object: Blob): string
  revokeObjectURL(url: string): void
}

export function selectArchiveTransport(file: File): ArchiveTransportSelection {
  const failure = validateArchiveTransportFile(file)
  if (failure) {
    return { outcome: 'rejected', failure }
  }

  return {
    outcome: 'selected',
    file,
    stream: file.stream(),
    byteLength: file.size,
  }
}

export function prepareArchiveDownload(
  file: File,
  objectUrls: ObjectUrlApi = URL,
): PreparedArchiveDownload {
  const failure = validateArchiveTransportFile(file)
  if (failure) {
    throw new TypeError(`Invalid archive transport: ${failure}`)
  }

  const url = objectUrls.createObjectURL(file)
  let released = false

  return {
    url,
    filename: file.name,
    mimeType: ARCHIVE_TRANSPORT_MIME_TYPE,
    release() {
      if (!released) {
        released = true
        objectUrls.revokeObjectURL(url)
      }
    },
  }
}

function validateArchiveTransportFile(
  file: File,
): ArchiveTransportFailure | undefined {
  if (!file.name.endsWith(ARCHIVE_TRANSPORT_EXTENSION)) {
    return 'invalid-extension'
  }
  if (!ACCEPTED_PICKER_MIME_TYPES.has(file.type.toLowerCase())) {
    return 'invalid-mime'
  }
  if (file.size === 0) {
    return 'empty-file'
  }
  return undefined
}
