import runtimeLockInput from '../../../runtime/runtime.lock.json'
import {
  admitBrowser,
  classifyBrowser,
  type BrowserAdmissionEnvironment,
  type BrowserAdmissionFailureReason,
} from '../../platform/browser'
import type { RuntimeFacts } from '../client'
import { RuntimeLifeArchiveClient } from './RuntimeLifeArchiveClient'
import {
  assertRuntimeCompatibility,
  parseRuntimeLock,
  type RuntimeManifest,
} from './runtimeManifest'
import { RuntimeFetchError, fetchVerifiedBytes } from './runtimeFetch'
import {
  RuntimeArtifactError,
  extractRuntimeArtifact,
  type ExtractedRuntimeArtifact,
  verifyExtractedRuntimeFiles,
} from './runtimeArtifact'
import type { RuntimeLoadState } from './runtimeState'
import { WorkerTransport } from './worker/WorkerTransport'

export interface RuntimeLoaderOptions {
  readonly lock?: unknown
  readonly fetch?: typeof fetch
  readonly isSecureContext?: boolean
  readonly createWorker?: (manifest: RuntimeManifest) => Worker
  readonly installedBaseUrl?: string
  readonly allowDevelopmentRuntime?: boolean
  readonly createObjectUrl?: (blob: Blob) => string
  readonly revokeObjectUrl?: (url: string) => void
  /**
   * Explicit browser facts for a qualified embedding or a deterministic test.
   * Production does not infer private/incognito state from unreliable quota
   * heuristics; an unclassified mode is not treated as evidence of privacy.
   */
  readonly browserEnvironment?: BrowserAdmissionEnvironment
}

export class RuntimeLoader {
  private readonly options: RuntimeLoaderOptions
  private state: RuntimeLoadState = { state: 'checking' }
  private verifiedArtifact: {
    readonly key: string
    readonly artifact: ExtractedRuntimeArtifact
  } | null = null

  constructor(options: RuntimeLoaderOptions = {}) {
    this.options = options
  }

  status(): RuntimeLoadState {
    return this.state
  }

  async load(): Promise<RuntimeLoadState> {
    this.state = { state: 'checking' }
    const fetchImpl = this.options.fetch ?? fetch
    const baseUrl =
      this.options.installedBaseUrl ??
      new URL('/runtime/installed/', globalThis.location?.href).href
    let lockInput: unknown = this.options.lock ?? runtimeLockInput
    let localArtifactUrl: string | null = null
    const allowDevelopmentRuntime =
      (import.meta.env.DEV || import.meta.env.MODE === 'test') &&
      (this.options.allowDevelopmentRuntime ??
        (!this.options.lock && !this.options.fetch))
    if (
      allowDevelopmentRuntime &&
      isRecord(lockInput) &&
      lockInput.status === 'not-integrated'
    ) {
      try {
        const local = await readDevelopmentRuntime(baseUrl, fetchImpl)
        if (local) {
          lockInput = local.lock
          localArtifactUrl = local.artifactUrl
        }
      } catch {
        return this.finish({
          state: 'incompatible',
          reason: 'manifest-mismatch',
        })
      }
    }
    const lock = parseRuntimeLock(lockInput)
    if (lock.status === 'not-integrated') {
      return this.finish({ state: 'unavailable', reason: 'not-integrated' })
    }
    const admission = admitBrowser(
      this.options.browserEnvironment ??
        classifyBrowser(
          typeof navigator === 'undefined' ? undefined : navigator,
        ),
    )
    if (!admission.admitted) {
      return this.finish({
        state: 'incompatible',
        reason: browserAdmissionReason(admission.reason),
      })
    }
    if (typeof Worker === 'undefined' && !this.options.createWorker) {
      return this.finish({
        state: 'unavailable',
        reason: 'worker-unsupported',
      })
    }
    const secure =
      this.options.isSecureContext ??
      (typeof isSecureContext === 'boolean' ? isSecureContext : false)
    if (!secure) {
      return this.finish({ state: 'unavailable', reason: 'insecure-context' })
    }
    if (typeof globalThis.DecompressionStream !== 'function') {
      return this.finish({
        state: 'incompatible',
        reason: 'environment-unsupported',
      })
    }

    const artifactUrl = localArtifactUrl ?? lock.artifactUrl
    const cacheKey = `${artifactUrl}\u0000${lock.sha256}`
    let extracted =
      this.verifiedArtifact?.key === cacheKey
        ? this.verifiedArtifact.artifact
        : undefined
    const cacheHit = extracted !== undefined
    if (!extracted) {
      let artifact: Uint8Array
      try {
        artifact = await fetchVerifiedBytes(artifactUrl, lock.sha256, fetchImpl)
      } catch (error) {
        if (error instanceof RuntimeFetchError) {
          if (error.kind === 'checksum') {
            return this.finish({
              state: 'incompatible',
              reason: 'checksum-mismatch',
            })
          }
          return this.finish({
            state: 'unavailable',
            reason: error.kind === 'missing' ? 'missing' : 'download-failed',
          })
        }
        return this.finish({ state: 'unavailable', reason: 'download-failed' })
      }

      try {
        extracted = await extractRuntimeArtifact(artifact, lock.runtimeVersion)
      } catch (error) {
        return this.finish({
          state: 'incompatible',
          reason:
            error instanceof RuntimeArtifactError && error.kind === 'checksum'
              ? 'checksum-mismatch'
              : 'manifest-mismatch',
        })
      }
    }

    let manifest: RuntimeManifest
    try {
      manifest = assertRuntimeCompatibility(extracted.manifestInput, lock)
    } catch (error) {
      return this.finish({
        state: 'incompatible',
        reason: compatibilityReason(error, extracted.manifestInput, lock),
      })
    }
    if (!supportsEnvironment(manifest, Boolean(this.options.createWorker))) {
      return this.finish({
        state: 'incompatible',
        reason: 'environment-unsupported',
      })
    }

    if (!cacheHit) {
      try {
        await verifyExtractedRuntimeFiles(manifest, extracted.files)
      } catch (error) {
        if (
          error instanceof RuntimeArtifactError &&
          error.kind === 'checksum'
        ) {
          return this.finish({
            state: 'incompatible',
            reason: 'checksum-mismatch',
          })
        }
        return this.finish({
          state: 'incompatible',
          reason: 'manifest-mismatch',
        })
      }
      // Only this loader instance may reuse bytes it fetched and verified.
      // Replacing the single entry also prevents stale runtime retention after
      // an immutable pin changes in a long-lived page.
      this.verifiedArtifact = { key: cacheKey, artifact: extracted }
    }

    const createObjectUrl =
      this.options.createObjectUrl ??
      globalThis.URL?.createObjectURL?.bind(globalThis.URL)
    const revokeObjectUrl =
      this.options.revokeObjectUrl ??
      globalThis.URL?.revokeObjectURL?.bind(globalThis.URL)
    if (!createObjectUrl || !revokeObjectUrl) {
      return this.finish({
        state: 'incompatible',
        reason: 'environment-unsupported',
      })
    }
    const loaderBytes = extracted.files.get(manifest.modules.loader)
    const wasmBytes = extracted.files.get(manifest.modules.wasm)
    if (!loaderBytes || !wasmBytes) {
      return this.finish({
        state: 'incompatible',
        reason: 'manifest-mismatch',
      })
    }
    const loaderUrl = createObjectUrl(
      new Blob([copyBuffer(loaderBytes)], { type: 'text/javascript' }),
    )
    const wasmUrl = createObjectUrl(
      new Blob([copyBuffer(wasmBytes)], { type: 'application/wasm' }),
    )
    let urlsRevoked = false
    const revokeRuntimeUrls = () => {
      if (urlsRevoked) return
      urlsRevoked = true
      revokeObjectUrl(loaderUrl)
      revokeObjectUrl(wasmUrl)
    }
    try {
      const createWorker =
        this.options.createWorker ??
        (() =>
          new Worker(new URL('./worker/runtime.worker.ts', import.meta.url), {
            type: 'module',
          }))
      const transport = new WorkerTransport({
        createWorker: () => createWorker(manifest),
        runtime: {
          loaderUrl,
          wasmUrl,
          productContract: manifest.productContract,
          bindingsAbi: manifest.bindingsAbi,
        },
      })
      await transport.start()
      // Startup awaits loader import and Wasm instantiation in the worker.
      // Revoking now prevents later code or caches from reselecting a stable
      // production URL while leaving the instantiated module usable.
      revokeRuntimeUrls()
      const negotiation = await transport.request({
        operation: 'product.describe',
        payload: {
          minimumContractVersion: manifest.productContract,
          maximumContractVersion: manifest.productContract,
          requiredCapabilities: manifest.capabilities.map(({ name }) => name),
        },
      })
      const negotiationFailure = validateNegotiation(negotiation, manifest)
      if (negotiationFailure) {
        await transport.close()
        return this.finish({
          state: 'incompatible',
          reason: negotiationFailure,
        })
      }
      const runtime: RuntimeFacts = {
        mode: 'runtime',
        runtimeVersion: manifest.runtimeVersion,
        buildId: manifest.buildId,
        productContract: manifest.productContract,
        browserAbi: manifest.bindingsAbi,
        backend: manifest.persistence.backend,
        durability: manifest.persistence.durable ? 'durable' : 'unproven',
      }
      return this.finish({
        state: 'open',
        client: new RuntimeLifeArchiveClient({
          transport,
          runtime,
          requiredCapabilities: manifest.capabilities.map(({ name }) => name),
        }),
      })
    } catch {
      revokeRuntimeUrls()
      return this.finish({
        state: 'unavailable',
        reason: 'worker-instantiate-failed',
      })
    }
  }

  private finish(state: RuntimeLoadState): RuntimeLoadState {
    this.state = state
    return state
  }
}

function copyBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function supportsEnvironment(
  manifest: RuntimeManifest,
  hasInjectedWorker: boolean,
): boolean {
  const webAssembly = globalThis.WebAssembly as typeof WebAssembly & {
    readonly Suspending?: unknown
  }
  const available: Readonly<Record<string, boolean>> = {
    'cross-origin-isolated': globalThis.crossOriginIsolated === true,
    jspi: typeof webAssembly.Suspending === 'function',
    opfs:
      typeof navigator !== 'undefined' &&
      typeof navigator.storage?.getDirectory === 'function',
    'web-locks':
      typeof navigator !== 'undefined' &&
      typeof navigator.locks?.request === 'function',
    webassembly: typeof globalThis.WebAssembly === 'object',
    worker: hasInjectedWorker || typeof globalThis.Worker === 'function',
  }
  return manifest.requiredEnvironment.features.every(
    (feature) => available[feature] === true,
  )
}

async function readDevelopmentRuntime(
  baseUrl: string,
  fetchImpl: typeof fetch,
): Promise<{
  readonly lock: unknown
  readonly artifactUrl: string
} | null> {
  const response = await fetchImpl(
    new URL('local-runtime.json', baseUrl).href,
    { cache: 'no-store' },
  )
  if (response.status === 404) return null
  if (!response.ok) throw new Error('development runtime receipt unavailable')
  const receipt = (await response.json()) as unknown
  if (
    !isRecord(receipt) ||
    !isRecord(receipt.lock) ||
    typeof receipt.lock.sha256 !== 'string' ||
    typeof receipt.artifactFile !== 'string' ||
    receipt.artifactFile !==
      `lifearchive-runtime-web-${String(receipt.lock.runtimeVersion)}.tar.gz`
  ) {
    throw new Error('development runtime receipt is invalid')
  }
  return {
    lock: receipt.lock,
    artifactUrl: installedRuntimeUrl(
      receipt.artifactFile,
      baseUrl,
      receipt.lock.sha256,
    ),
  }
}

function installedRuntimeUrl(
  path: string,
  baseUrl: string,
  developmentRevision: string | null,
): string {
  const url = new URL(path, baseUrl)
  if (developmentRevision) {
    url.searchParams.set('local-runtime', developmentRevision)
  }
  return url.href
}

function validateNegotiation(
  input: unknown,
  manifest: RuntimeManifest,
):
  | 'contract-mismatch'
  | 'capability-inventory-mismatch'
  | 'manifest-mismatch'
  | null {
  const envelope =
    isRecord(input) && 'envelope' in input ? input.envelope : input
  if (!isRecord(envelope)) return 'manifest-mismatch'
  if (envelope.outcome === 'failure') return 'capability-inventory-mismatch'
  if (envelope.outcome !== 'success' || !isRecord(envelope.result)) {
    return 'manifest-mismatch'
  }
  if (envelope.result.productContractVersion !== manifest.productContract) {
    return 'contract-mismatch'
  }
  if (!Array.isArray(envelope.result.capabilities)) {
    return 'capability-inventory-mismatch'
  }
  const expected = manifest.capabilities.map(
    ({ name, version }) => `${name}@${version}`,
  )
  const actual = envelope.result.capabilities.map((capability) =>
    isRecord(capability)
      ? `${String(capability.id)}@${String(capability.version)}`
      : '',
  )
  return expected.every((value, index) => actual[index] === value) &&
    actual.length === expected.length
    ? null
    : 'capability-inventory-mismatch'
}

function compatibilityReason(
  error: unknown,
  manifest: unknown,
  lock: {
    readonly runtimeVersion: string
    readonly productContract: string
    readonly bindingsAbi: string
  },
): Extract<RuntimeLoadState, { state: 'incompatible' }>['reason'] {
  if (isRecord(manifest)) {
    if (manifest.productContract !== lock.productContract) {
      return 'contract-mismatch'
    }
    if (manifest.bindingsAbi !== lock.bindingsAbi) {
      return 'abi-mismatch'
    }
    if (manifest.runtimeVersion !== lock.runtimeVersion) {
      return 'manifest-mismatch'
    }
    if (Array.isArray(manifest.capabilities)) {
      return 'capability-inventory-mismatch'
    }
  }
  const message = error instanceof Error ? error.message : ''
  if (/capabilit/i.test(message)) return 'capability-inventory-mismatch'
  if (/contract/i.test(message)) return 'contract-mismatch'
  if (/abi/i.test(message)) return 'abi-mismatch'
  return 'manifest-mismatch'
}

function browserAdmissionReason(
  reason: BrowserAdmissionFailureReason,
):
  | 'browser-engine-unsupported'
  | 'browser-version-unsupported'
  | 'browser-device-unsupported'
  | 'browser-storage-unsupported' {
  switch (reason) {
    case 'engine-unsupported':
      return 'browser-engine-unsupported'
    case 'version-unavailable':
    case 'version-too-old':
      return 'browser-version-unsupported'
    case 'device-unsupported':
      return 'browser-device-unsupported'
    case 'storage-private':
      return 'browser-storage-unsupported'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
