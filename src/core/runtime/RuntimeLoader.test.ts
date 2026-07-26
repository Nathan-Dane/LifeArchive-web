import { describe, expect, it } from 'vitest'
import { RuntimeLoader } from './RuntimeLoader'
import { WEB_V0_1_CAPABILITIES } from './runtimeManifest'
import { FixedWorker } from './worker/fixtures/FixedWorker'
import type { MainToWorkerMessage } from './worker/protocol'

const payloadNames = [
  'LICENSE-RUNTIME.txt',
  'NOTICES.md',
  'lifearchive_runtime.d.ts',
  'lifearchive_runtime.js',
  'lifearchive_runtime_bg.wasm',
] as const

async function sha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

async function fixture() {
  const artifact = new TextEncoder().encode('fixed runtime archive')
  const payloads = new Map<string, Uint8Array>(
    payloadNames.map((name, index) => [
      name,
      new Uint8Array([index, index + 1, index + 2]),
    ]),
  )
  const files = await Promise.all(
    [...payloads].map(async ([path, bytes]) => ({
      path,
      sha256: await sha256(bytes),
    })),
  )
  const manifest = {
    manifestVersion: 1,
    runtimeVersion: '0.1.0',
    buildId: 'fixed-runtime-build',
    productContract: '5',
    bindingsAbi: '1',
    dependencyVersions: {
      domain: '4',
      timeNavigation: '1',
      durableMedia: '1',
      archiveApplication: '5',
      applicationQuery: '4',
      providerNeutralAI: '3',
      archiveOverviewExport: '5',
      store: '5',
      rootLayout: '1',
      sqliteSchema: '7',
      archiveFormat: '0.4.1',
    },
    capabilities: WEB_V0_1_CAPABILITIES.map(([name, version]) => ({
      name,
      version,
    })),
    modules: {
      loader: 'lifearchive_runtime.js',
      wasm: 'lifearchive_runtime_bg.wasm',
      types: 'lifearchive_runtime.d.ts',
    },
    files,
    persistence: { backend: 'opfs-sqlite', durable: true },
    requiredEnvironment: {
      executionContext: 'dedicated-worker',
      secureContext: true,
      features: ['webassembly', 'worker'],
    },
    licence: {
      id: 'proprietary',
      licencePath: 'LICENSE-RUNTIME.txt',
      noticesPath: 'NOTICES.md',
    },
  }
  const lock = {
    manifestVersion: 1,
    runtimeVersion: '0.1.0',
    artifactUrl:
      'https://releases.example/lifearchive-runtime-web-0.1.0.tar.gz',
    sha256: await sha256(artifact),
    productContract: '5',
    bindingsAbi: '1',
    status: 'pinned',
  }
  return { artifact, lock, manifest, payloads }
}

class NegotiatingWorker extends FixedWorker {
  private readonly capabilities: readonly {
    readonly name: string
    readonly version: string
  }[]

  constructor(
    capabilities: readonly {
      readonly name: string
      readonly version: string
    }[],
  ) {
    super()
    this.capabilities = capabilities
  }

  override postMessage(
    message: MainToWorkerMessage,
    transfer: Transferable[] = [],
  ): void {
    super.postMessage(message, transfer)
    if (
      message.type === 'request' &&
      message.operation === 'product.describe'
    ) {
      this.respond(message.generation, message.requestId, {
        outcome: 'success',
        result: {
          productContractVersion: '5',
          capabilities: this.capabilities.map(({ name, version }) => ({
            id: name,
            version,
          })),
        },
      })
    }
  }
}

function response(body: BodyInit | null, status = 200): Promise<Response> {
  return Promise.resolve(new Response(body, { status }))
}

async function loaderFor(
  change: {
    readonly lock?: object
    readonly manifest?: object
    readonly artifactResponse?: Response | Error
    readonly fileBytes?: BodyInit
    readonly createWorker?: () => Worker
    readonly secure?: boolean
  } = {},
) {
  const fixed = await fixture()
  const lock = change.lock ?? fixed.lock
  const manifest = change.manifest ?? fixed.manifest
  const worker = new NegotiatingWorker(fixed.manifest.capabilities)
  const fetchImpl: typeof fetch = (input) => {
    const url = String(input)
    if (url === fixed.lock.artifactUrl) {
      if (change.artifactResponse instanceof Error) {
        return Promise.reject(change.artifactResponse)
      }
      return change.artifactResponse
        ? Promise.resolve(change.artifactResponse)
        : response(fixed.artifact)
    }
    if (url.endsWith('runtime-manifest.json')) {
      return response(JSON.stringify(manifest))
    }
    const name = url.split('/').at(-1) ?? ''
    const payload = fixed.payloads.get(name)
    return change.fileBytes !== undefined
      ? response(change.fileBytes)
      : response(payload ? new Uint8Array(payload).buffer : null)
  }
  return {
    fixed,
    loader: new RuntimeLoader({
      lock,
      fetch: fetchImpl,
      isSecureContext: change.secure ?? true,
      installedBaseUrl: 'https://app.example/runtime/installed/',
      createWorker:
        change.createWorker === undefined
          ? () => worker.asWorker()
          : change.createWorker,
    }),
  }
}

describe('RuntimeLoader', () => {
  it('keeps the checked-in no-runtime build calm and network-free', async () => {
    let fetched = false
    const state = await new RuntimeLoader({
      fetch: () => {
        fetched = true
        return Promise.reject(new Error('must not fetch'))
      },
    }).load()
    expect(state).toEqual({
      state: 'unavailable',
      reason: 'not-integrated',
    })
    expect(fetched).toBe(false)
  })

  it('reports unsupported and insecure environments before fetching', async () => {
    const { lock } = await fixture()
    const unsupported = await new RuntimeLoader({
      lock,
      isSecureContext: true,
    }).load()
    expect(unsupported).toEqual({
      state: 'unavailable',
      reason: 'worker-unsupported',
    })

    const insecure = await new RuntimeLoader({
      lock,
      isSecureContext: false,
      createWorker: () => {
        throw new Error('must not instantiate')
      },
    }).load()
    expect(insecure).toEqual({
      state: 'unavailable',
      reason: 'insecure-context',
    })
  })

  it.each([
    [new Response(null, { status: 404 }), 'missing'],
    [new Response(null, { status: 503 }), 'download-failed'],
    [new Error('CORS'), 'download-failed'],
  ] as const)('maps artifact fetch failure to %s', async (reply, reason) => {
    const { loader } = await loaderFor({ artifactResponse: reply })
    await expect(loader.load()).resolves.toEqual({
      state: 'unavailable',
      reason,
    })
  })

  it('rejects a changed artifact byte before reading the manifest', async () => {
    const { loader } = await loaderFor({
      artifactResponse: new Response('changed'),
    })
    await expect(loader.load()).resolves.toEqual({
      state: 'incompatible',
      reason: 'checksum-mismatch',
    })
  })

  it.each([
    ['runtimeVersion', '0.2.0', 'manifest-mismatch'],
    ['productContract', '6', 'contract-mismatch'],
    ['bindingsAbi', '2', 'abi-mismatch'],
  ] as const)(
    'rejects a mismatched %s',
    async (field, value, expectedReason) => {
      const fixed = await fixture()
      const { loader } = await loaderFor({
        manifest: { ...fixed.manifest, [field]: value },
      })
      await expect(loader.load()).resolves.toEqual({
        state: 'incompatible',
        reason: expectedReason,
      })
    },
  )

  it('rejects a missing capability and an unsupported environment feature', async () => {
    const fixed = await fixture()
    const missingCapability = await loaderFor({
      manifest: {
        ...fixed.manifest,
        capabilities: fixed.manifest.capabilities.slice(0, -1),
      },
    })
    await expect(missingCapability.loader.load()).resolves.toEqual({
      state: 'incompatible',
      reason: 'capability-inventory-mismatch',
    })

    const unsupportedEnvironment = await loaderFor({
      manifest: {
        ...fixed.manifest,
        requiredEnvironment: {
          ...fixed.manifest.requiredEnvironment,
          features: ['shared-memory', 'webassembly', 'worker'],
        },
      },
    })
    await expect(unsupportedEnvironment.loader.load()).resolves.toEqual({
      state: 'incompatible',
      reason: 'environment-unsupported',
    })
  })

  it('rejects a changed installed payload before worker instantiation', async () => {
    const { loader } = await loaderFor({
      fileBytes: 'changed',
    })
    await expect(loader.load()).resolves.toEqual({
      state: 'incompatible',
      reason: 'checksum-mismatch',
    })
  })

  it('reports worker instantiation failure explicitly', async () => {
    const { loader } = await loaderFor({
      createWorker: () => {
        throw new Error('blocked by CSP')
      },
    })
    await expect(loader.load()).resolves.toEqual({
      state: 'unavailable',
      reason: 'worker-instantiate-failed',
    })
  })

  it('opens one verified compatible runtime as an ergonomic client', async () => {
    const { loader } = await loaderFor()
    const state = await loader.load()
    expect(state.state).toBe('open')
    if (state.state === 'open') {
      expect(state.client.runtime.status()).toMatchObject({
        state: 'available',
        runtime: {
          mode: 'runtime',
          runtimeVersion: '0.1.0',
          browserAbi: '1',
          durability: 'durable',
        },
      })
      expect('request' in state.client).toBe(false)
    }
  })
})
