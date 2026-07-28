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
import type { CivilDate, TimeScale, TimeWindow } from '../../../core/client'
import { useFormat, useLocalisation } from '../../../i18n'
import { civilLocation } from '../civilLocation'
import { EventDetails, type EventEditor } from '../events'
import { SpanDetails, type SpanEditor } from '../spans'
import { TrackDetails, type Tracks } from '../tracks'
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
  readonly date?: CivilDate | null
  readonly objects: RecordObjects
  readonly event?: EventEditor
  readonly span?: SpanEditor
  readonly tracks?: Tracks
}

export function RecordObjectDetails({
  scale,
  window,
  date = null,
  objects,
  event,
  span,
  tracks,
}: RecordObjectDetailsProps) {
  const localisation = useLocalisation()
  const t = localisation.t
  const format = useFormat()
  const headingId = useId()
  const selected = objects.state.selected
  if (tracks?.active) {
    return (
      <TrackDetails
        key={tracks.state.creating ? 'new-track' : tracks.state.selected?.id}
        tracks={tracks}
        date={date}
      />
    )
  }

  if (event && (event.creating || selected?.placement.kind === 'event')) {
    return <EventDetails event={event} tracks={tracks} />
  }
  if (span && (span.creating || selected?.placement.kind === 'span')) {
    return <SpanDetails span={span} tracks={tracks} />
  }

  return (
    <section className="record-details" aria-labelledby={headingId}>
      <header className="record-details__head">
        <h2 id={headingId} className="title">
          {t('record.details.title')}
        </h2>
      </header>
      <section className="record-details__section">
        <h3 className="eyebrow">{t('record.details.identity')}</h3>
        <p className="record-details__value">
          {selected === null ? t(SCALE_LABEL[scale]) : selected.title}
        </p>
        {selected === null ? null : (
          <p className="record-details__identifier">{selected.id}</p>
        )}
      </section>
      <section className="record-details__section">
        <h3 className="eyebrow">{t('record.details.time')}</h3>
        <p className="record-details__value">
          {selected === null
            ? window
              ? civilLocation(format, window)
              : t('record.objects.detailsNoWindow')
            : objectWhen(localisation, format, selected)}
        </p>
      </section>
    </section>
  )
}
