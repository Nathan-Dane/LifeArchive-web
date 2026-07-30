import { useId } from 'react'
import { useFormat, useTranslate } from '../../../i18n'
import { RecordSemanticIcon } from '../events'
import { displayAccentClassName, RecordTagBadge } from '../metadata'
import type { Tracks } from './useTracks'

export function TrackHistory({
  tracks,
  showHeader = true,
}: {
  readonly tracks: Tracks
  readonly showHeader?: boolean
}) {
  const t = useTranslate()
  const format = useFormat()
  const headingId = useId()
  const track = tracks.state.selected
  if (!track) return null
  return (
    <section
      className="record-track-history"
      aria-labelledby={showHeader ? headingId : undefined}
      aria-label={!showHeader ? t('record.track.contained') : undefined}
    >
      {showHeader ? (
        <header>
          <h2 id={headingId}>{track.name}</h2>
          <p>{t('record.track.history')}</p>
        </header>
      ) : null}
      {tracks.state.history.length === 0 ? (
        <p>{t('record.track.historyEmpty')}</p>
      ) : (
        <ol>
          {tracks.state.history.map((member) => (
            <li
              key={member.id}
              data-member-kind={member.kind}
              data-display-tag-id={member.displayTagId ?? undefined}
              className={displayAccentClassName(member.displayTagId)}
            >
              <RecordSemanticIcon id={member.iconId} />
              <span>
                <strong>{member.title}</strong>
                <span>
                  {member.kind === 'event'
                    ? format.civilDate(member.primaryDate)
                    : member.endDate
                      ? format.civilDateRange(
                          member.primaryDate,
                          member.endDate,
                        )
                      : t('record.objects.spanOngoingRange', {
                          start: format.civilDate(member.primaryDate),
                        })}
                </span>
                {member.kind === 'span' &&
                (member.beginMarkerTitleOverride ||
                  member.endMarkerTitleOverride) ? (
                  <span className="meta-text">
                    {t('record.track.markerPreview', {
                      titles: [
                        member.beginMarkerTitleOverride,
                        member.endMarkerTitleOverride,
                      ]
                        .filter((title): title is string => title !== null)
                        .join(' · '),
                    })}
                  </span>
                ) : null}
                {member.displayTagId ? (
                  <RecordTagBadge id={member.displayTagId} display />
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      )}
      {tracks.state.nextCursor ? (
        <button
          type="button"
          className="button button--secondary"
          onClick={() => void tracks.loadMore()}
        >
          {t('record.track.loadMore')}
        </button>
      ) : null}
    </section>
  )
}
