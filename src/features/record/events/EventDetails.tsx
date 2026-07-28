import { useId, useState } from 'react'
import { isCivilDate, isStableId } from '../../../core/client'
import { failureMessage, useLocalisation, useTranslate } from '../../../i18n'
import { RecordSemanticIcon } from './RecordSemanticIcon'
import type { EventEditor } from './useEventEditor'

export function EventDetails({ event }: { readonly event: EventEditor }) {
  const t = useTranslate()
  const localisation = useLocalisation()
  const headingId = useId()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const draft = event.draft
  if (!draft) return null

  const trackValid = draft.trackId.length === 0 || isStableId(draft.trackId)
  const createReady =
    draft.title.length > 0 &&
    draft.iconId.length > 0 &&
    isCivilDate(draft.date) &&
    trackValid

  return (
    <section className="record-details" aria-labelledby={headingId}>
      <header className="record-details__head">
        <h2 id={headingId} className="title">
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
        <label className="record-details__field">
          <span className="meta-text">{t('record.event.titleAndIcon')}</span>
          <span className="record-details__identity">
            <RecordSemanticIcon
              id={draft.iconId}
              className="record-details__icon"
            />
            <input
              value={draft.title}
              onChange={(eventValue) =>
                event.update({ title: eventValue.currentTarget.value })
              }
            />
          </span>
        </label>
        <label className="record-details__field">
          <span className="meta-text">{t('record.event.semanticIcon')}</span>
          <input
            value={draft.iconId}
            onChange={(eventValue) =>
              event.update({ iconId: eventValue.currentTarget.value })
            }
          />
        </label>
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
          <input
            value={draft.trackId}
            aria-invalid={!trackValid || undefined}
            placeholder={t('record.event.noTrack')}
            onChange={(eventValue) =>
              event.update({ trackId: eventValue.currentTarget.value })
            }
          />
        </label>
        <label className="record-details__field">
          <span className="meta-text">{t('record.event.tags')}</span>
          <input
            value={draft.tagIds.join(', ')}
            placeholder={t('record.event.noTags')}
            onChange={(eventValue) =>
              event.update({
                tagIds: eventValue.currentTarget.value
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter((tag) => tag.length > 0),
              })
            }
          />
        </label>
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
