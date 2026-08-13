import type { LinkedPersonSnapshot, PersonLinkDraft } from '../../core/client'

export type RecordPersonRole = 'included' | 'brief' | 'together' | 'about'

/** One visual group per Person, while the underlying context stays lossless. */
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
 * Map the four presentation controls onto the three independent durable
 * dimensions. Brief and Together share the interaction enum; participation
 * and subject context never overwrite it or one another.
 */
export function toggleRecordPersonRole(
  link: PersonLinkDraft,
  role: RecordPersonRole,
): PersonLinkDraft {
  switch (role) {
    case 'included':
      return { ...link, tookPart: !link.tookPart }
    case 'brief':
      return {
        ...link,
        interactionLevel: link.interactionLevel === 'brief' ? 'none' : 'brief',
      }
    case 'together':
      return {
        ...link,
        interactionLevel:
          link.interactionLevel === 'timeTogether' ? 'none' : 'timeTogether',
      }
    case 'about':
      return { ...link, isSubject: !link.isSubject }
  }
}

export function recordPersonRoleSelected(
  link: PersonLinkDraft | null,
  role: RecordPersonRole,
): boolean {
  if (!link) return false
  switch (role) {
    case 'included':
      return link.tookPart
    case 'brief':
      return link.interactionLevel === 'brief'
    case 'together':
      return link.interactionLevel === 'timeTogether'
    case 'about':
      return link.isSubject
  }
}
