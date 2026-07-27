import type { LifeArchiveClient, RuntimeStatus } from '../client'

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

export function clientRuntimeStatus(state: RuntimeLoadState): RuntimeStatus {
  switch (state.state) {
    case 'checking':
      return { state: 'checking' }
    case 'open':
      return state.client.runtime.status()
    case 'incompatible':
      return { state: 'incompatible', reason: state.reason }
    case 'unavailable':
      if (state.reason === 'not-integrated') {
        return { state: 'unavailable', reason: 'not-integrated' }
      }
      if (state.reason === 'worker-unsupported') {
        return { state: 'unavailable', reason: 'worker-unsupported' }
      }
      if (state.reason === 'insecure-context') {
        return { state: 'unavailable', reason: 'insecure-context' }
      }
      if (state.reason === 'worker-instantiate-failed') {
        return { state: 'unavailable', reason: 'load-failed' }
      }
      return { state: 'unavailable', reason: 'download-failed' }
  }
}
