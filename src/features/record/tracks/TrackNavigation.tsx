import type { CivilDate } from '../../../core/client'
import { failureMessage, useLocalisation } from '../../../i18n'
import { RecordSemanticIcon } from '../events'
import type { Tracks } from './useTracks'

export function TrackNavigation({
  tracks,
  date,
}: {
  readonly tracks: Tracks
  readonly date: CivilDate | null
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  return (
    <section className="record-tracks" aria-labelledby="record-tracks-heading">
      <header className="record-tracks__heading">
        <h3 id="record-tracks-heading">{t('record.track.heading')}</h3>
        <button
          type="button"
          className="record-tracks__new"
          disabled={!date}
          onClick={() => {
            if (date) tracks.startCreate(date)
          }}
        >
          {t('record.track.new')}
        </button>
      </header>
      <label className="record-tracks__archived">
        <input
          type="checkbox"
          checked={tracks.state.includeArchived}
          onChange={(event) =>
            tracks.setIncludeArchived(event.currentTarget.checked)
          }
        />
        <span>{t('record.track.showArchived')}</span>
      </label>
      <div className="record-tracks__list">
        {tracks.state.tracks.length === 0 ? (
          <p>{t('record.track.empty')}</p>
        ) : (
          tracks.state.tracks.map((summary) => (
            <button
              type="button"
              key={summary.track.id}
              className="record-tracks__item"
              aria-pressed={summary.track.id === tracks.state.selected?.id}
              onClick={() => tracks.select(summary)}
            >
              <RecordSemanticIcon
                id={summary.track.iconId}
                className="record-tracks__icon"
              />
              <span>
                <span>{summary.track.name}</span>
                <span className="meta-text">
                  {t('record.track.memberCount', {
                    count: summary.memberCount,
                  })}
                  {summary.track.isArchived
                    ? ` · ${t('record.track.archived')}`
                    : ''}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
      {tracks.state.status === 'failed' && tracks.state.failure ? (
        <div className="record-tracks__failure" role="alert">
          <p>{failureMessage(localisation, tracks.state.failure)}</p>
          {tracks.state.failure.retryable ? (
            <button type="button" className="button" onClick={tracks.retry}>
              {t('app.action.retry')}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
