const SAFE_IMAGE_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const SAFE_AUDIO_TYPES = new Set([
  'audio/aac',
  'audio/flac',
  'audio/m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
])

const SAFE_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/ogg',
  'video/quicktime',
  'video/webm',
])

export type SafePreviewKind = 'image' | 'audio' | 'video'

export function safePreviewKind(mimeType: string): SafePreviewKind | null {
  const normalised = mimeType.trim().toLowerCase()
  if (SAFE_IMAGE_TYPES.has(normalised)) return 'image'
  if (SAFE_AUDIO_TYPES.has(normalised)) return 'audio'
  if (SAFE_VIDEO_TYPES.has(normalised)) return 'video'
  return null
}

/**
 * Owns at most one ephemeral preview URL. Replacing, closing, changing owner,
 * and unmounting all converge on the same revocation path.
 */
export class PreviewUrlManager {
  private current: string | null = null

  open(mimeType: string, bytes: Uint8Array): string {
    this.close()
    const copy = new Uint8Array(bytes)
    this.current = URL.createObjectURL(
      new Blob([copy.buffer], { type: mimeType }),
    )
    return this.current
  }

  close(): void {
    if (this.current === null) return
    URL.revokeObjectURL(this.current)
    this.current = null
  }
}
