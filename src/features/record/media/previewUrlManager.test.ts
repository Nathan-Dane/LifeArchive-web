import { afterEach, describe, expect, it, vi } from 'vitest'
import { PreviewUrlManager, safePreviewKind } from './previewUrlManager'

describe('safe media preview URLs', () => {
  afterEach(() => vi.restoreAllMocks())

  it('admits only explicitly browser-safe image, audio, and video MIME types', () => {
    expect(safePreviewKind('image/jpeg')).toBe('image')
    expect(safePreviewKind('audio/mpeg')).toBe('audio')
    expect(safePreviewKind('video/webm')).toBe('video')
    expect(safePreviewKind('image/svg+xml')).toBeNull()
    expect(safePreviewKind('text/html')).toBeNull()
    expect(safePreviewKind('application/pdf')).toBeNull()
  })

  it('revokes replaced and closed object URLs exactly once', () => {
    const create = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:second')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const manager = new PreviewUrlManager()

    expect(manager.open('image/jpeg', Uint8Array.from([1]))).toBe('blob:first')
    expect(manager.open('image/png', Uint8Array.from([2]))).toBe('blob:second')
    manager.close()
    manager.close()

    expect(create).toHaveBeenCalledTimes(2)
    expect(revoke.mock.calls).toEqual([['blob:first'], ['blob:second']])
  })
})
