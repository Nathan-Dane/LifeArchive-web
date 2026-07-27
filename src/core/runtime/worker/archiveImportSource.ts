export const ARCHIVE_IMPORT_CHUNK_BYTES = 256 * 1024

export interface RuntimeArchiveTransportSource {
  readonly kind: 'runtime-staged-chunks'
  readonly path: string
  readonly byteLength: string
}

export interface RuntimeArchiveSourceWriter {
  write(bytes: Uint8Array): Promise<void>
  finish(): Promise<RuntimeArchiveTransportSource>
  dispose(): Promise<void>
}

/**
 * Copies an opaque browser-backed File through a bounded runtime-owned writer.
 * This layer never interprets the TAR or any archive content.
 */
export async function stageArchiveTransport(
  writer: RuntimeArchiveSourceWriter,
  archive: File,
  signal: AbortSignal,
): Promise<RuntimeArchiveTransportSource> {
  if (signal.aborted) {
    await writer.dispose()
    throw archiveAcquisitionCancelled()
  }

  const reader = archive.stream().getReader()
  let byteLength = 0
  let completed = false
  const cancelRead = () => {
    void reader.cancel().catch(() => undefined)
  }
  signal.addEventListener('abort', cancelRead, { once: true })

  try {
    while (true) {
      if (signal.aborted) {
        throw archiveAcquisitionCancelled()
      }
      const next = await reader.read()
      if (signal.aborted) {
        throw archiveAcquisitionCancelled()
      }
      if (next.done) break
      if (!(next.value instanceof Uint8Array)) {
        throw new TypeError('Archive stream returned a non-byte chunk')
      }
      for (
        let offset = 0;
        offset < next.value.byteLength;
        offset += ARCHIVE_IMPORT_CHUNK_BYTES
      ) {
        if (signal.aborted) {
          throw archiveAcquisitionCancelled()
        }
        const end = Math.min(
          offset + ARCHIVE_IMPORT_CHUNK_BYTES,
          next.value.byteLength,
        )
        const chunk = next.value.subarray(offset, end)
        await writer.write(chunk)
        byteLength += chunk.byteLength
      }
    }
    if (byteLength !== archive.size) {
      throw new Error('Archive stream byte length did not match the File')
    }
    const source = await writer.finish()
    if (source.byteLength !== String(byteLength)) {
      throw new Error('Runtime archive staging length did not match the File')
    }
    completed = true
    return source
  } finally {
    signal.removeEventListener('abort', cancelRead)
    if (!completed) {
      await writer.dispose()
    }
  }
}

function archiveAcquisitionCancelled(): Error {
  const error = new Error('Archive acquisition was cancelled')
  error.name = 'ArchiveAcquisitionCancelled'
  return error
}
