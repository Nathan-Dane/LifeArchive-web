import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import runtimeLock from '../../../runtime/runtime.lock.json'

/**
 * The lock file is the single source of truth for which runtime this checkout
 * expects. Until a real release is pinned it must say so explicitly, so that
 * nothing in the public repository can present an available runtime.
 */
const runtimeLockSchema = z.object({
  manifestVersion: z.literal(1),
  runtimeVersion: z.string().nullable(),
  artifactUrl: z.string().nullable(),
  sha256: z.string().nullable(),
  productContract: z.string().nullable(),
  bindingsAbi: z.string().nullable(),
  status: z.enum(['not-integrated', 'pinned']),
})

describe('runtime state', () => {
  it('has a well-formed lock file', () => {
    expect(() => runtimeLockSchema.parse(runtimeLock)).not.toThrow()
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
})
