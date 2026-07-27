/**
 * Failures and the result envelope for the LifeArchive web client.
 *
 * Every client method returns a value. Product failures are data, not thrown
 * exceptions, and they carry no display text: a failure is a stable machine
 * decision, and the localisation surface turns it into a sentence.
 *
 * A failure never carries partial success, never advances invalidation, and
 * never justifies discarding the user's buffer. Expected outcomes that a
 * feature must branch on — absence, a revision conflict, a stale snapshot —
 * are result states in `types.ts`, not failures.
 */

import type { DurableOutcome, Revision, StableId } from './types'

/**
 * The broad stable area that owns a failure. `transport` covers the worker and
 * runtime boundary beneath the client; the rest mirror product ownership.
 * There is no AI area: v0.1 exposes no AI surface.
 */
export type FailureArea =
  | 'request'
  | 'compatibility'
  | 'lifecycle'
  | 'storage'
  | 'concurrency'
  | 'record'
  | 'timeline'
  | 'media'
  | 'archive'
  | 'cancelled'
  | 'cleanup'
  | 'transport'

/** The safe phase in which a failure became definitive. */
export type FailurePhase =
  | 'negotiation'
  | 'rootValidation'
  | 'lock'
  | 'open'
  | 'validation'
  | 'archiveStructureAndVersion'
  | 'checksumScopeAndBytes'
  | 'recordsAndReferences'
  | 'attachmentMedia'
  | 'destinationPlanning'
  | 'mediaStagingAndJournal'
  | 'finalCancellationCheckpoint'
  | 'commit'
  | 'compensation'
  | 'recovery'
  | 'snapshot'
  | 'media'
  | 'encoding'
  | 'verification'
  | 'publication'
  | 'cleanup'
  | 'mutation'
  | 'cancellation'
  | 'close'
  | 'transport'

/**
 * A stable, nonlocalized machine code. Common codes are enumerated in
 * `KNOWN_FAILURE_CODES`; operation-specific codes stay intact rather than
 * being collapsed into a generic error.
 */
export type FailureCode = string

/**
 * Codes the presentation layer is expected to have wording for. This list is a
 * localisation completeness aid, not a filter: an unlisted operation code is
 * still a valid stable code.
 */
export const KNOWN_FAILURE_CODES = [
  'busyRetryable',
  'cancelled',
  'cleanupIncomplete',
  'closed',
  'corruptStore',
  'duplicateOperation',
  'invalidIdentifier',
  'invalidRequest',
  'invalidRoot',
  'invalidationExhausted',
  'ioFailure',
  'recoveryIncomplete',
  'revisionConflict',
  'revisionExhausted',
  'staleArchiveGeneration',
  'storeAlreadyOpen',
  'unsupportedCapability',
  'unsupportedContractVersion',
  'unsupportedLayout',
  'unsupportedSchema',
] as const

export type KnownFailureCode = (typeof KNOWN_FAILURE_CODES)[number]

export function isKnownFailureCode(
  code: FailureCode,
): code is KnownFailureCode {
  return (KNOWN_FAILURE_CODES as readonly string[]).includes(code)
}

/** What a failure is about, when the core says so. */
export interface FailureSubject {
  readonly kind: 'archive' | 'entry' | 'object' | 'track' | 'member' | 'media'
  readonly id: StableId | null
}

/** Whether compensation finished after a failed multi-stage operation. */
export type CleanupState =
  | 'complete'
  | 'incomplete'
  | 'temporary-output-may-remain'
  | 'verified-output-may-remain'
  | 'temporary-and-verified-output-may-remain'

/** Safe nested cause metadata. Paths, messages, and payloads never cross. */
export interface FailureCause {
  readonly code: FailureCode
  readonly field: string | null
}

/**
 * One failed operation. There is deliberately no message field: a localized
 * string here would become the de facto API and would leak core internals.
 */
export interface ClientFailure {
  readonly area: FailureArea
  readonly code: FailureCode
  readonly phase: FailurePhase
  /**
   * Whether the identical request may be retried. Taken from the core, never
   * inferred from the area or the code text.
   */
  readonly retryable: boolean
  readonly field: string | null
  readonly subject: FailureSubject | null
  /** Lossless conflict evidence; writing/current snapshots live in results. */
  readonly expectedRevision: Revision | null
  readonly actualRevision: Revision | null
  readonly cleanup: CleanupState | null
  /**
   * Whether durable work had started. `unknown` requires recovery messaging
   * and forbids a silent retry that could duplicate a mutation.
   */
  readonly durableOutcome: DurableOutcome
  readonly cause: FailureCause | null
}

/** Every client method returns one of these two states. */
export type ClientResult<Value> =
  | { readonly status: 'ok'; readonly value: Value }
  | { readonly status: 'failed'; readonly failure: ClientFailure }

export function ok<Value>(value: Value): ClientResult<Value> {
  return { status: 'ok', value }
}

export function failed<Value>(failure: ClientFailure): ClientResult<Value> {
  return { status: 'failed', failure }
}

export function isOk<Value>(
  result: ClientResult<Value>,
): result is { readonly status: 'ok'; readonly value: Value } {
  return result.status === 'ok'
}

/**
 * Builds a failure with the safe defaults. Absent context stays absent so a
 * caller cannot mistake a default for something the core reported.
 */
export function clientFailure(
  fields: Pick<ClientFailure, 'area' | 'code' | 'phase' | 'retryable'> &
    Partial<
      Pick<
        ClientFailure,
        | 'field'
        | 'subject'
        | 'expectedRevision'
        | 'actualRevision'
        | 'cleanup'
        | 'durableOutcome'
        | 'cause'
      >
    >,
): ClientFailure {
  return Object.freeze({
    area: fields.area,
    code: fields.code,
    phase: fields.phase,
    retryable: fields.retryable,
    field: fields.field ?? null,
    subject: fields.subject ?? null,
    expectedRevision: fields.expectedRevision ?? null,
    actualRevision: fields.actualRevision ?? null,
    cleanup: fields.cleanup ?? null,
    durableOutcome: fields.durableOutcome ?? 'not-started',
    cause: fields.cause ?? null,
  })
}

/**
 * The stable lookup key for localized presentation, in `area.code` form. The
 * client never produces the sentence itself.
 */
export function failureKey(failure: ClientFailure): string {
  return `${failure.area}.${failure.code}`
}

/** True when a failure left started durable work in an unknown state. */
export function hasUnknownDurableOutcome(failure: ClientFailure): boolean {
  return failure.durableOutcome === 'unknown'
}

/**
 * Fails a switch that did not handle every member of a union. Exhaustiveness
 * matters here: a missed lifecycle or outcome state is a data-safety bug, not
 * a cosmetic one.
 */
export function assertNever(value: never): never {
  throw new TypeError(`Unhandled client state: ${JSON.stringify(value)}`)
}
