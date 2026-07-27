import { describe, expect, it, vi } from 'vitest'
import {
  ARCHIVE_IMPORT_CHUNK_BYTES,
  stageArchiveTransport,
  type RuntimeArchiveSourceWriter,
} from './archiveImportSource'

const LARGE_MEDIA_BYTES = 6 * 1024 * 1024 + 731

class MemoryWriter implements RuntimeArchiveSourceWriter {
  readonly writes: number[] = []
  readonly chunks: Uint8Array[] = []
  disposed = false

  async write(bytes: Uint8Array): Promise<void> {
    this.chunks.push(bytes.slice())
    this.writes.push(bytes.byteLength)
  }

  finish(): Promise<{
    readonly kind: 'runtime-staged-chunks'
    readonly path: string
    readonly byteLength: string
  }> {
    return Promise.resolve({
      kind: 'runtime-staged-chunks',
      path: '/runtime-owned/archive.transport',
      byteLength: String(this.byteLength()),
    })
  }

  async dispose(): Promise<void> {
    this.disposed = true
  }

  bytes(): Uint8Array {
    const bytes = new Uint8Array(this.byteLength())
    let offset = 0
    for (const chunk of this.chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return bytes
  }

  private byteLength(): number {
    return this.chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  }
}

function patternedBytes(byteLength: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(byteLength)
  for (let index = 0; index < bytes.byteLength; index += 1) {
    bytes[index] = (index * 31 + 17) & 0xff
  }
  return bytes
}

function streamedFile(
  bytes: Uint8Array<ArrayBuffer>,
  chunks: readonly number[],
): File {
  const file = new File([bytes], 'Large.lifearchive.tar', {
    type: 'application/x-tar',
  })
  let offset = 0
  let chunkIndex = 0
  Object.defineProperty(file, 'stream', {
    configurable: true,
    value: () =>
      new ReadableStream<Uint8Array>({
        pull(controller) {
          if (offset === bytes.byteLength) {
            controller.close()
            return
          }
          const requested = chunks[chunkIndex] ?? bytes.byteLength
          chunkIndex += 1
          const end = Math.min(offset + requested, bytes.byteLength)
          controller.enqueue(bytes.subarray(offset, end))
          offset = end
        },
      }),
  })
  return file
}

describe('runtime-owned archive transport staging', () => {
  it('streams multi-megabyte media byte-exactly in bounded writes without File.arrayBuffer', async () => {
    const bytes = patternedBytes(LARGE_MEDIA_BYTES)
    const file = streamedFile(bytes, [bytes.byteLength])
    const arrayBuffer = vi
      .spyOn(file, 'arrayBuffer')
      .mockRejectedValue(new Error('whole-file buffering is forbidden'))
    const writer = new MemoryWriter()

    const source = await stageArchiveTransport(
      writer,
      file,
      new AbortController().signal,
    )
    const stagedBytes = writer.bytes()

    expect(arrayBuffer).not.toHaveBeenCalled()
    expect(source.byteLength).toBe(String(bytes.byteLength))
    expect(writer.writes.length).toBeGreaterThan(1)
    expect(Math.max(...writer.writes)).toBeLessThanOrEqual(
      ARCHIVE_IMPORT_CHUNK_BYTES,
    )
    expect(stagedBytes).toEqual(bytes)
    expect(writer.disposed).toBe(false)
  }, 15_000)

  it('cancels acquisition, closes the source stream, and removes partial staging', async () => {
    const bytes = patternedBytes(ARCHIVE_IMPORT_CHUNK_BYTES * 2)
    let cancelCalled = false
    let releaseRead: (() => void) | undefined
    const blocked = new Promise<void>((resolve) => {
      releaseRead = resolve
    })
    let reads = 0
    const file = new File([bytes], 'Cancelled.lifearchive.tar')
    Object.defineProperty(file, 'stream', {
      configurable: true,
      value: () =>
        new ReadableStream<Uint8Array>({
          async pull(controller) {
            reads += 1
            if (reads === 1) {
              controller.enqueue(bytes.subarray(0, ARCHIVE_IMPORT_CHUNK_BYTES))
              return
            }
            await blocked
            controller.enqueue(bytes.subarray(ARCHIVE_IMPORT_CHUNK_BYTES))
            controller.close()
          },
          cancel() {
            cancelCalled = true
            releaseRead?.()
          },
        }),
    })
    const writer = new MemoryWriter()
    const controller = new AbortController()

    const staging = stageArchiveTransport(writer, file, controller.signal)
    await vi.waitFor(() => expect(writer.writes).toHaveLength(1))
    controller.abort()

    await expect(staging).rejects.toMatchObject({
      name: 'ArchiveAcquisitionCancelled',
    })
    expect(cancelCalled).toBe(true)
    expect(writer.disposed).toBe(true)
  })
})
