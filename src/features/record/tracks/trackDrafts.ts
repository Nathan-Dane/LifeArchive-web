import {
  civilDate,
  isCivilDate,
  type CivilDate,
  type PrivacyLevel,
  type StructuredDraft,
  type StructuredKind,
  type Track,
  type TrackDraft,
} from '../../../core/client'

export interface TrackDraftFields {
  readonly name: string
  readonly iconId: string
  readonly suggestedTagId: string
  readonly isArchived: boolean
}

export interface TrackMemberDraftFields {
  readonly kind: StructuredKind
  readonly title: string
  readonly markdown: string
  readonly date: string
  readonly endDate: string
  readonly ongoing: boolean
  readonly beginMarkerEnabled: boolean
  readonly beginMarkerTitle: string
  readonly endMarkerEnabled: boolean
  readonly endMarkerTitle: string
  readonly iconId: string
  readonly tagIds: readonly string[]
  readonly displayTagId: string
  readonly tagStateOmitted: boolean
  readonly privacy: PrivacyLevel
}

export function emptyTrackDraft(): TrackDraftFields {
  return {
    name: '',
    iconId: 'life-track',
    suggestedTagId: '',
    isArchived: false,
  }
}

export function fieldsFromTrack(track: Track): TrackDraftFields {
  return {
    name: track.name,
    iconId: track.iconId,
    suggestedTagId: track.suggestedTagId ?? '',
    isArchived: track.isArchived,
  }
}

export function trackDraft(fields: TrackDraftFields): TrackDraft | null {
  if (fields.iconId.length === 0) return null
  return {
    name: fields.name,
    iconId: fields.iconId,
    suggestedTagId:
      fields.suggestedTagId.length > 0 ? fields.suggestedTagId : null,
    isArchived: fields.isArchived,
  }
}

export function emptyMemberDraft(
  date: CivilDate,
  track: TrackDraftFields,
): TrackMemberDraftFields {
  return {
    kind: 'event',
    title: '',
    markdown: '',
    date,
    endDate: '',
    ongoing: true,
    beginMarkerEnabled: false,
    beginMarkerTitle: '',
    endMarkerEnabled: false,
    endMarkerTitle: '',
    iconId: track.iconId,
    tagIds: [],
    displayTagId: '',
    tagStateOmitted: true,
    privacy: 'normal',
  }
}

export function memberDraft(
  fields: TrackMemberDraftFields,
): StructuredDraft | null {
  if (
    !isCivilDate(fields.date) ||
    (fields.kind === 'span' &&
      !fields.ongoing &&
      !isCivilDate(fields.endDate)) ||
    fields.iconId.length === 0
  ) {
    return null
  }
  const ordered = [...fields.tagIds]
  const display =
    fields.displayTagId.length > 0 && ordered.includes(fields.displayTagId)
      ? fields.displayTagId
      : (ordered[0] ?? null)
  return {
    title: fields.title,
    markdown: fields.markdown,
    placement:
      fields.kind === 'event'
        ? { kind: 'event', date: civilDate(fields.date) }
        : {
            kind: 'span',
            startDate: civilDate(fields.date),
            endDate: fields.ongoing ? null : civilDate(fields.endDate),
            beginMarker: {
              enabled: fields.beginMarkerEnabled,
              titleOverride:
                fields.beginMarkerEnabled && fields.beginMarkerTitle.length > 0
                  ? fields.beginMarkerTitle
                  : null,
            },
            endMarker: {
              enabled: fields.endMarkerEnabled,
              titleOverride:
                fields.endMarkerEnabled && fields.endMarkerTitle.length > 0
                  ? fields.endMarkerTitle
                  : null,
            },
          },
    iconId: fields.iconId,
    tags: { ordered, display },
    trackId: null,
    privacy: fields.privacy,
  }
}
