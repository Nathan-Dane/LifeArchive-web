import { describe, expect, it } from 'vitest'
import runtimeLock from '../../../runtime/runtime.lock.json'
import {
  WEB_V0_1_CAPABILITIES,
  assertRuntimeCompatibility,
  parseRuntimeLock,
  verifyArtifactSha256,
} from './runtimeCompatibility'
import { runtimeBoundary } from './runtimeBoundary'

/** The lock file is the single source of truth for this checkout's runtime. */
const payloads = [
  ['LICENSE-RUNTIME.txt', 'a'.repeat(64)],
  ['NOTICES.md', 'b'.repeat(64)],
  ['lifearchive_runtime.d.ts', 'c'.repeat(64)],
  ['lifearchive_runtime.js', 'd'.repeat(64)],
  ['lifearchive_runtime_bg.wasm', 'e'.repeat(64)],
] as const

const pinnedLock = {
  manifestVersion: 1,
  runtimeVersion: '0.1.3',
  artifactUrl:
    'https://releases.lifearchive.app/runtime/lifearchive-runtime-web-0.1.3.tar.gz',
  sha256: 'f'.repeat(64),
  productContract: '11',
  bindingsAbi: '1',
  status: 'pinned',
} as const

const manifest = {
  manifestVersion: 1,
  runtimeVersion: '0.1.3',
  buildId: 'web-runtime-0.1.3-001',
  productContract: '11',
  bindingsAbi: '1',
  dependencyVersions: {
    domain: '8',
    timeNavigation: '1',
    durableMedia: '2',
    archiveApplication: '9',
    applicationQuery: '8',
    providerNeutralAI: '3',
    archiveOverviewExport: '10',
    store: '10',
    rootLayout: '1',
    sqliteSchema: '15',
    archiveFormat: '0.8.0',
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

  it('does not retain the obsolete Product 5 production pin', () => {
    expect(runtimeLock).toEqual({
      manifestVersion: 1,
      runtimeVersion: null,
      artifactUrl: null,
      sha256: null,
      productContract: null,
      bindingsAbi: null,
      status: 'not-integrated',
    })
  })

  it('requires every future production pin to use an exact immutable artifact URL', () => {
    expect(() => parseRuntimeLock(pinnedLock)).not.toThrow()
    expect(pinnedLock.artifactUrl).not.toMatch(/(?:latest|redirect)/)
    expect(new URL(pinnedLock.artifactUrl).pathname).toBe(
      '/runtime/lifearchive-runtime-web-0.1.3.tar.gz',
    )
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

  it('admits only the reviewed current dependency profile', () => {
    expect(assertRuntimeCompatibility(manifest, pinnedLock)).toEqual(manifest)
    expect(() =>
      assertRuntimeCompatibility(
        {
          ...manifest,
          runtimeVersion: '0.1.2',
        },
        {
          ...pinnedLock,
          runtimeVersion: '0.1.2',
          artifactUrl:
            'https://releases.lifearchive.app/runtime/lifearchive-runtime-web-0.1.2.tar.gz',
        },
      ),
    ).toThrow()
  })

  it('rejects duplicate capabilities even when the list length is unchanged', () => {
    const capabilities = [...manifest.capabilities]
    capabilities[1] = capabilities[0]
    expect(() =>
      assertRuntimeCompatibility({ ...manifest, capabilities }, pinnedLock),
    ).toThrow()
  })

  it('keeps every ergonomic runtime dispatch inside the approved 62-operation ABI', () => {
    const approved = new Set<string>(
      WEB_V0_1_CAPABILITIES.map(([operation]) => operation),
    )
    const dispatched = Object.values(runtimeBoundary).map(
      (entry) => entry.operation,
    )

    expect(WEB_V0_1_CAPABILITIES).toHaveLength(62)
    expect(new Set(dispatched).size).toBe(dispatched.length)
    expect(dispatched.filter((operation) => !approved.has(operation))).toEqual(
      [],
    )
    expect(
      new Set([
        ...dispatched,
        // Kept in the runtime inventory for strict legacy callers. The web UI
        // exclusively uses the inspect/review/apply workflow.
        'archive.apply',
        // These current runtime capabilities remain below the ergonomic
        // client boundary until their existing media workflows adopt them.
        'media.browseArchive',
        'media.rename',
        'media.reorder',
        'media.replaceContent',
        'product.describe',
        'store.invalidation',
        'operation.cancel',
      ]),
    ).toEqual(approved)
    expect(
      Object.values(runtimeBoundary).every(
        (entry) =>
          typeof entry.prepare === 'function' &&
          typeof entry.map === 'function',
      ),
    ).toBe(true)
    expect(dispatched).not.toContain('runtime.storage')
    expect(dispatched).toContain('time.window')
    expect(dispatched).toContain('time.step')
    expect(dispatched).toContain('time.calendarContext')
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
