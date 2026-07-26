import runtimeLockInput from '../../../runtime/runtime.lock.json'
import type { RuntimeFacts } from '../client'
import { RuntimeLifeArchiveClient } from './RuntimeLifeArchiveClient'
import {
  assertRuntimeCompatibility,
  parseRuntimeLock,
  type RuntimeManifest,
} from './runtimeManifest'
import {
  RuntimeFetchError,
  fetchBytes,
  fetchVerifiedBytes,
} from './runtimeFetch'
import type { RuntimeLoadState } from './runtimeState'
import { WorkerTransport } from './worker/WorkerTransport'

export interface RuntimeLoaderOptions {
  readonly lock?: unknown
  readonly fetch?: typeof fetch
  readonly isSecureContext?: boolean
  readonly createWorker?: (manifest: RuntimeManifest) => Worker
  readonly installedBaseUrl?: string
}

export class RuntimeLoader {
  private readonly options: RuntimeLoaderOptions
  private state: RuntimeLoadState = { state: 'checking' }

  constructor(options: RuntimeLoaderOptions = {}) {
    this.options = options
  }

  status(): RuntimeLoadState {
    return this.state
  }

  async load(): Promise<RuntimeLoadState> {
    this.state = { state: 'checking' }
    const lock = parseRuntimeLock(this.options.lock ?? runtimeLockInput)
    if (lock.status === 'not-integrated') {
      return this.finish({ state: 'unavailable', reason: 'not-integrated' })
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

    const fetchImpl = this.options.fetch ?? fetch
    try {
      await fetchVerifiedBytes(lock.artifactUrl, lock.sha256, fetchImpl)
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

    const baseUrl =
      this.options.installedBaseUrl ??
      new URL('/runtime/installed/', globalThis.location?.href).href
    let manifestInput: unknown
    try {
      const bytes = await fetchBytes(
        new URL('runtime-manifest.json', baseUrl).href,
        fetchImpl,
      )
      manifestInput = JSON.parse(new TextDecoder().decode(bytes))
    } catch {
      return this.finish({ state: 'unavailable', reason: 'missing' })
    }

    let manifest: RuntimeManifest
    try {
      manifest = assertRuntimeCompatibility(manifestInput, lock)
    } catch (error) {
      return this.finish({
        state: 'incompatible',
        reason: compatibilityReason(error, manifestInput, lock),
      })
    }
    if (!supportsEnvironment(manifest)) {
      return this.finish({
        state: 'incompatible',
        reason: 'environment-unsupported',
      })
    }

    try {
      await Promise.all(
        manifest.files.map(({ path, sha256 }) =>
          fetchVerifiedBytes(new URL(path, baseUrl).href, sha256, fetchImpl),
        ),
      )
    } catch (error) {
      if (error instanceof RuntimeFetchError && error.kind === 'checksum') {
        return this.finish({
          state: 'incompatible',
          reason: 'checksum-mismatch',
        })
      }
      return this.finish({ state: 'unavailable', reason: 'missing' })
    }

    try {
      const createWorker =
        this.options.createWorker ??
        (() => {
          const workerUrl = new URL(
            './worker/runtime.worker.ts',
            import.meta.url,
          )
          workerUrl.searchParams.set(
            'loader',
            new URL(manifest.modules.loader, baseUrl).href,
          )
          workerUrl.searchParams.set(
            'wasm',
            new URL(manifest.modules.wasm, baseUrl).href,
          )
          workerUrl.searchParams.set('contract', manifest.productContract)
          workerUrl.searchParams.set('abi', manifest.bindingsAbi)
          return new Worker(workerUrl, { type: 'module' })
        })
      const transport = new WorkerTransport({
        createWorker: () => createWorker(manifest),
      })
      await transport.start()
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

function supportsEnvironment(manifest: RuntimeManifest): boolean {
  const supported = new Set(['webassembly', 'worker'])
  return manifest.requiredEnvironment.features.every((feature) =>
    supported.has(feature),
  )
}

function validateNegotiation(
  input: unknown,
  manifest: RuntimeManifest,
):
  | 'contract-mismatch'
  | 'capability-inventory-mismatch'
  | 'manifest-mismatch'
  | null {
  if (!isRecord(input)) return 'manifest-mismatch'
  if (input.outcome === 'failure') return 'capability-inventory-mismatch'
  if (input.outcome !== 'success' || !isRecord(input.result)) {
    return 'manifest-mismatch'
  }
  if (input.result.productContractVersion !== manifest.productContract) {
    return 'contract-mismatch'
  }
  if (!Array.isArray(input.result.capabilities)) {
    return 'capability-inventory-mismatch'
  }
  const expected = manifest.capabilities.map(
    ({ name, version }) => `${name}@${version}`,
  )
  const actual = input.result.capabilities.map((capability) =>
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
