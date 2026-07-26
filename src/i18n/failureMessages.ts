/**
 * Turning a stable failure code into a sentence.
 *
 * `ClientFailure` deliberately carries no text, and its codes are open-ended:
 * an operation-specific code from a newer runtime is valid even though this
 * build has never seen it. So the lookup is ordered from most specific to
 * least, and the last step always succeeds:
 *
 * 1. `failure.<area>.<code>` — when one area needs different wording.
 * 2. `failure.<code>` — the usual case.
 * 3. `failure.generic` — true of every failure, and never absent.
 *
 * An unrecognised code therefore produces a calm, accurate sentence instead of
 * a raw identifier on screen or a crash. The code itself stays available to
 * callers that want to show it as diagnostic detail; it is never mistaken for
 * copy.
 */

import type { ClientFailure, FailureCode } from '../core/client'
import type { AppLocalisation } from './context'

/** The key that would be used, for tests and diagnostics. */
export function failureMessageKeys(failure: ClientFailure): readonly string[] {
  return [
    `failure.${failure.area}.${failure.code}`,
    `failure.${failure.code}`,
    'failure.generic',
  ]
}

/** The sentence for a failure. Never throws and never returns a bare code. */
export function failureMessage(
  localisation: AppLocalisation,
  failure: ClientFailure,
): string {
  for (const key of failureMessageKeys(failure)) {
    const message = localisation.resolve(key)
    if (message !== null) return message
  }
  return localisation.t('failure.generic')
}

/** True when this build has wording of its own for a code. */
export function hasFailureMessage(
  localisation: AppLocalisation,
  code: FailureCode,
): boolean {
  return localisation.has(`failure.${code}`)
}
