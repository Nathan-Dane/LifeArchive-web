import type {
  LinkedPersonSnapshot,
  PersonLinkDraft,
  PersonRecordRole,
} from '../../core/client'

export type RecordPersonRole = PersonRecordRole

export interface RecordPeopleGroups {
  readonly significant: readonly LinkedPersonSnapshot[]
  readonly involved: readonly LinkedPersonSnapshot[]
  readonly brief: readonly LinkedPersonSnapshot[]
  readonly neutral: readonly LinkedPersonSnapshot[]
}

/** The durable Rust role identity is the only source of presentation meaning. */
export function displayRole(linked: LinkedPersonSnapshot): RecordPersonRole {
  return linked.link.roleId
}

/** Preserve core link order inside the existing lightweight visual groups. */
export function groupRecordPeople(
  links: readonly LinkedPersonSnapshot[],
): RecordPeopleGroups {
  return {
    significant: links.filter(({ link }) =>
      ['activity', 'central', 'legacyTogether', 'legacyAbout'].includes(
        link.roleId,
      ),
    ),
    involved: links.filter(({ link }) => link.roleId === 'involved'),
    brief: links.filter(({ link }) => link.roleId === 'brief'),
    neutral: links.filter(({ link }) =>
      ['inPeriod', 'legacyIncluded'].includes(link.roleId),
    ),
  }
}

/** Replace one association with exactly one active Rust role identity. */
export function toggleRecordPersonRole(
  link: PersonLinkDraft,
  role: RecordPersonRole,
): PersonLinkDraft {
  return { ...link, roleId: role }
}

export function recordPersonRoleSelected(
  link: PersonLinkDraft | null,
  role: RecordPersonRole,
): boolean {
  return link?.roleId === role
}
