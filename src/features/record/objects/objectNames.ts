/**
 * Naming one structured object.
 *
 * Two names are needed and they are not the same name. Sighted readers see a
 * compact tab — a kind and a truncated title — while a screen reader needs the
 * whole thing said once: which kind of object it is, what it is called, and
 * when it sits. Duplicate titles are allowed and several Events may share a
 * date, so the spoken name carries the dates rather than leaving a row of
 * identical labels.
 *
 * Every date here is spelled by `format.ts` from a civil date the core placed
 * on the object. An absent Span end is genuine archive data and is presented
 * as Present; no interval is invented to stand in for it.
 */

import type { StructuredSummary } from '../../../core/client'
import type { AppLocalisation, Formatters } from '../../../i18n'

/** The civil dates of one object, as one phrase. */
export function objectWhen(
  localisation: AppLocalisation,
  format: Formatters,
  object: StructuredSummary,
): string {
  const placement = object.placement
  if (placement.kind === 'event') return format.civilDate(placement.date)
  return placement.endDate === null
    ? localisation.t('record.objects.spanOngoingRange', {
        start: format.civilDate(placement.startDate),
      })
    : format.civilDateRange(placement.startDate, placement.endDate)
}

/** The complete spoken name of one object: kind, title, and civil dates. */
export function objectName(
  localisation: AppLocalisation,
  format: Formatters,
  object: StructuredSummary,
): string {
  const placement = object.placement
  if (placement.kind === 'event') {
    return localisation.t('record.objects.eventName', {
      title: object.title,
      date: format.civilDate(placement.date),
    })
  }
  return placement.endDate === null
    ? localisation.t('record.objects.spanOngoingName', {
        title: object.title,
        start: format.civilDate(placement.startDate),
      })
    : localisation.t('record.objects.spanName', {
        title: object.title,
        start: format.civilDate(placement.startDate),
        end: format.civilDate(placement.endDate),
      })
}
