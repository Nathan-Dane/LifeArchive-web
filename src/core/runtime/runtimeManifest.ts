import {
  WEB_V0_1_CAPABILITIES,
  assertRuntimeCompatibility,
  parseRuntimeLock,
  runtimeManifestSchema,
  type RuntimeLock,
  type RuntimeManifest,
} from './runtimeCompatibility'

export {
  WEB_V0_1_CAPABILITIES,
  assertRuntimeCompatibility,
  parseRuntimeLock,
  runtimeManifestSchema,
}

export type { RuntimeLock, RuntimeManifest }

export function requiredCapabilities(
  manifest: RuntimeManifest,
): ReadonlyMap<string, string> {
  return new Map(
    manifest.capabilities.map(({ name, version }) => [name, version]),
  )
}
