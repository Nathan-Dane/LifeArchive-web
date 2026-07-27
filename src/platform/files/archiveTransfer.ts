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

export type ArchiveDownloadFailure =
  'download-unavailable' | 'download-handoff-failed'

export type ArchiveDownloadDelivery =
  | {
      readonly outcome: 'handed-off'
      readonly filename: string
    }
  | {
      readonly outcome: 'failed'
      readonly failure: ArchiveDownloadFailure
    }

interface ObjectUrlApi {
  createObjectURL(object: Blob): string
  revokeObjectURL(url: string): void
}

interface DownloadDocument {
  readonly body: Pick<HTMLElement, 'append'>
  createElement(tagName: 'a'): HTMLAnchorElement
}

export interface ArchiveDownloadEnvironment {
  readonly document?: DownloadDocument
  readonly objectUrls?: ObjectUrlApi
  readonly releaseLater?: (release: () => void) => void
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

/**
 * Hands a verified, opaque package to the browser download UI.
 *
 * The app does not choose or inspect a destination and therefore cannot
 * overwrite one. Filename collisions and the final save location stay with
 * the browser. A handoff is deliberately not called a saved file: browsers do
 * not expose a definitive write result for an anchor download.
 */
export function deliverArchiveDownload(
  file: File,
  environment: ArchiveDownloadEnvironment = {},
): ArchiveDownloadDelivery {
  const downloadDocument = environment.document ?? globalThis.document
  const objectUrls = environment.objectUrls ?? globalThis.URL
  if (!downloadDocument?.body || !objectUrls?.createObjectURL) {
    return { outcome: 'failed', failure: 'download-unavailable' }
  }

  let prepared: PreparedArchiveDownload | null = null
  let anchor: HTMLAnchorElement | null = null
  try {
    prepared = prepareArchiveDownload(file, objectUrls)
    const downloadAnchor = downloadDocument.createElement(
      'a',
    ) as HTMLAnchorElement
    anchor = downloadAnchor
    downloadAnchor.href = prepared.url
    downloadAnchor.download = prepared.filename
    downloadAnchor.hidden = true
    downloadDocument.body.append(downloadAnchor)
    downloadAnchor.click()
    const release = prepared.release
    ;(environment.releaseLater ?? releaseOnNextTask)(release)
    prepared = null
    return { outcome: 'handed-off', filename: file.name }
  } catch {
    return { outcome: 'failed', failure: 'download-handoff-failed' }
  } finally {
    anchor?.remove()
    prepared?.release()
  }
}

function releaseOnNextTask(release: () => void): void {
  globalThis.setTimeout(release, 0)
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
