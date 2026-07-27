/// <reference types="node" />

import { DecompressionStream as NodeDecompressionStream } from 'node:stream/web'
import { gzipSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { RuntimeLoader } from './RuntimeLoader'
import { WEB_V0_1_CAPABILITIES } from './runtimeManifest'
import { FixedWorker } from './worker/fixtures/FixedWorker'
import type { MainToWorkerMessage } from './worker/protocol'
import type { BrowserAdmissionEnvironment } from '../../platform/browser'

const payloadNames = [
  'LICENSE-RUNTIME.txt',
  'NOTICES.md',
  'lifearchive_runtime.d.ts',
  'lifearchive_runtime.js',
  'lifearchive_runtime_bg.wasm',
] as const

const ACCEPTED_BROWSER: BrowserAdmissionEnvironment = {
  engine: 'chromium',
  majorVersion: 151,
  deviceClass: 'desktop',
  storageMode: 'regular',
}

const NOT_INTEGRATED_LOCK = {
  manifestVersion: 1,
  runtimeVersion: null,
  artifactUrl: null,
  sha256: null,
  productContract: null,
  bindingsAbi: null,
  status: 'not-integrated',
} as const

beforeAll(() => {
  vi.stubGlobal('DecompressionStream', NodeDecompressionStream)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

async function sha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

async function fixture(
  change: {
    readonly manifest?: Record<string, unknown>
    readonly payload?: { readonly name: string; readonly bytes: Uint8Array }
    readonly preservePayloadHash?: boolean
  } = {},
) {
  const payloads = new Map<string, Uint8Array>(
    payloadNames.map((name, index) => [
      name,
      new Uint8Array([index, index + 1, index + 2]),
    ]),
  )
  const originalPayloads = new Map(payloads)
  if (change.payload) {
    payloads.set(change.payload.name, change.payload.bytes)
  }
  const filesForManifest =
    change.preservePayloadHash && change.payload ? originalPayloads : payloads
  const files = await Promise.all(
    [...filesForManifest].map(async ([path, bytes]) => ({
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
    ...change.manifest,
  }
  const artifact = makeRuntimeArtifact('0.1.0', payloads, manifest)
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

function makeRuntimeArtifact(
  runtimeVersion: string,
  payloads: ReadonlyMap<string, Uint8Array>,
  manifest: object,
): Uint8Array {
  const root = `lifearchive-runtime-web-${runtimeVersion}`
  const entries: {
    readonly path: string
    readonly bytes: Uint8Array | null
  }[] = [
    { path: `${root}/`, bytes: null },
    ...payloadNames.map((name) => ({
      path: `${root}/${name}`,
      bytes: payloads.get(name) ?? new Uint8Array(),
    })),
    {
      path: `${root}/runtime-manifest.json`,
      bytes: new TextEncoder().encode(`${JSON.stringify(manifest)}\n`),
    },
  ]
  const blocks: Uint8Array[] = []
  for (const entry of entries) {
    const bytes = entry.bytes ?? new Uint8Array()
    const header = new Uint8Array(512)
    writeText(header, 0, 100, entry.path)
    writeOctal(header, 100, 8, entry.bytes ? 0o644 : 0o755)
    writeOctal(header, 108, 8, 0)
    writeOctal(header, 116, 8, 0)
    writeOctal(header, 124, 12, bytes.byteLength)
    writeOctal(header, 136, 12, 0)
    header.fill(32, 148, 156)
    header[156] = entry.bytes ? 48 : 53
    writeText(header, 257, 6, 'ustar')
    writeText(header, 263, 2, '00')
    writeText(header, 265, 32, 'root')
    writeText(header, 297, 32, 'root')
    const checksum = header.reduce((total, byte) => total + byte, 0)
    const checksumText = checksum.toString(8).padStart(6, '0')
    writeText(header, 148, 6, checksumText)
    header[154] = 0
    header[155] = 32
    blocks.push(header)
    if (bytes.byteLength > 0) {
      const padded = new Uint8Array(Math.ceil(bytes.byteLength / 512) * 512)
      padded.set(bytes)
      blocks.push(padded)
    }
  }
  blocks.push(new Uint8Array(1024))
  const tarLength = blocks.reduce((total, block) => total + block.byteLength, 0)
  const tar = new Uint8Array(tarLength)
  let offset = 0
  for (const block of blocks) {
    tar.set(block, offset)
    offset += block.byteLength
  }
  return new Uint8Array(gzipSync(tar))
}

function writeText(
  target: Uint8Array,
  offset: number,
  length: number,
  value: string,
): void {
  const encoded = new TextEncoder().encode(value)
  if (encoded.byteLength > length) throw new Error('test tar path is too long')
  target.set(encoded, offset)
}

function writeOctal(
  target: Uint8Array,
  offset: number,
  length: number,
  value: number,
): void {
  const encoded = new TextEncoder().encode(
    `${value.toString(8).padStart(length - 1, '0')}\0`,
  )
  target.set(encoded, offset)
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
        envelope: {
          outcome: 'success',
          result: {
            productContractVersion: '5',
            capabilities: this.capabilities.map(({ name, version }) => ({
              id: name,
              version,
            })),
          },
        },
        transfers: [],
      })
    }
  }
}

function response(body: BodyInit | null, status = 200): Promise<Response> {
  return Promise.resolve(new Response(body, { status }))
}

function responseBytes(bytes: Uint8Array, status = 200): Promise<Response> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return response(copy.buffer, status)
}

async function loaderFor(
  change: {
    readonly lock?: object
    readonly manifest?: Record<string, unknown>
    readonly artifactResponse?: Response | Error
    readonly corruptPayload?: boolean
    readonly createWorker?: () => Worker
    readonly secure?: boolean
  } = {},
) {
  const fixed = await fixture({
    manifest: change.manifest,
    ...(change.corruptPayload
      ? {
          payload: {
            name: 'lifearchive_runtime.js',
            bytes: new TextEncoder().encode('substituted loader'),
          },
          preservePayloadHash: true,
        }
      : {}),
  })
  const lock = change.lock ?? fixed.lock
  const worker = new NegotiatingWorker(fixed.manifest.capabilities)
  const fetches: { readonly url: string; readonly cache?: RequestCache }[] = []
  const fetchImpl: typeof fetch = (input, init) => {
    const url = String(input)
    fetches.push({ url, cache: init?.cache })
    if (url === fixed.lock.artifactUrl) {
      if (change.artifactResponse instanceof Error) {
        return Promise.reject(change.artifactResponse)
      }
      return change.artifactResponse
        ? Promise.resolve(change.artifactResponse)
        : responseBytes(fixed.artifact)
    }
    return response(null, 404)
  }
  let objectUrlIndex = 0
  const objectUrls: string[] = []
  const revoked: string[] = []
  return {
    fixed,
    fetches,
    objectUrls,
    revoked,
    loader: new RuntimeLoader({
      lock,
      fetch: fetchImpl,
      isSecureContext: change.secure ?? true,
      installedBaseUrl: 'https://app.example/runtime/installed/',
      createObjectUrl: () => {
        const url = `blob:https://app.example/verified-${++objectUrlIndex}`
        objectUrls.push(url)
        return url
      },
      revokeObjectUrl: (url) => revoked.push(url),
      createWorker:
        change.createWorker === undefined
          ? () => worker.asWorker()
          : change.createWorker,
      browserEnvironment: ACCEPTED_BROWSER,
    }),
  }
}

describe('RuntimeLoader', () => {
  it('keeps an explicitly unintegrated runtime calm and network-free', async () => {
    let fetched = false
    const state = await new RuntimeLoader({
      lock: NOT_INTEGRATED_LOCK,
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

  it('loads a verified local receipt only through the development runtime gate', async () => {
    const fixed = await fixture()
    const worker = new NegotiatingWorker(fixed.manifest.capabilities)
    const baseUrl = 'https://app.example/runtime/installed/'
    const artifactFile = `lifearchive-runtime-web-${fixed.lock.runtimeVersion}.tar.gz`
    const fetched: { readonly url: string; readonly cache?: RequestCache }[] =
      []
    const fetchImpl: typeof fetch = (input, init) => {
      const url = new URL(String(input))
      fetched.push({ url: url.href, cache: init?.cache })
      if (url.href === `${baseUrl}local-runtime.json`) {
        return response(JSON.stringify({ lock: fixed.lock, artifactFile }))
      }
      if (url.pathname.endsWith(`/${artifactFile}`)) {
        return responseBytes(fixed.artifact)
      }
      return response(null, 404)
    }
    const objectUrls: string[] = []
    const revoked: string[] = []
    const state = await new RuntimeLoader({
      lock: NOT_INTEGRATED_LOCK,
      fetch: fetchImpl,
      installedBaseUrl: baseUrl,
      allowDevelopmentRuntime: true,
      isSecureContext: true,
      createWorker: () => worker.asWorker(),
      browserEnvironment: ACCEPTED_BROWSER,
      createObjectUrl: () => {
        const url = `blob:https://app.example/verified-${objectUrls.length + 1}`
        objectUrls.push(url)
        return url
      },
      revokeObjectUrl: (url) => revoked.push(url),
    }).load()

    expect(state).toMatchObject({ state: 'open' })
    expect(fetched[0]).toEqual({
      url: `${baseUrl}local-runtime.json`,
      cache: 'no-store',
    })
    expect(fetched).toHaveLength(2)
    expect(fetched[1]).toEqual({
      url: `${baseUrl}${artifactFile}?local-runtime=${fixed.lock.sha256}`,
      cache: 'no-store',
    })
    const start = worker.received.find((message) => message.type === 'start')
    expect(start).toMatchObject({
      runtime: {
        loaderUrl: objectUrls[0],
        wasmUrl: objectUrls[1],
      },
    })
    expect(revoked).toEqual(objectUrls)
  })

  it('reports unsupported and insecure environments before fetching', async () => {
    const { lock } = await fixture()
    const unsupported = await new RuntimeLoader({
      lock,
      isSecureContext: true,
      browserEnvironment: ACCEPTED_BROWSER,
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
      browserEnvironment: ACCEPTED_BROWSER,
    }).load()
    expect(insecure).toEqual({
      state: 'unavailable',
      reason: 'insecure-context',
    })
  })

  it.each([
    [
      { ...ACCEPTED_BROWSER, engine: 'webkit', majorVersion: 26 },
      'browser-engine-unsupported',
    ],
    [
      { ...ACCEPTED_BROWSER, engine: 'firefox', majorVersion: 152 },
      'browser-version-unsupported',
    ],
    [
      { ...ACCEPTED_BROWSER, deviceClass: 'mobile' },
      'browser-device-unsupported',
    ],
    [
      { ...ACCEPTED_BROWSER, storageMode: 'private' },
      'browser-storage-unsupported',
    ],
  ] as const)(
    'rejects a disallowed browser before runtime acquisition',
    async (browserEnvironment, reason) => {
      const fixed = await fixture()
      const fetchImpl = vi.fn<typeof fetch>()
      const createWorker = vi.fn<() => Worker>()
      const state = await new RuntimeLoader({
        lock: fixed.lock,
        fetch: fetchImpl,
        isSecureContext: true,
        createWorker,
        browserEnvironment,
      }).load()

      expect(state).toEqual({ state: 'incompatible', reason })
      expect(fetchImpl).not.toHaveBeenCalled()
      expect(createWorker).not.toHaveBeenCalled()
    },
  )

  it('does not reject a normal browser merely because private mode cannot be classified', async () => {
    const fixed = await fixture()
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 404 }))
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36',
    })
    try {
      await expect(
        new RuntimeLoader({
          lock: fixed.lock,
          fetch: fetchImpl,
          isSecureContext: true,
          createWorker: vi.fn<() => Worker>(),
        }).load(),
      ).resolves.toEqual({
        state: 'unavailable',
        reason: 'missing',
      })
      expect(fetchImpl).toHaveBeenCalledOnce()
    } finally {
      vi.unstubAllGlobals()
      vi.stubGlobal('DecompressionStream', NodeDecompressionStream)
    }
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

  it('rejects a malformed archive even when its whole digest matches the lock', async () => {
    const malformed = new Uint8Array([31, 139, 8, 0, 0, 0, 0, 0])
    const fixed = await fixture()
    const { loader } = await loaderFor({
      lock: {
        ...fixed.lock,
        sha256: await sha256(malformed),
      },
      artifactResponse: new Response(malformed),
    })
    await expect(loader.load()).resolves.toEqual({
      state: 'incompatible',
      reason: 'manifest-mismatch',
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

  it('reports missing gzip support before acquiring an artifact', async () => {
    const decompressionStream = globalThis.DecompressionStream
    vi.stubGlobal('DecompressionStream', undefined)
    try {
      const { loader, fetches } = await loaderFor()
      await expect(loader.load()).resolves.toEqual({
        state: 'incompatible',
        reason: 'environment-unsupported',
      })
      expect(fetches).toHaveLength(0)
    } finally {
      vi.stubGlobal('DecompressionStream', decompressionStream)
    }
  })

  it('rejects a payload that was substituted inside an otherwise pinned archive', async () => {
    const { loader, fetches } = await loaderFor({ corruptPayload: true })
    await expect(loader.load()).resolves.toEqual({
      state: 'incompatible',
      reason: 'checksum-mismatch',
    })
    await expect(loader.load()).resolves.toEqual({
      state: 'incompatible',
      reason: 'checksum-mismatch',
    })
    expect(fetches).toHaveLength(2)
  })

  it('reuses only a fully verified extraction with the same immutable identity', async () => {
    const first = await loaderFor()
    await expect(first.loader.load()).resolves.toMatchObject({ state: 'open' })
    expect(first.fetches).toHaveLength(1)
    await expect(first.loader.load()).resolves.toMatchObject({ state: 'open' })
    expect(first.fetches).toHaveLength(1)
    expect(first.objectUrls).toHaveLength(4)
    expect(first.revoked).toEqual(first.objectUrls)

    const substituted = await loaderFor({
      lock: {
        ...first.fixed.lock,
        sha256: '0'.repeat(64),
      },
    })
    await expect(substituted.loader.load()).resolves.toEqual({
      state: 'incompatible',
      reason: 'checksum-mismatch',
    })
    expect(substituted.fetches).toHaveLength(1)
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
    const { loader, fetches, objectUrls, revoked, fixed } = await loaderFor()
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
    expect(fetches).toEqual([
      {
        url: fixed.lock.artifactUrl,
        cache: 'no-store',
      },
    ])
    expect(objectUrls).toHaveLength(2)
    expect(revoked).toEqual(objectUrls)
  })
})
