import { z } from 'zod'

const exactVersion = /^(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*)){0,2}$/
const exactRuntimeVersion =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$/
const identifier = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/
const sha256 = /^[0-9a-f]{64}$/
const bundlePath = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/

const exactVersionSchema = z.string().regex(exactVersion)
const bundlePathSchema = z
  .string()
  .regex(bundlePath)
  .refine((value) => value.split('/').every((part) => part !== '.'))
  .refine((value) => value.split('/').every((part) => part !== '..'))

export const WEB_V0_1_CAPABILITIES = [
  ['product.describe', '5'],
  ['archive.verify', '4'],
  ['store.open', '5'],
  ['store.close', '1'],
  ['store.invalidation', '1'],
  ['operation.cancel', '1'],
  ['record.loadSpan', '1'],
  ['record.saveDraft', '1'],
  ['record.deleteEntry', '1'],
  ['timeline.index', '4'],
  ['timeline.focusedDetail', '1'],
  ['media.listForEntry', '1'],
  ['media.resolveContent', '1'],
  ['media.import', '1'],
  ['media.delete', '1'],
  ['archive.overview', '5'],
  ['archive.export', '5'],
  ['archive.apply', '5'],
  ['archive.erase', '2'],
  ['record.listObjects', '3'],
  ['structured.load', '3'],
  ['structured.create', '3'],
  ['structured.save', '3'],
  ['structured.delete', '1'],
  ['structured.convertSpanToEvent', '3'],
  ['timeline.structuredDetail', '3'],
  ['timeline.structuredList', '3'],
  ['archive.identity.load', '1'],
  ['archive.identity.save', '1'],
  ['track.list', '2'],
  ['track.load', '2'],
  ['track.create', '2'],
  ['track.save', '2'],
  ['track.delete', '2'],
  ['track.createWithFirstMember', '2'],
  ['track.history', '2'],
  ['track.attachMember', '1'],
  ['track.detachMember', '1'],
  ['track.createMember', '1'],
] as const

const unpinnedRuntimeLockSchema = z.strictObject({
  manifestVersion: z.literal(1),
  runtimeVersion: z.null(),
  artifactUrl: z.null(),
  sha256: z.null(),
  productContract: z.null(),
  bindingsAbi: z.null(),
  status: z.literal('not-integrated'),
})

const pinnedRuntimeLockSchema = z
  .strictObject({
    manifestVersion: z.literal(1),
    runtimeVersion: z.string().regex(exactRuntimeVersion),
    artifactUrl: z.url(),
    sha256: z.string().regex(sha256),
    productContract: exactVersionSchema,
    bindingsAbi: exactVersionSchema,
    status: z.literal('pinned'),
  })
  .superRefine((lock, context) => {
    const url = new URL(lock.artifactUrl)
    if (
      url.protocol !== 'https:' ||
      url.search !== '' ||
      url.hash !== '' ||
      !url.pathname.includes(lock.runtimeVersion) ||
      /(^|[./_-])(latest|main|master)([./_-]|$)/i.test(url.pathname)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'artifactUrl must be an immutable HTTPS runtime-version URL',
        path: ['artifactUrl'],
      })
    }
  })

export const runtimeLockSchema = z.union([
  unpinnedRuntimeLockSchema,
  pinnedRuntimeLockSchema,
])

const capabilitySchema = z.strictObject({
  name: z.string().regex(/^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+$/),
  version: exactVersionSchema,
})

const runtimeFileSchema = z.strictObject({
  path: bundlePathSchema,
  sha256: z.string().regex(sha256),
})

export const runtimeManifestSchema = z
  .strictObject({
    manifestVersion: z.literal(1),
    runtimeVersion: z.string().regex(exactRuntimeVersion),
    buildId: z.string().regex(identifier),
    productContract: exactVersionSchema,
    bindingsAbi: exactVersionSchema,
    dependencyVersions: z.strictObject({
      domain: exactVersionSchema,
      timeNavigation: exactVersionSchema,
      durableMedia: exactVersionSchema,
      archiveApplication: exactVersionSchema,
      applicationQuery: exactVersionSchema,
      providerNeutralAI: exactVersionSchema,
      archiveOverviewExport: exactVersionSchema,
      store: exactVersionSchema,
      rootLayout: exactVersionSchema,
      sqliteSchema: exactVersionSchema,
      archiveFormat: exactVersionSchema,
    }),
    capabilities: z
      .array(capabilitySchema)
      .length(WEB_V0_1_CAPABILITIES.length),
    modules: z.strictObject({
      loader: bundlePathSchema,
      wasm: bundlePathSchema,
      types: bundlePathSchema,
    }),
    files: z.array(runtimeFileSchema).length(5),
    persistence: z.strictObject({
      backend: z.string().regex(identifier),
      durable: z.boolean(),
    }),
    requiredEnvironment: z.strictObject({
      executionContext: z.literal('dedicated-worker'),
      secureContext: z.literal(true),
      features: z.array(z.string().regex(identifier)).min(1),
    }),
    licence: z.strictObject({
      id: z.literal('proprietary'),
      licencePath: bundlePathSchema,
      noticesPath: bundlePathSchema,
    }),
  })
  .superRefine((manifest, context) => {
    if (/^[0-9a-f]{40}$|^[0-9a-f]{64}$/i.test(manifest.buildId)) {
      context.addIssue({
        code: 'custom',
        message: 'buildId must be opaque and must not be a commit SHA',
        path: ['buildId'],
      })
    }

    const expectedDependencies = {
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
    }
    if (
      Object.entries(expectedDependencies).some(
        ([name, version]) =>
          manifest.dependencyVersions[
            name as keyof typeof expectedDependencies
          ] !== version,
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'dependency versions must match product contract 5',
        path: ['dependencyVersions'],
      })
    }

    const expectedCapabilities = WEB_V0_1_CAPABILITIES.map(
      ([name, version]) => `${name}@${version}`,
    )
    const actualCapabilities = manifest.capabilities.map(
      ({ name, version }) => `${name}@${version}`,
    )
    if (
      actualCapabilities.some(
        (capability, index) => capability !== expectedCapabilities[index],
      ) ||
      new Set(actualCapabilities).size !== actualCapabilities.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'capabilities must equal the ordered web v0.1 inventory',
        path: ['capabilities'],
      })
    }

    const filePaths = manifest.files.map((file) => file.path)
    if (new Set(filePaths).size !== filePaths.length) {
      context.addIssue({
        code: 'custom',
        message: 'runtime file paths must be unique',
        path: ['files'],
      })
    }

    const referencedPaths = [
      manifest.modules.loader,
      manifest.modules.wasm,
      manifest.modules.types,
      manifest.licence.licencePath,
      manifest.licence.noticesPath,
    ]
    if (
      new Set(referencedPaths).size !== referencedPaths.length ||
      referencedPaths.some((path) => !filePaths.includes(path))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'module, licence, and notices paths must name distinct files',
        path: ['files'],
      })
    }

    const features = manifest.requiredEnvironment.features
    if (
      new Set(features).size !== features.length ||
      features.some(
        (feature, index) => index > 0 && features[index - 1] >= feature,
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'environment features must be unique and sorted',
        path: ['requiredEnvironment', 'features'],
      })
    }

    if (
      manifest.persistence.backend === 'unproven' &&
      manifest.persistence.durable
    ) {
      context.addIssue({
        code: 'custom',
        message: 'an unproven persistence backend cannot claim durability',
        path: ['persistence'],
      })
    }
  })

export type RuntimeLock = z.infer<typeof runtimeLockSchema>
export type RuntimeManifest = z.infer<typeof runtimeManifestSchema>

export function parseRuntimeLock(input: unknown): RuntimeLock {
  return runtimeLockSchema.parse(input)
}

export function assertRuntimeCompatibility(
  manifestInput: unknown,
  lockInput: unknown,
): RuntimeManifest {
  const lock = parseRuntimeLock(lockInput)
  if (lock.status !== 'pinned') {
    throw new Error('No runtime is pinned')
  }

  const manifest = runtimeManifestSchema.parse(manifestInput)
  if (
    manifest.manifestVersion !== lock.manifestVersion ||
    manifest.runtimeVersion !== lock.runtimeVersion ||
    manifest.productContract !== lock.productContract ||
    manifest.bindingsAbi !== lock.bindingsAbi
  ) {
    throw new Error('Runtime manifest does not match the pinned runtime')
  }
  return manifest
}

export async function verifyArtifactSha256(
  bytes: Uint8Array,
  expected: string,
): Promise<void> {
  if (!sha256.test(expected)) {
    throw new Error('Pinned runtime checksum is malformed')
  }
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer)
  const actual = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  if (actual !== expected) {
    throw new Error('Runtime artifact checksum mismatch')
  }
}
