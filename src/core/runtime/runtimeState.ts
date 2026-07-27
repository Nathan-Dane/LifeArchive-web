import type { LifeArchiveClient } from '../client'

export type RuntimeLoadState =
  | { readonly state: 'checking' }
  | {
      readonly state: 'unavailable'
      readonly reason:
        | 'not-integrated'
        | 'missing'
        | 'download-failed'
        | 'worker-unsupported'
        | 'insecure-context'
        | 'worker-instantiate-failed'
    }
  | {
      readonly state: 'incompatible'
      readonly reason:
        | 'checksum-mismatch'
        | 'manifest-mismatch'
        | 'contract-mismatch'
        | 'abi-mismatch'
        | 'capability-inventory-mismatch'
        | 'browser-engine-unsupported'
        | 'browser-version-unsupported'
        | 'browser-device-unsupported'
        | 'browser-storage-unsupported'
        | 'environment-unsupported'
    }
  | {
      readonly state: 'open'
      readonly client: LifeArchiveClient
    }
