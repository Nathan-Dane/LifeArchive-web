import { verifyArtifactSha256 } from './runtimeCompatibility'

export class RuntimeFetchError extends Error {
  readonly kind: 'missing' | 'download' | 'checksum'

  constructor(kind: RuntimeFetchError['kind'], message: string) {
    super(message)
    this.name = 'RuntimeFetchError'
    this.kind = kind
  }
}

export async function fetchBytes(
  url: string,
  fetchImpl: typeof fetch,
): Promise<Uint8Array> {
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
    })
  } catch {
    throw new RuntimeFetchError('download', 'Runtime download failed')
  }
  if (response.status === 404) {
    throw new RuntimeFetchError('missing', 'Runtime artifact is missing')
  }
  if (!response.ok) {
    throw new RuntimeFetchError(
      'download',
      `Runtime download returned HTTP ${response.status}`,
    )
  }
  return new Uint8Array(await response.arrayBuffer())
}

export async function fetchVerifiedBytes(
  url: string,
  expectedSha256: string,
  fetchImpl: typeof fetch,
): Promise<Uint8Array> {
  const bytes = await fetchBytes(url, fetchImpl)
  try {
    await verifyArtifactSha256(bytes, expectedSha256)
  } catch {
    throw new RuntimeFetchError('checksum', 'Runtime checksum mismatch')
  }
  return bytes
}
