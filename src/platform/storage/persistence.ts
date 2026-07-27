/**
 * The browser's storage-persistence permission and its space estimate.
 *
 * This is a platform capability, not archive behaviour: it asks the browser
 * whether it will keep this origin's data and what it thinks the space is. It
 * touches no archive bytes, reads no archive content, and decides nothing —
 * where the archive lives is the runtime's business.
 *
 * Two distinctions the rest of the application depends on:
 *
 * - **Not granted is not denied.** `persisted()` answering `false` only means
 *   nobody has been granted anything yet, so it maps to `unknown`. Only an
 *   explicit `persist()` answering `false` is a refusal.
 * - **An absent estimate is `null`, never a zero.** A browser that will not
 *   estimate has not told us the site has no space, and a UI that showed `0`
 *   would be inventing a figure the browser declined to give.
 */

import type { PersistenceGrant, StorageEstimate } from '../../core/client'

/** The part of `StorageManager` this adapter uses, so a test can supply one. */
export interface StorageManagerLike {
  persisted?: () => Promise<boolean>
  persist?: () => Promise<boolean>
  estimate?: () => Promise<{ usage?: number; quota?: number }>
}

export interface StoragePersistence {
  /** The current grant, without asking the user for anything. */
  readonly current: () => Promise<PersistenceGrant>
  /** Asks the browser to keep this origin's data. May prompt. */
  readonly request: () => Promise<PersistenceGrant>
  /** The browser's approximate figures, or `null` when it gives none. */
  readonly estimate: () => Promise<StorageEstimate | null>
}

function isByteCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/**
 * Builds the adapter. With no manager supplied it reads `navigator.storage` at
 * call time, so a page that runs in an environment without it — an older
 * engine, a test — reports `unsupported` rather than throwing.
 */
export function createStoragePersistence(
  manager?: StorageManagerLike,
): StoragePersistence {
  const resolve = (): StorageManagerLike | undefined =>
    manager ?? globalThis.navigator?.storage

  return Object.freeze({
    current: async () => {
      const storage = resolve()
      if (!storage?.persisted) return 'unsupported'
      try {
        return (await storage.persisted()) ? 'granted' : 'unknown'
      } catch {
        return 'unknown'
      }
    },
    request: async () => {
      const storage = resolve()
      if (!storage?.persist) return 'unsupported'
      try {
        return (await storage.persist()) ? 'granted' : 'denied'
      } catch {
        return 'unknown'
      }
    },
    estimate: async () => {
      const storage = resolve()
      if (!storage?.estimate) return null
      try {
        const { usage, quota } = await storage.estimate()
        if (!isByteCount(usage) || !isByteCount(quota)) return null
        return {
          usedBytes: usage,
          quotaBytes: quota,
          approximate: true as const,
        }
      } catch {
        return null
      }
    },
  })
}

/** The adapter the application uses. */
export const browserStoragePersistence = createStoragePersistence()
