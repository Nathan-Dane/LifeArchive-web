import type { CountedEntryKind, EntrySectionId } from './recordTypes'
import type {
  CivilDate,
  Instant,
  InvalidationToken,
  Revision,
  RevisionConflict,
  StableId,
  TimeWindow,
} from './types'

/* -------------------------------------------------------------------------- */
/* People                                                                     */
/* -------------------------------------------------------------------------- */

/** Opaque core-owned identifiers remain open to future values. */
export type PersonOtherNameKindId = string
export type PersonReferenceKindId = string

export type PersonLifeStatus = 'notSpecified' | 'living' | 'deceased'
export type PersonDatePrecision = 'year' | 'month' | 'day'

/** A partial civil date. Missing components stay missing at every layer. */
export interface PersonDate {
  readonly precision: PersonDatePrecision
  readonly year: number
  readonly month: number | null
  readonly day: number | null
  readonly approximate: boolean
}

export interface PersonOtherName {
  readonly kindId: PersonOtherNameKindId
  readonly value: string
}

export interface PersonReference {
  readonly kindId: PersonReferenceKindId
  readonly label: string | null
  readonly url: string
}

export interface PersonProfile {
  readonly displayName: string
  /** Ordered, with the primary connection first. */
  readonly connectionLabels: readonly string[]
  readonly about: string | null
  readonly otherNames: readonly PersonOtherName[]
  readonly pronouns: string | null
  readonly pronunciation: string | null
  readonly lifeStatus: PersonLifeStatus
  readonly birthDate: PersonDate | null
  readonly deathDate: PersonDate | null
  readonly references: readonly PersonReference[]
}

export interface Person extends PersonProfile {
  readonly id: StableId
  readonly isArchived: boolean
  readonly createdAtMs: Instant
  readonly updatedAtMs: Instant
  readonly deletedAtMs: Instant | null
  readonly mergedIntoPersonId: StableId | null
}

export interface PersonProfilePhoto {
  readonly id: StableId
  readonly personId: StableId
  readonly fileName: string
  readonly mimeType: string
  readonly sha256: string | null
  readonly byteSize: number
  readonly createdAtMs: Instant
  readonly capturedAtMs: Instant | null
  readonly width: number | null
  readonly height: number | null
}

export interface PersonSnapshot {
  readonly person: Person
  readonly revision: Revision
  readonly profilePhoto: PersonProfilePhoto | null
  readonly lastRecordedContactDate: CivilDate | null
}

export interface PersonListCursor {
  readonly displayName: string
  readonly createdAtMs: Instant
  readonly personId: StableId
}

export interface PersonCreateRequest {
  readonly newPersonId: StableId
  readonly profile: PersonProfile
  readonly nowMs: Instant
}

export interface PersonSaveRequest {
  readonly id: StableId
  readonly expectedRevision: Revision
  readonly profile: PersonProfile
  readonly isArchived: boolean
  readonly nowMs: Instant
}

export type PersonMutationResult =
  | {
      readonly outcome: 'created' | 'updated' | 'unchanged'
      readonly current: PersonSnapshot
      readonly invalidation: InvalidationToken
    }
  | {
      readonly outcome: 'conflict'
      readonly conflict: RevisionConflict<PersonSnapshot>
    }

export interface PersonLoadResult {
  readonly current: PersonSnapshot
  readonly invalidation: InvalidationToken
}

export interface PersonListRequest {
  readonly query: string | null
  readonly includeArchived: boolean
  readonly limit: number
  readonly after: PersonListCursor | null
}

export interface PersonListPage {
  readonly people: readonly PersonSnapshot[]
  readonly hasMore: boolean
  readonly nextCursor: PersonListCursor | null
  readonly invalidation: InvalidationToken
}

export type PersonInteractionLevel = 'none' | 'brief' | 'timeTogether'
export type PersonRecordRole =
  | 'brief'
  | 'involved'
  | 'activity'
  | 'central'
  | 'inPeriod'
  | 'legacyIncluded'
  | 'legacyTogether'
  | 'legacyAbout'
export type CurrentOrdinaryPersonRole =
  'brief' | 'involved' | 'activity' | 'central'

export interface PersonMemorySummary {
  readonly entryId: StableId
  readonly entryType: CountedEntryKind
  readonly civilStartDate: CivilDate
  readonly civilEndDate: CivilDate | null
  readonly title: string | null
  readonly hasWriting: boolean
  readonly roleId: PersonRecordRole
}

export interface PersonMemoriesRequest {
  readonly personId: StableId
  readonly limit: number
  readonly before: PersonMemorySummary | null
}

export interface PersonMemoriesPage {
  readonly memories: readonly PersonMemorySummary[]
  readonly hasMore: boolean
  readonly invalidation: InvalidationToken
}

export interface PersonContactSummary {
  readonly lastRecordedContactDate: CivilDate | null
  readonly current30DayContactDays: number
  readonly previous30DayContactDays: number
  readonly current30DaySubstantialInteractionDays: number
}

export interface PersonContactSummaryRequest {
  readonly personId: StableId
  readonly asOfDate: CivilDate
}

export interface PersonContactSummaryResult {
  readonly summary: PersonContactSummary
  readonly invalidation: InvalidationToken
}

export type PersonContactHistoryRange = 'thirtyDays' | 'sixMonths' | 'all'

export interface PersonContactDay {
  readonly date: CivilDate
  readonly roleId: PersonRecordRole
  readonly memories: readonly PersonMemorySummary[]
}

export interface PersonContactPeriodSummary {
  readonly startDate: CivilDate
  readonly endDate: CivilDate
  readonly contactDays: number
  readonly substantialInteractionDays: number
}

export interface PersonContactHistoryRequest {
  readonly personId: StableId
  readonly asOfDate: CivilDate
  readonly range: PersonContactHistoryRange
  readonly limit: number
  readonly beforeDate: CivilDate | null
}

export interface PersonContactHistoryPage {
  readonly days: readonly PersonContactDay[]
  readonly hasMore: boolean
  readonly totalContactDays: number
  readonly totalSubstantialInteractionDays: number
  readonly periodSummaries: readonly PersonContactPeriodSummary[]
  readonly invalidation: InvalidationToken
}

export interface PersonLogContactRequest {
  readonly personId: StableId
  readonly roleId: CurrentOrdinaryPersonRole
  readonly day: TimeWindow
  readonly newEntryId: StableId
  readonly nowMs: Instant
}

export interface PersonPhotoImportRequest {
  readonly personId: StableId
  readonly expectedRevision: Revision
  readonly newPhotoId: StableId
  readonly fileName: string
  readonly mimeType: string
  readonly bytes: ArrayBuffer
  readonly createdAtMs: Instant
  readonly capturedAtMs: Instant | null
  readonly width: number | null
  readonly height: number | null
}

export interface PersonPhotoRemoveRequest {
  readonly personId: StableId
  readonly expectedRevision: Revision
  readonly nowMs: Instant
}

export type PersonPhotoMutationResult =
  | {
      readonly outcome: 'set' | 'replaced' | 'removed' | 'unchanged'
      readonly current: PersonSnapshot
      readonly invalidation: InvalidationToken
    }
  | {
      readonly outcome: 'conflict'
      readonly conflict: RevisionConflict<PersonSnapshot>
    }

export type PersonMergeProfileSource = 'retained' | 'duplicate'
export type PersonMergeAboutSource = 'retained' | 'duplicate' | 'combined'
export type PersonMergePhotoSource = 'retained' | 'duplicate' | 'none'

export interface PersonMergeRequest {
  readonly retainedPersonId: StableId
  readonly duplicatePersonId: StableId
  readonly expectedRetainedRevision: Revision
  readonly expectedDuplicateRevision: Revision
  readonly displayNameSource: PersonMergeProfileSource
  readonly aboutSource: PersonMergeAboutSource
  readonly photoSource: PersonMergePhotoSource
  readonly nowMs: Instant
}

export type PersonMergeResult =
  | {
      readonly outcome: 'merged'
      readonly current: PersonSnapshot
      readonly mergedPersonId: StableId
      readonly invalidation: InvalidationToken
    }
  | {
      readonly outcome: 'conflict'
      readonly conflict: RevisionConflict<PersonSnapshot> & {
        /** The retained or duplicate Person whose revision was stale. */
        readonly personId: StableId
      }
    }

export interface PersonDeleteRequest {
  readonly personId: StableId
  readonly expectedRevision: Revision
  readonly nowMs: Instant
}

export type PersonDeleteResult =
  | {
      readonly outcome: 'deleted'
      readonly current: PersonSnapshot
      readonly invalidation: InvalidationToken
    }
  | {
      readonly outcome: 'conflict'
      readonly conflict: RevisionConflict<PersonSnapshot>
    }

export interface PersonLinkDraft {
  readonly personId: StableId
  readonly roleId: PersonRecordRole
}

export interface EntryPersonLink {
  readonly entryId: StableId
  readonly personId: StableId
  readonly roleId: PersonRecordRole
  readonly interactionLevel: PersonInteractionLevel
  readonly tookPart: boolean
  readonly isSubject: boolean
  readonly opaqueLegacyRoleId: string | null
  readonly position: number
}

export interface LinkedPersonSnapshot {
  readonly link: EntryPersonLink
  readonly person: Person
  readonly personRevision: Revision
  readonly profilePhoto: PersonProfilePhoto | null
}

export interface EntryPeopleSnapshot {
  readonly entryId: StableId
  readonly entryRevision: Revision
  readonly sectionIds: readonly EntrySectionId[]
  readonly peopleSectionVisible: boolean
  readonly links: readonly LinkedPersonSnapshot[]
  readonly availableRoles: readonly PersonRecordRole[]
}

export type RecordPeopleTarget =
  | { readonly kind: 'entry'; readonly entryId: StableId }
  | { readonly kind: 'ordinary'; readonly window: TimeWindow }

export interface RecordPeopleLoadRequest {
  readonly target: RecordPeopleTarget
}

export type RecordPeopleLoadResult =
  | {
      readonly outcome: 'absent'
      readonly availableRoles: readonly PersonRecordRole[]
      readonly current: null
      readonly invalidation: InvalidationToken
    }
  | {
      readonly outcome: 'loaded'
      readonly availableRoles: readonly PersonRecordRole[]
      readonly current: EntryPeopleSnapshot
      readonly invalidation: InvalidationToken
    }

export type RecordPeopleMutation =
  | { readonly kind: 'addSection'; readonly sectionId: EntrySectionId }
  | { readonly kind: 'addLinks'; readonly links: readonly PersonLinkDraft[] }
  | {
      readonly kind: 'replaceLinks'
      readonly links: readonly PersonLinkDraft[]
    }
  | { readonly kind: 'upsertLink'; readonly link: PersonLinkDraft }
  | { readonly kind: 'removePeople'; readonly personIds: readonly StableId[] }
  | { readonly kind: 'clearLinks' }
  | { readonly kind: 'removeSection'; readonly sectionId: EntrySectionId }

export interface RecordPeopleMutationRequest {
  readonly target: RecordPeopleTarget
  readonly expectedRevision: Revision | null
  readonly newEntryId: StableId | null
  readonly mutation: RecordPeopleMutation
  readonly nowMs: Instant
}

export type RecordPeopleMutationResult =
  | {
      readonly outcome: 'created' | 'updated' | 'unchanged' | 'unchangedAbsent'
      readonly current: EntryPeopleSnapshot | null
      readonly invalidation: InvalidationToken
    }
  | {
      readonly outcome: 'conflict'
      readonly conflict: RevisionConflict<EntryPeopleSnapshot>
    }
