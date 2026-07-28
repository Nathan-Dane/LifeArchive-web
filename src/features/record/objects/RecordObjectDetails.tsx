/**
 * The details of whatever is selected.
 *
 * It describes one thing: the ordinary entry of the window on screen, or the
 * exact structured object selected in the row above the writing surface. It
 * is a second view of the one destination, never a second way to choose one,
 * so there are no controls here that change what is selected and no menus.
 *
 * Every date it shows is spelled from a civil date the core produced, and a
 * Span with no end is presented as Present rather than given a derived end.
 * The complete metadata card — icons, ordered tags, Track — arrives with the
 * step that owns those presentations.
 */

import { useId } from 'react'
import type { TimeScale, TimeWindow } from '../../../core/client'
import { useFormat, useLocalisation } from '../../../i18n'
import { civilLocation } from '../civilLocation'
import { objectWhen } from './objectNames'
import type { RecordObjects } from './recordObjects'

const SCALE_LABEL = {
  day: 'record.objects.ordinaryDay',
  week: 'record.objects.ordinaryWeek',
  month: 'record.objects.ordinaryMonth',
  year: 'record.objects.ordinaryYear',
} as const satisfies Record<TimeScale, string>

export interface RecordObjectDetailsProps {
  readonly scale: TimeScale
  readonly window: TimeWindow | null
  readonly objects: RecordObjects
}

export function RecordObjectDetails({
  scale,
  window,
  objects,
}: RecordObjectDetailsProps) {
  const localisation = useLocalisation()
  const t = localisation.t
  const format = useFormat()
  const headingId = useId()
  const selected = objects.state.selected

  return (
    <section className="record-details" aria-labelledby={headingId}>
      <p className="eyebrow">
        {t(
          selected === null
            ? 'record.objects.detailsOrdinary'
            : selected.placement.kind === 'event'
              ? 'record.objects.kindEvent'
              : 'record.objects.kindSpan',
        )}
      </p>
      <h2 id={headingId} className="title">
        {selected === null ? t(SCALE_LABEL[scale]) : selected.title}
      </h2>
      <dl className="record-details__facts">
        <div className="record-details__fact">
          <dt className="meta-text">{t('record.objects.detailsWhen')}</dt>
          <dd>
            {selected === null
              ? window
                ? civilLocation(format, window)
                : t('record.objects.detailsNoWindow')
              : objectWhen(localisation, format, selected)}
          </dd>
        </div>
        {selected === null ? null : (
          <div className="record-details__fact">
            <dt className="meta-text">
              {t('record.objects.detailsIdentifier')}
            </dt>
            {/*
              The exact stable ID, unmodified. It is the only thing that tells
              two objects with the same title and date apart, so it is shown as
              the core spelled it rather than shortened or re-cased.
            */}
            <dd className="record-details__identifier">{selected.id}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}
