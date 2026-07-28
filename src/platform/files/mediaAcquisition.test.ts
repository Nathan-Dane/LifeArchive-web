import { describe, expect, it, vi } from 'vitest'
import { acquireMediaFile } from './mediaAcquisition'

describe('media acquisition', () => {
  it('streams a multi-megabyte file byte-exactly without imposing a size limit', async () => {
    const source = new Uint8Array(2 * 1024 * 1024 + 17)
    for (let index = 0; index < source.length; index += 1) {
      source[index] = index % 251
    }
    const progress = vi.fn()
    const acquired = await acquireMediaFile(
      new File([source], 'field-recording.bin', {
        type: 'application/octet-stream',
      }),
      1234,
      progress,
    )

    expect(Buffer.from(acquired.bytes).equals(Buffer.from(source))).toBe(true)
    expect(acquired).toMatchObject({
      fileName: 'field-recording.bin',
      createdAtMs: 1234,
      mimeTypeHint: 'application/octet-stream',
      kindHint: 'other',
    })
    expect(progress).toHaveBeenLastCalledWith({
      bytesRead: source.byteLength,
      byteSize: source.byteLength,
    })
  })
})
