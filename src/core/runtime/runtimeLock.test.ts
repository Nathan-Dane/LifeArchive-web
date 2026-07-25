import { describe, expect, it } from 'vitest'
import runtimeLock from '../../../runtime/runtime.lock.json'
import {
  WEB_V0_1_CAPABILITIES,
  assertRuntimeCompatibility,
  parseRuntimeLock,
  verifyArtifactSha256,
} from './runtimeCompatibility'

/**
 * The lock file is the single source of truth for which runtime this checkout
 * expects. Until a real release is pinned it must say so explicitly, so that
 * nothing in the public repository can present an available runtime.
 */
const payloads = [
  ['LICENSE-RUNTIME.txt', 'a'.repeat(64)],
  ['NOTICES.md', 'b'.repeat(64)],
  ['lifearchive_runtime.d.ts', 'c'.repeat(64)],
  ['lifearchive_runtime.js', 'd'.repeat(64)],
  ['lifearchive_runtime_bg.wasm', 'e'.repeat(64)],
] as const

const pinnedLock = {
  manifestVersion: 1,
  runtimeVersion: '0.1.0',
  artifactUrl:
    'https://releases.lifearchive.app/runtime/lifearchive-runtime-web-0.1.0.tar.gz',
  sha256: 'f'.repeat(64),
  productContract: '5',
  bindingsAbi: '1',
  status: 'pinned',
} as const

const manifest = {
  manifestVersion: 1,
  runtimeVersion: '0.1.0',
  buildId: 'web-runtime-0.1.0-001',
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
  files: payloads.map(([path, hash]) => ({ path, sha256: hash })),
  persistence: {
    backend: 'unproven',
    durable: false,
  },
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

describe('runtime state', () => {
  it('has a well-formed lock file', () => {
    expect(() => parseRuntimeLock(runtimeLock)).not.toThrow()
  })

  it('reports the runtime as not integrated', () => {
    expect(runtimeLock.status).toBe('not-integrated')
  })

  it('pins no runtime artifact', () => {
    expect(runtimeLock.runtimeVersion).toBeNull()
    expect(runtimeLock.artifactUrl).toBeNull()
    expect(runtimeLock.sha256).toBeNull()
  })

  it('exposes no loaded runtime to the bootstrap shell', () => {
    expect(
      (globalThis as { lifeArchiveRuntime?: unknown }).lifeArchiveRuntime,
    ).toBeUndefined()
  })

  it('accepts only an exact immutable pin and matching manifest', () => {
    expect(assertRuntimeCompatibility(manifest, pinnedLock)).toEqual(manifest)

    expect(() =>
      assertRuntimeCompatibility({ ...manifest, bindingsAbi: '2' }, pinnedLock),
    ).toThrow()
    expect(() =>
      parseRuntimeLock({
        ...pinnedLock,
        artifactUrl: 'https://releases.lifearchive.app/runtime/latest.tar.gz',
      }),
    ).toThrow()
  })

  it('rejects duplicate capabilities even when the list length is unchanged', () => {
    const capabilities = [...manifest.capabilities]
    capabilities[1] = capabilities[0]
    expect(() =>
      assertRuntimeCompatibility({ ...manifest, capabilities }, pinnedLock),
    ).toThrow()
  })

  it('rejects missing licence files and private commit identities', () => {
    expect(() =>
      assertRuntimeCompatibility(
        {
          ...manifest,
          files: manifest.files.filter(
            ({ path }) => path !== 'LICENSE-RUNTIME.txt',
          ),
        },
        pinnedLock,
      ),
    ).toThrow()
    expect(() =>
      assertRuntimeCompatibility(
        { ...manifest, buildId: 'a'.repeat(40) },
        pinnedLock,
      ),
    ).toThrow()
    expect(() =>
      assertRuntimeCompatibility(
        {
          ...manifest,
          dependencyVersions: {
            ...manifest.dependencyVersions,
            domain: '5',
          },
        },
        pinnedLock,
      ),
    ).toThrow()
  })

  it('fails checksum verification when any artifact byte changes', async () => {
    const original = new TextEncoder().encode('runtime bundle')
    await expect(
      verifyArtifactSha256(
        original,
        '71aca99c0cb697662398e9688d64485c18c5cf3fcf79449adf8e7d9ec2b41891',
      ),
    ).resolves.toBeUndefined()

    const changed = new TextEncoder().encode('runtime bundle!')
    await expect(
      verifyArtifactSha256(
        changed,
        '71aca99c0cb697662398e9688d64485c18c5cf3fcf79449adf8e7d9ec2b41891',
      ),
    ).rejects.toThrow('checksum mismatch')
  })
})
