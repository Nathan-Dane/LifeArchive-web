import type { LinkedPersonSnapshot, PersonLinkDraft } from '../../core/client'

export type RecordPersonRole = 'included' | 'brief' | 'together' | 'about'

/** One visual group per Person. Legacy compound links use a stable priority. */
export function displayRole(linked: LinkedPersonSnapshot): RecordPersonRole {
  if (linked.link.isSubject) return 'about'
  if (linked.link.interactionLevel === 'timeTogether') return 'together'
  if (linked.link.interactionLevel === 'brief') return 'brief'
  return 'included'
}

/** Preserve core order within each role-weighted presentation group. */
export function groupRecordPeople(
  links: readonly LinkedPersonSnapshot[],
): Record<RecordPersonRole, readonly LinkedPersonSnapshot[]> {
  const groups: Record<RecordPersonRole, LinkedPersonSnapshot[]> = {
    included: [],
    brief: [],
    together: [],
    about: [],
  }
  for (const linked of links) groups[displayRole(linked)].push(linked)
  return groups
}

/**
 * Map the four mutually-exclusive presentation states onto core's durable
 * link fields. Choosing the selected state is idempotent and always clears
 * the other three state representations.
 */
export function toggleRecordPersonRole(
  link: PersonLinkDraft,
  role: RecordPersonRole,
): PersonLinkDraft {
  switch (role) {
    case 'included':
      return {
        ...link,
        interactionLevel: 'none',
        tookPart: true,
        isSubject: false,
      }
    case 'brief':
      return {
        ...link,
        interactionLevel: 'brief',
        tookPart: false,
        isSubject: false,
      }
    case 'together':
      return {
        ...link,
        interactionLevel: 'timeTogether',
        tookPart: false,
        isSubject: false,
      }
    case 'about':
      return {
        ...link,
        interactionLevel: 'none',
        tookPart: false,
        isSubject: true,
      }
  }
}

export function recordPersonRoleSelected(
  link: PersonLinkDraft | null,
  role: RecordPersonRole,
): boolean {
  if (!link) return false
  if (link.isSubject) return role === 'about'
  if (link.interactionLevel === 'timeTogether') return role === 'together'
  if (link.interactionLevel === 'brief') return role === 'brief'
  return role === 'included'
}
