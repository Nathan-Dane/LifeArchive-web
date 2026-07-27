import type {
  LifeArchiveClient,
  PersistenceGrant,
  StorageEstimate,
  StorageFacts,
} from '../../../core/client'
import type { StoragePersistence } from '../../../platform/storage'

export interface ArchiveStorageFacts {
  /** Runtime-owned backend, durability, and open-state facts. */
  readonly runtime: StorageFacts | null
  /** Browser-owned origin persistence decision. */
  readonly grant: PersistenceGrant
  /** Browser-owned approximate origin figures. */
  readonly estimate: StorageEstimate | null
}

/**
 * Reads the runtime and browser as separate authorities.
 *
 * The runtime result is used only for backend/durability/open state. The grant
 * and estimate deliberately come from `StorageManager`: treating the
 * runtime's storage result as permission evidence would collapse two distinct
 * claims into one badge.
 */
export async function readArchiveStorageFacts(
  client: LifeArchiveClient,
  persistence: StoragePersistence,
): Promise<ArchiveStorageFacts> {
  const [runtime, grant, estimate] = await Promise.all([
    readRuntimeFacts(client),
    readGrant(persistence),
    readEstimate(persistence),
  ])
  return { runtime, grant, estimate }
}

async function readRuntimeFacts(
  client: LifeArchiveClient,
): Promise<StorageFacts | null> {
  try {
    const result = await client.runtime.storage()
    return result.status === 'ok' ? result.value : null
  } catch {
    return null
  }
}

async function readGrant(
  persistence: StoragePersistence,
): Promise<PersistenceGrant> {
  try {
    return await persistence.current()
  } catch {
    return 'unknown'
  }
}

async function readEstimate(
  persistence: StoragePersistence,
): Promise<StorageEstimate | null> {
  try {
    return await persistence.estimate()
  } catch {
    return null
  }
}
