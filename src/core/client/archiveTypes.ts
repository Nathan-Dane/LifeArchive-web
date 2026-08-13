import type { CountedEntryKind } from './recordTypes'
import type {
  CivilDate,
  Instant,
  InvalidationToken,
  OperationId,
  StableId,
} from './types'

/* -------------------------------------------------------------------------- */
/* Archive identity                                                           */
/* -------------------------------------------------------------------------- */

export type LifeStatus = 'unspecified' | 'living' | 'deceased'

export interface ArchiveSubject {
  readonly id: StableId
  readonly displayName: string | null
  readonly shortName: string | null
  readonly lifeStatus: LifeStatus
  readonly dateOfBirth: CivilDate | null
  readonly dateOfDeath: CivilDate | null
}

/**
 * The complete portable identity. Both stable IDs are preserved on save; the
 * client never replaces one or invents a fallback title.
 */
export interface ArchiveIdentity {
  readonly id: StableId
  readonly title: string | null
  readonly subject: ArchiveSubject
}

export interface ArchiveIdentityState {
  readonly identity: ArchiveIdentity
  readonly invalidation: InvalidationToken
}

export interface ArchiveIdentitySaveResult {
  readonly outcome: 'updated' | 'unchanged'
  readonly identity: ArchiveIdentity
  readonly invalidation: InvalidationToken
}

/* -------------------------------------------------------------------------- */
/* Runtime and storage facts                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Which client implementation is answering. A development mock is explicit and
 * visible; production never selects one.
 */
export type ClientMode = 'runtime' | 'development-mock'

/**
 * Runtime durability as the runtime itself reports it. `best-effort` and
 * `unproven` must never be presented as backed up.
 */
export type StorageDurability = 'durable' | 'best-effort' | 'unproven'

/** The browser's persistence decision, which the browser owns. */
export type PersistenceGrant = 'granted' | 'denied' | 'unknown' | 'unsupported'

/** Browser quota figures, which are approximate by definition. */
export interface StorageEstimate {
  readonly usedBytes: number
  readonly quotaBytes: number
  readonly approximate: true
}

/**
 * The four separate storage facts the UI may state. Runtime durability, the
 * current archive state, the persistence grant, and the estimate are distinct
 * claims and are never collapsed into one badge.
 */
export interface StorageFacts {
  readonly backend: string
  readonly durability: StorageDurability
  readonly archiveOpen: boolean
  readonly grant: PersistenceGrant
  readonly estimate: StorageEstimate | null
}

export interface RuntimeFacts {
  readonly mode: ClientMode
  readonly runtimeVersion: string
  readonly buildId: string
  readonly productContract: string
  readonly browserAbi: string
  readonly backend: string
  readonly durability: StorageDurability
}

export type RuntimeIncompatibleReason =
  | 'not-pinned'
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

export type RuntimeUnavailableReason =
  | 'not-integrated'
  | 'download-failed'
  | 'load-failed'
  | 'worker-unsupported'
  | 'insecure-context'
  | 'worker-lost'

/**
 * There is no partial runtime and no quiet degradation: a runtime either
 * negotiated the whole approved surface or the client says why it did not.
 */
export type RuntimeStatus =
  | { readonly state: 'checking' }
  | {
      readonly state: 'available'
      readonly runtime: RuntimeFacts
    }
  | {
      readonly state: 'incompatible'
      readonly reason: RuntimeIncompatibleReason
    }
  | {
      readonly state: 'unavailable'
      readonly reason: RuntimeUnavailableReason
    }

/* -------------------------------------------------------------------------- */
/* Archive lifecycle and management                                           */
/* -------------------------------------------------------------------------- */

/** Whether started durable work is known to have completed. */
export type DurableOutcome = 'known' | 'not-started' | 'unknown'

export interface OpenArchive {
  readonly storeId: StableId
  readonly productContract: string
  readonly storeSchemaVersion: string
  readonly rootLayoutVersion: string
  readonly invalidation: InvalidationToken
}

/**
 * The archive lifecycle as the UI may present it. A failed open never becomes
 * an empty replacement archive, and lost ownership is stated, not hidden.
 */
export type ArchiveSession =
  | { readonly state: 'no-archive' }
  | { readonly state: 'opening' }
  | {
      readonly state: 'open'
      readonly archive: OpenArchive
      /**
       * A presentation handoff for a confirmed generation replacement. It
       * carries no prior identifier or archive data.
       */
      readonly transition?: 'erased'
    }
  | { readonly state: 'closing' }
  | { readonly state: 'closed' }
  | { readonly state: 'open-in-another-tab' }
  | {
      readonly state: 'needs-recovery'
      /**
       * True after a confirmed replacement whose fresh identity could not be
       * read. No view may retain identifiers from the prior archive.
       */
      readonly previousArchiveInvalid?: true
    }
  | { readonly state: 'incompatible' }
  | {
      readonly state: 'lost'
      readonly durableOutcome: DurableOutcome
    }

/**
 * Close is definitive. `already-closed` is the idempotent outcome, and a
 * failed close is never presented as closed.
 */
export interface ArchiveCloseResult {
  readonly outcome: 'closed' | 'already-closed'
}

/**
 * Health facts as the current product surface reports them on success. A new
 * reported value is a capability change, not something the client invents.
 */
export interface ArchiveHealthFacts {
  readonly readable: boolean
  readonly schemaCompatible: boolean
  readonly recovery: 'clean'
  readonly integrity: 'verified'
  readonly referenceViolationCount: number
  readonly overall: 'healthy'
}

export interface ArchiveOverview {
  readonly storeId: StableId
  readonly storeSchemaVersion: string
  readonly storeContract: string
  readonly visibleEntryCount: number
  readonly entryCounts: Readonly<Record<CountedEntryKind, number>>
  readonly structuredCounts: {
    readonly events: number
    readonly spans: number
  }
  readonly trackCounts: {
    readonly active: number
    readonly archived: number
    readonly ongoingMembers: number
  }
  readonly personCounts: {
    readonly active: number
    readonly archived: number
  }
  readonly mediaCount: number
  readonly mediaByteTotal: number
  readonly health: ArchiveHealthFacts
  readonly invalidation: InvalidationToken
}

/**
 * The opaque archive package as the platform hands it over. The client moves
 * it; only the core reads or writes what is inside.
 */
export type ArchivePackage = File

export interface ArchiveVerifyRequest {
  readonly archive: ArchivePackage
}

export interface ArchiveVerificationIssue {
  readonly code: string
  readonly path: string | null
}

/**
 * A read-only integrity report. Verification never implies a backup, a sync,
 * or that the archive is stored anywhere in particular.
 */
export interface ArchiveVerification {
  readonly valid: boolean
  readonly issues: readonly ArchiveVerificationIssue[]
  readonly checkedFiles: number
}

export interface ArchiveExportRequest {
  readonly operationId: OperationId
  /** Fresh identity for this one portable package. */
  readonly artifactId: StableId
  /** Identity of the open source store; never reused as the artifact ID. */
  readonly sourceStoreId: StableId
  readonly createdAtMs: Instant
}

export interface ArchiveExportResult {
  readonly archive: ArchivePackage
  readonly artifactId: StableId
  readonly sourceStoreId: StableId
  /** The exact core-produced creation timestamp text. */
  readonly createdAt: string
  readonly counts: {
    readonly entries: number
    readonly media: number
    readonly summaries: number
    readonly tracks: number
    readonly people: number
  }
  readonly dateRange: { readonly start: string; readonly end: string } | null
  readonly filesWritten: number
  readonly checkedFiles: number
  readonly checksumAlgorithm: 'sha256'
  readonly invalidation: InvalidationToken
}

export interface ArchiveImportInspectRequest {
  readonly archive: ArchivePackage
}

/** Counts reported by the core for one kind of importable archive item. */
export interface ArchiveImportInspectionCounts {
  readonly total: number
  readonly importable: number
  readonly alreadyPresent: number
  readonly needsDecision: number
}

/** Safe package identity facts returned by the core for review. */
export interface ArchiveImportSource {
  readonly archiveName: string | null
  readonly subjectName: string | null
  readonly createdAt: string
  readonly formatVersion: string
}

/** Bounded facts used to explain format and person mismatches. */
export interface ArchiveImportInspectionContext {
  readonly supportedFormatVersion: string
  readonly archiveFormatVersion: string | null
  readonly formatRelation: 'supported' | 'older' | 'newer' | 'unknown'
  readonly sourceSubjectName: string | null
  readonly destinationSubjectName: string | null
}

/**
 * One issue discovered during read-only inspection. Resolution option IDs are
 * an ordered core-owned inventory: the browser presents and returns them, but
 * never invents an option or decides what an option means durably.
 */
export interface ArchiveImportInspectionIssue {
  readonly issueId: string
  readonly code: string
  readonly severity: string
  readonly category: string
  readonly disposition: string
  readonly causeCode: string | null
  readonly field: string | null
  readonly path: string | null
  readonly line: number | null
  readonly recordKind: string | null
  readonly id: StableId | null
  readonly allowedResolutions: readonly string[]
}

/** A read-only plan for the exact selected package and open archive. */
export interface ArchiveImportInspection {
  readonly workflowVersion: '2'
  readonly outcome: 'ready' | 'needsResolution' | 'blocked'
  readonly context: ArchiveImportInspectionContext
  readonly planId: string | null
  readonly source: ArchiveImportSource | null
  readonly counts: {
    readonly entries: ArchiveImportInspectionCounts
    readonly media: ArchiveImportInspectionCounts
    readonly tracks: ArchiveImportInspectionCounts
    readonly people: ArchiveImportInspectionCounts
  }
  readonly issues: readonly ArchiveImportInspectionIssue[]
}

export interface ArchiveImportResolutionSelection {
  readonly issueId: string
  readonly optionId: string
}

export interface ArchiveImportRequest {
  readonly operationId: OperationId
  readonly archive: ArchivePackage
  /** The exact plan returned by inspection; the core rejects stale plans. */
  readonly expectedPlanId: string
  readonly resolutions: {
    readonly selections: readonly ArchiveImportResolutionSelection[]
  }
}

export interface ArchiveImportIssue {
  readonly code: string
  readonly causeCode?: string | null
  /** Stable field identity for programmatic recovery; never display text. */
  readonly field: string | null
  readonly path?: string | null
  readonly line?: number | null
  /** Absent when the issue is about the package rather than one record. */
  readonly recordKind: string | null
  readonly id: StableId | null
}

/**
 * What import did to identity. An empty archive may adopt identity; a matching
 * archive only fills empty fields and reports the fields it did not overwrite.
 *
 * The outcome carries no identity value: application reports what it did, and
 * the resulting identity is read through `identity.load` rather than inferred
 * here from a partial echo.
 */
export type ArchiveImportIdentityOutcome =
  | { readonly outcome: 'preserved' }
  | { readonly outcome: 'adopted' }
  | {
      readonly outcome: 'matched'
    }
  | {
      readonly outcome: 'merged'
      readonly filledFields: readonly string[]
      readonly conflictingFields: readonly string[]
    }

/**
 * Import merges and skips; it never overwrites or replaces. Skipped stable IDs
 * are reported so the user can be told exactly what was already present.
 */
export interface ArchiveImportResult {
  /** True for every durable content, identity, Track, or recovery mutation. */
  readonly changed: boolean
  readonly recovery: 'clean' | 'pending'
  readonly importedEntries: number
  readonly importedMedia: number
  readonly importedTracks: number
  readonly importedPeople: number
  readonly skippedEntries: number
  readonly skippedMedia: number
  readonly skippedTracks: number
  readonly skippedPeople: number
  readonly skippedEntryIds: readonly StableId[]
  readonly skippedMediaIds: readonly StableId[]
  readonly skippedTrackIds: readonly StableId[]
  readonly skippedPersonIds: readonly StableId[]
  readonly issues: readonly ArchiveImportIssue[]
  readonly identity: ArchiveImportIdentityOutcome
  readonly invalidation: InvalidationToken
}

/** Erase is deliberate. The confirmation is part of the request, not a flag. */
export interface ArchiveEraseRequest {
  readonly confirmation: 'erase-this-archive'
}

export interface ArchiveEraseResult {
  readonly outcome: 'erased'
  readonly invalidation: InvalidationToken
}

/* -------------------------------------------------------------------------- */
/* Cancellation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The result of asking the core to cancel one active export or import.
 * Requesting cancellation does not settle the awaiting call: that call still
 * receives the core's one definitive outcome, so no durable result becomes
 * unknowable because a view was disposed.
 */
export interface CancellationRequestResult {
  readonly operationId: OperationId
  readonly outcome: 'requested' | 'not-active'
}
