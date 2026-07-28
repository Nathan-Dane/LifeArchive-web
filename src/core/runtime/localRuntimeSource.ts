import type { RuntimeLock } from './runtimeManifest'

/**
 * Production artifact inspection searches for this marker. This entire module
 * must remain behind the development-only dynamic import in RuntimeLoader.
 */
export const LOCAL_RUNTIME_SOURCE_MARKER = 'lifearchive:local-runtime-source:v1'

export type LocalRuntimeSourceResult =
  | {
      readonly state: 'ready'
      readonly lock: RuntimeLock
      readonly artifactUrl: string
    }
  | { readonly state: 'missing' }
  | { readonly state: 'invalid' }

export async function loadLocalRuntimeSource(
  baseUrl: string,
  fetchImpl: typeof fetch,
): Promise<LocalRuntimeSourceResult> {
  let response: Response
  try {
    response = await fetchImpl(new URL('local-runtime.json', baseUrl).href, {
      cache: 'no-store',
    })
  } catch {
    return { state: 'missing' }
  }
  if (response.status === 404) return { state: 'missing' }
  if (!response.ok) return { state: 'missing' }

  let receipt: unknown
  try {
    receipt = (await response.json()) as unknown
  } catch {
    return { state: 'invalid' }
  }
  if (
    !isRecord(receipt) ||
    receipt.receiptVersion !== 1 ||
    receipt.source !== LOCAL_RUNTIME_SOURCE_MARKER ||
    !isRecord(receipt.lock) ||
    receipt.lock.status !== 'pinned' ||
    typeof receipt.lock.runtimeVersion !== 'string' ||
    typeof receipt.lock.sha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(receipt.lock.sha256) ||
    typeof receipt.artifactFile !== 'string' ||
    receipt.artifactFile !==
      `lifearchive-runtime-web-${receipt.lock.runtimeVersion}.tar.gz`
  ) {
    return { state: 'invalid' }
  }

  const artifactUrl = new URL(receipt.artifactFile, baseUrl)
  artifactUrl.searchParams.set('local-runtime', receipt.lock.sha256)
  return {
    state: 'ready',
    lock: receipt.lock as RuntimeLock,
    artifactUrl: artifactUrl.href,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
