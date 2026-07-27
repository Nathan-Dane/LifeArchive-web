import type { RuntimeManifest } from './runtimeManifest'
import { verifyArtifactSha256 } from './runtimeCompatibility'

const TAR_BLOCK_BYTES = 512
const MAX_EXPANDED_ARTIFACT_BYTES = 512 * 1024 * 1024
const PAYLOAD_NAMES = [
  'LICENSE-RUNTIME.txt',
  'NOTICES.md',
  'lifearchive_runtime.d.ts',
  'lifearchive_runtime.js',
  'lifearchive_runtime_bg.wasm',
] as const

export class RuntimeArtifactError extends Error {
  readonly kind: 'archive' | 'checksum'

  constructor(kind: RuntimeArtifactError['kind'], message: string) {
    super(message)
    this.name = 'RuntimeArtifactError'
    this.kind = kind
  }
}

export interface ExtractedRuntimeArtifact {
  readonly manifestInput: unknown
  readonly files: ReadonlyMap<string, Uint8Array>
}

/**
 * Extracts the one reviewed ustar/gzip layout directly from the bytes whose
 * whole-artifact digest was checked. No separately hosted manifest or module
 * can therefore be selected after verification.
 */
export async function extractRuntimeArtifact(
  artifact: Uint8Array,
  runtimeVersion: string,
): Promise<ExtractedRuntimeArtifact> {
  const tar = await decompressGzip(artifact)
  const bundle = `lifearchive-runtime-web-${runtimeVersion}`
  const expected = [
    `${bundle}/`,
    ...PAYLOAD_NAMES.map((name) => `${bundle}/${name}`),
    `${bundle}/runtime-manifest.json`,
  ]
  const files = new Map<string, Uint8Array>()
  let offset = 0

  for (const expectedPath of expected) {
    const header = tar.subarray(offset, offset + TAR_BLOCK_BYTES)
    if (header.byteLength !== TAR_BLOCK_BYTES || isZeroBlock(header)) {
      throw new RuntimeArtifactError(
        'archive',
        'Runtime artifact has an incomplete file inventory',
      )
    }
    validateHeaderChecksum(header)
    const path = readTarPath(header)
    const size = readTarNumber(header.subarray(124, 136), 'file size')
    const type = header[156]
    const isDirectory = type === 53
    const isRegular = type === 0 || type === 48
    if (
      path !== expectedPath ||
      (expectedPath.endsWith('/') ? !isDirectory || size !== 0 : !isRegular)
    ) {
      throw new RuntimeArtifactError(
        'archive',
        'Runtime artifact content allowlist changed',
      )
    }

    offset += TAR_BLOCK_BYTES
    const end = offset + size
    if (end > tar.byteLength) {
      throw new RuntimeArtifactError(
        'archive',
        'Runtime artifact entry is truncated',
      )
    }
    if (!isDirectory) {
      const name = path.slice(bundle.length + 1)
      files.set(name, tar.slice(offset, end))
    }
    offset += Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES
  }

  if (
    offset + TAR_BLOCK_BYTES * 2 > tar.byteLength ||
    !isZeroBlock(tar.subarray(offset, offset + TAR_BLOCK_BYTES)) ||
    !isZeroBlock(
      tar.subarray(offset + TAR_BLOCK_BYTES, offset + TAR_BLOCK_BYTES * 2),
    ) ||
    tar.subarray(offset + TAR_BLOCK_BYTES * 2).some((byte) => byte !== 0)
  ) {
    throw new RuntimeArtifactError(
      'archive',
      'Runtime artifact has unexpected trailing content',
    )
  }

  const manifestBytes = files.get('runtime-manifest.json')
  if (!manifestBytes) {
    throw new RuntimeArtifactError(
      'archive',
      'Runtime artifact manifest is missing',
    )
  }
  let manifestInput: unknown
  try {
    manifestInput = JSON.parse(new TextDecoder().decode(manifestBytes))
  } catch {
    throw new RuntimeArtifactError(
      'archive',
      'Runtime artifact manifest is malformed',
    )
  }
  return { manifestInput, files }
}

/** Verifies every payload selected by the manifest from the same extraction. */
export async function verifyExtractedRuntimeFiles(
  manifest: RuntimeManifest,
  files: ReadonlyMap<string, Uint8Array>,
): Promise<void> {
  if (
    manifest.files.length !== PAYLOAD_NAMES.length ||
    files.size !== PAYLOAD_NAMES.length + 1
  ) {
    throw new RuntimeArtifactError(
      'archive',
      'Runtime artifact file inventory is invalid',
    )
  }
  for (const file of manifest.files) {
    const bytes = files.get(file.path)
    if (!bytes) {
      throw new RuntimeArtifactError(
        'archive',
        'Runtime artifact payload is missing',
      )
    }
    try {
      await verifyArtifactSha256(bytes, file.sha256)
    } catch {
      throw new RuntimeArtifactError(
        'checksum',
        'Runtime artifact payload checksum mismatch',
      )
    }
  }
}

async function decompressGzip(artifact: Uint8Array): Promise<Uint8Array> {
  try {
    const copy = new Uint8Array(artifact.byteLength)
    copy.set(artifact)
    const source = new Response(copy).body
    if (!source) {
      throw new RuntimeArtifactError(
        'archive',
        'Runtime artifact stream is unavailable',
      )
    }
    const stream = source.pipeThrough(new DecompressionStream('gzip'))
    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_EXPANDED_ARTIFACT_BYTES) {
        await reader.cancel()
        throw new RuntimeArtifactError(
          'archive',
          'Runtime artifact expands beyond the size limit',
        )
      }
      chunks.push(value)
    }
    const result = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.byteLength
    }
    return result
  } catch (error) {
    if (error instanceof RuntimeArtifactError) throw error
    throw new RuntimeArtifactError(
      'archive',
      'Runtime artifact is not valid gzip',
    )
  }
}

function validateHeaderChecksum(header: Uint8Array): void {
  const expected = readTarNumber(header.subarray(148, 156), 'header checksum')
  let actual = 0
  for (let index = 0; index < header.length; index += 1) {
    actual += index >= 148 && index < 156 ? 32 : header[index]
  }
  if (actual !== expected) {
    throw new RuntimeArtifactError(
      'archive',
      'Runtime artifact header checksum mismatch',
    )
  }
}

function readTarPath(header: Uint8Array): string {
  const magic = readTarText(header.subarray(257, 263))
  if (magic !== 'ustar') {
    throw new RuntimeArtifactError(
      'archive',
      'Runtime artifact is not in the approved ustar format',
    )
  }
  const name = readTarText(header.subarray(0, 100))
  const prefix = readTarText(header.subarray(345, 500))
  const path = prefix ? `${prefix}/${name}` : name
  if (
    !path ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.split('/').some((part) => part === '.' || part === '..')
  ) {
    throw new RuntimeArtifactError(
      'archive',
      'Runtime artifact contains an unsafe path',
    )
  }
  return path
}

function readTarText(bytes: Uint8Array): string {
  const end = bytes.indexOf(0)
  const value = bytes.subarray(0, end === -1 ? bytes.length : end)
  if (value.some((byte) => byte < 32 || byte > 126)) {
    throw new RuntimeArtifactError(
      'archive',
      'Runtime artifact header contains invalid text',
    )
  }
  return new TextDecoder('ascii').decode(value)
}

function readTarNumber(bytes: Uint8Array, field: string): number {
  const text = readTarText(bytes).trim()
  if (!/^[0-7]+$/.test(text)) {
    throw new RuntimeArtifactError(
      'archive',
      `Runtime artifact ${field} is invalid`,
    )
  }
  const value = Number.parseInt(text, 8)
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RuntimeArtifactError(
      'archive',
      `Runtime artifact ${field} is out of range`,
    )
  }
  return value
}

function isZeroBlock(block: Uint8Array): boolean {
  return (
    block.byteLength === TAR_BLOCK_BYTES && block.every((byte) => byte === 0)
  )
}
