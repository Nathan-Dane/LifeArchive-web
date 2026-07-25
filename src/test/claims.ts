/**
 * Claims the bootstrap shell must never make.
 *
 * There is no runtime and no persistence yet — `runtime/runtime.lock.json`
 * records `"status": "not-integrated"` — so any wording that implies a user's
 * writing is durable, synchronised, or held on their device is false.
 */
export const FORBIDDEN_PERSISTENCE_CLAIMS: readonly RegExp[] = [
  /\bsaved\b/i,
  /\bsynced\b/i,
  /\bsyncing\b/i,
  /\bbacked up\b/i,
  /\bpersistent\b/i,
  /\bpersisted\b/i,
  /\bstored on this device\b/i,
]

/**
 * Claims that a production runtime or a real archive is available.
 */
export const FORBIDDEN_AVAILABILITY_CLAIMS: readonly RegExp[] = [
  /archive (is )?(open|loaded|ready|available)/i,
  /runtime (is )?(ready|available|connected|loaded)/i,
]
