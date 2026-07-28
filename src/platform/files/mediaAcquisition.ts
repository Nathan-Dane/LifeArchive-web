import type { MediaKind } from '../../core/client'

export interface MediaReadProgress {
  readonly bytesRead: number
  readonly byteSize: number
}

export interface AcquiredMedia {
  readonly fileName: string
  readonly bytes: ArrayBuffer
  readonly createdAtMs: number
  readonly mimeTypeHint: string | null
  readonly kindHint: MediaKind | null
}

function kindHint(mimeType: string): MediaKind | null {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('text/')) return 'text'
  if (
    mimeType === 'application/pdf' ||
    mimeType.includes('document') ||
    mimeType.includes('presentation') ||
    mimeType.includes('spreadsheet')
  ) {
    return 'document'
  }
  return mimeType.length > 0 ? 'other' : null
}

/**
 * Copies a picker result into an operation-owned byte buffer. The File and its
 * picker provenance are discarded after this call; neither is a durable media
 * source. Streaming keeps progress truthful without imposing a web-owned size
 * or file-count policy.
 */
export async function acquireMediaFile(
  file: File,
  createdAtMs: number,
  onProgress: (progress: MediaReadProgress) => void,
): Promise<AcquiredMedia> {
  const bytes =
    typeof file.stream === 'function'
      ? await readStream(file, onProgress)
      : await readLegacyFile(file, onProgress)

  const mimeType = file.type.trim().toLowerCase()
  return {
    fileName: file.name,
    bytes: bytes.buffer,
    createdAtMs,
    mimeTypeHint: mimeType.length > 0 ? mimeType : null,
    kindHint: kindHint(mimeType),
  }
}

async function readStream(
  file: File,
  onProgress: (progress: MediaReadProgress) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = new Uint8Array(file.size)
  const reader = file.stream().getReader()
  let offset = 0

  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      if (offset + chunk.value.byteLength > bytes.byteLength) {
        throw new TypeError('Media file stream exceeded its declared size')
      }
      bytes.set(chunk.value, offset)
      offset += chunk.value.byteLength
      onProgress({ bytesRead: offset, byteSize: file.size })
    }
  } finally {
    reader.releaseLock()
  }

  if (offset !== file.size) {
    throw new TypeError('Media file stream did not match its declared size')
  }
  if (file.size === 0) {
    onProgress({ bytesRead: 0, byteSize: 0 })
  }
  return bytes
}

async function readLegacyFile(
  file: File,
  onProgress: (progress: MediaReadProgress) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof file.arrayBuffer === 'function') {
    const buffer = await file.arrayBuffer()
    onProgress({ bytesRead: buffer.byteLength, byteSize: file.size })
    return new Uint8Array(buffer)
  }
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onprogress = (event) =>
      onProgress({ bytesRead: event.loaded, byteSize: file.size })
    reader.onerror = () =>
      reject(reader.error ?? new TypeError('File read failed'))
    reader.onload = () =>
      reader.result instanceof ArrayBuffer
        ? resolve(reader.result)
        : reject(new TypeError('File read returned an unexpected value'))
    reader.readAsArrayBuffer(file)
  })
  onProgress({ bytesRead: buffer.byteLength, byteSize: file.size })
  return new Uint8Array(buffer)
}
