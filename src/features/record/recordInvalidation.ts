import type { InvalidationToken } from '../../core/client'

/**
 * Keeps the newest archive snapshot observed by two Record controllers.
 *
 * Revisions are canonical unsigned decimal strings, so comparing length and
 * then lexical order preserves their numeric ordering without losing u64
 * precision.
 */
export function newestRecordInvalidation(
  current: InvalidationToken,
  candidate: InvalidationToken | null | undefined,
): InvalidationToken
export function newestRecordInvalidation(
  current: InvalidationToken | null,
  candidate: InvalidationToken,
): InvalidationToken
export function newestRecordInvalidation(
  current: InvalidationToken | null,
  candidate: InvalidationToken | null | undefined,
): InvalidationToken | null {
  if (!candidate) return current
  if (!current || current.storeInstanceId !== candidate.storeInstanceId) {
    return candidate
  }
  const currentRevision = current.revision
  const candidateRevision = candidate.revision
  return candidateRevision.length > currentRevision.length ||
    (candidateRevision.length === currentRevision.length &&
      candidateRevision > currentRevision)
    ? candidate
    : current
}
