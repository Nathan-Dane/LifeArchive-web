import { useId, useState } from 'react'
import { civilDate, isCivilDate } from '../../../core/client'
import { failureMessage, useLocalisation, useTranslate } from '../../../i18n'
import type { EventEditor } from './useEventEditor'
import { TrackChooser, type Tracks } from '../tracks'
import { RecordTagPicker, SemanticIconPicker } from '../metadata'

export function EventDetails({
  event,
  tracks,
}: {
  readonly event: EventEditor
  readonly tracks?: Tracks
}) {
  const t = useTranslate()
  const localisation = useLocalisation()
  const headingId = useId()
  const titleId = useId()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const draft = event.draft
  if (!draft) return null

  const createReady =
    draft.title.length > 0 && draft.iconId.length > 0 && isCivilDate(draft.date)

  return (
    <section className="record-details" aria-labelledby={headingId}>
      <header className="record-details__head">
        <h2 id={headingId} className="ui-heading">
          {t('record.details.title')}
        </h2>
      </header>

      {event.failure ? (
        <p className="record-details__failure" role="alert">
          {failureMessage(localisation, event.failure)}
        </p>
      ) : null}

      <section className="record-details__section">
        <h3 className="eyebrow">{t('record.details.identity')}</h3>
        <div className="record-details__field">
          <label className="meta-text" htmlFor={titleId}>
            {t('record.event.titleAndIcon')}
          </label>
          <div className="record-details__identity">
            <SemanticIconPicker
              value={draft.iconId}
              disabled={event.status === 'saving'}
              onChange={(iconId) => event.update({ iconId })}
            />
            <input
              id={titleId}
              value={draft.title}
              onChange={(eventValue) =>
                event.update({ title: eventValue.currentTarget.value })
              }
            />
          </div>
        </div>
      </section>

      <section className="record-details__section">
        <h3 className="eyebrow">{t('record.details.time')}</h3>
        <label className="record-details__field">
          <span className="meta-text">{t('record.event.date')}</span>
          <input
            type="date"
            value={draft.date}
            onChange={(eventValue) =>
              event.update({ date: eventValue.currentTarget.value })
            }
          />
        </label>
        <p className="record-details__hint meta-text">
          {t('record.event.noTimeOfDay')}
        </p>
      </section>

      <section className="record-details__section">
        <h3 className="eyebrow">{t('record.details.organisation')}</h3>
        <label className="record-details__field">
          <span className="meta-text">{t('record.event.track')}</span>
          {tracks ? (
            <TrackChooser
              tracks={tracks}
              value={draft.trackId}
              date={isCivilDate(draft.date) ? civilDate(draft.date) : undefined}
              disabled={event.status === 'saving'}
              onChange={(trackId) => {
                if (event.creating) {
                  event.update({ trackId: trackId ?? '' })
                } else {
                  void event.changeTrack(trackId)
                }
              }}
            />
          ) : (
            <span>{t('record.event.noTrack')}</span>
          )}
        </label>
        <RecordTagPicker
          tags={{
            ordered: draft.tagIds,
            display: draft.displayTagId || null,
          }}
          disabled={event.status === 'saving'}
          onChange={(tags) =>
            event.update({
              tagIds: tags.ordered,
              displayTagId: tags.display ?? '',
            })
          }
        />
      </section>

      {event.creating ? (
        <div className="record-details__actions">
          <button
            type="button"
            className="button"
            disabled={!createReady || event.status === 'saving'}
            onClick={() => void event.create()}
          >
            {t('record.event.create')}
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={event.cancelCreate}
          >
            {t('record.event.cancel')}
          </button>
        </div>
      ) : confirmingDelete ? (
        <div className="record-details__delete-confirm" role="alert">
          <p>{t('record.event.deleteConfirm')}</p>
          <div className="record-details__actions">
            <button
              type="button"
              className="button button--destructive"
              onClick={() => void event.deleteEvent()}
            >
              {t('record.event.confirmDelete')}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setConfirmingDelete(false)}
            >
              {t('record.event.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="record-details__delete"
          onClick={() => setConfirmingDelete(true)}
        >
          {t('record.event.delete')}
        </button>
      )}
    </section>
  )
}
