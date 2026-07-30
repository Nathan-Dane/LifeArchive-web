import { useId, useRef, useState } from 'react'
import { civilDate, isCivilDate } from '../../../core/client'
import { failureMessage, useLocalisation, useTranslate } from '../../../i18n'
import type { SpanEditor } from './useSpanEditor'
import { TrackChooser, type Tracks } from '../tracks'
import {
  RecordDatePicker,
  RecordTagPicker,
  SemanticIconPicker,
} from '../metadata'

export function SpanDetails({
  span,
  tracks,
}: {
  readonly span: SpanEditor
  readonly tracks?: Tracks
}) {
  const t = useTranslate()
  const localisation = useLocalisation()
  const headingId = useId()
  const titleId = useId()
  const datePair = useRef<HTMLDivElement>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingConversion, setConfirmingConversion] = useState(false)
  const [conversionDate, setConversionDate] = useState('')
  const draft = span.draft
  if (!draft) return null

  const rangeReady =
    isCivilDate(draft.startDate) &&
    (draft.ongoing || isCivilDate(draft.endDate))
  const createReady =
    draft.title.length > 0 && draft.iconId.length > 0 && rangeReady && true
  const conversionReady = isCivilDate(conversionDate)

  return (
    <section className="record-details" aria-labelledby={headingId}>
      <header className="record-details__head">
        <h2 id={headingId} className="ui-heading">
          {t('record.details.title')}
        </h2>
      </header>

      {span.failure ? (
        <p className="record-details__failure" role="alert">
          {failureMessage(localisation, span.failure)}
        </p>
      ) : null}
      {span.movedRange ? (
        <div className="record-details__notice" role="status">
          <p>{t('record.span.movedRange')}</p>
          <button
            type="button"
            className="button button--secondary"
            onClick={span.dismissMovedRange}
          >
            {t('record.span.dismissMovedRange')}
          </button>
        </div>
      ) : null}

      <section className="record-details__section">
        <h3 className="eyebrow">{t('record.details.identity')}</h3>
        <div className="record-details__field">
          <label
            className="record-details__label-line meta-text"
            htmlFor={titleId}
          >
            {t('record.span.titleAndIcon')}
          </label>
          <div className="record-details__identity">
            <SemanticIconPicker
              value={draft.iconId}
              disabled={span.status === 'saving'}
              onChange={(iconId) => span.update({ iconId })}
            />
            <input
              id={titleId}
              value={draft.title}
              onChange={(event) =>
                span.update({ title: event.currentTarget.value })
              }
            />
          </div>
        </div>
      </section>

      <section className="record-details__section">
        <h3 className="eyebrow">{t('record.details.time')}</h3>
        <div ref={datePair} className="record-details__date-pair">
          <div className="record-details__field">
            <span className="record-details__label-line meta-text">
              {t('record.span.startDate')}
            </span>
            <RecordDatePicker
              label={t('record.span.startDate')}
              value={draft.startDate}
              widthRef={datePair}
              disabled={span.status === 'saving'}
              invalid={!isCivilDate(draft.startDate)}
              onChange={(startDate) => span.update({ startDate })}
            />
          </div>
          <div className="record-details__field">
            <span className="record-details__label-line meta-text">
              <span>{t('record.span.endDate')}</span>
              <button
                type="button"
                className="record-details__ongoing"
                aria-pressed={draft.ongoing}
                onClick={() => span.update({ ongoing: !draft.ongoing })}
              >
                {t('record.span.ongoing')}
              </button>
            </span>
            {draft.ongoing ? (
              <div
                className="record-details__present"
                aria-label={t('record.span.present')}
              >
                {t('record.span.present')}
              </div>
            ) : (
              <RecordDatePicker
                label={t('record.span.endDate')}
                value={draft.endDate}
                widthRef={datePair}
                disabled={span.status === 'saving'}
                invalid={!isCivilDate(draft.endDate)}
                onChange={(endDate) => span.update({ endDate })}
              />
            )}
          </div>
        </div>
      </section>

      <section className="record-details__section">
        <h3 className="eyebrow">{t('record.details.organisation')}</h3>
        <label className="record-details__field">
          <span className="record-details__label-line meta-text">
            {t('record.event.track')}
          </span>
          {tracks ? (
            <TrackChooser
              tracks={tracks}
              value={draft.trackId}
              date={
                isCivilDate(draft.startDate)
                  ? civilDate(draft.startDate)
                  : undefined
              }
              disabled={span.status === 'saving'}
              onChange={(trackId, invalidation) => {
                if (span.creating) {
                  span.update({ trackId: trackId ?? '' })
                } else {
                  void span.changeTrack(trackId, invalidation)
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
          disabled={span.status === 'saving'}
          onChange={(tags) =>
            span.update({
              tagIds: tags.ordered,
              displayTagId: tags.display ?? '',
            })
          }
        />
      </section>

      <section className="record-details__section">
        <h3 className="eyebrow">{t('record.span.markers')}</h3>
        <MarkerControl
          boundary="begin"
          enabled={draft.beginMarkerEnabled}
          title={draft.beginMarkerTitle}
          onEnabled={(enabled) => span.update({ beginMarkerEnabled: enabled })}
          onTitle={(title) => span.update({ beginMarkerTitle: title })}
          onReset={() => span.resetMarkerTitle('begin')}
        />
        <MarkerControl
          boundary="end"
          enabled={draft.endMarkerEnabled}
          title={draft.endMarkerTitle}
          onEnabled={(enabled) => span.update({ endMarkerEnabled: enabled })}
          onTitle={(title) => span.update({ endMarkerTitle: title })}
          onReset={() => span.resetMarkerTitle('end')}
        />
        <p className="record-details__hint meta-text">
          {t('record.span.markerDerived')}
        </p>
      </section>

      {span.creating ? (
        <div className="record-details__actions">
          <button
            type="button"
            className="button"
            disabled={!createReady || span.status === 'saving'}
            onClick={() => void span.create()}
          >
            {t('record.span.create')}
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={span.cancelCreate}
          >
            {t('record.event.cancel')}
          </button>
        </div>
      ) : (
        <>
          {confirmingConversion ? (
            <div className="record-details__delete-confirm" role="alert">
              <p>{t('record.span.convertConfirm')}</p>
              <div className="record-details__field">
                <span className="meta-text">
                  {t('record.span.convertDate')}
                </span>
                <RecordDatePicker
                  label={t('record.span.convertDate')}
                  value={conversionDate}
                  invalid={!isCivilDate(conversionDate)}
                  onChange={setConversionDate}
                />
              </div>
              <div className="record-details__actions">
                <button
                  type="button"
                  className="button"
                  disabled={!conversionReady}
                  onClick={() => void span.convertToEvent(conversionDate)}
                >
                  {t('record.span.confirmConvert')}
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setConfirmingConversion(false)}
                >
                  {t('record.event.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                setConversionDate(draft.startDate)
                setConfirmingConversion(true)
              }}
            >
              {t('record.span.convert')}
            </button>
          )}
          {confirmingDelete ? (
            <div className="record-details__delete-confirm" role="alert">
              <p>{t('record.span.deleteConfirm')}</p>
              <div className="record-details__actions">
                <button
                  type="button"
                  className="button button--destructive"
                  onClick={() => void span.deleteSpan()}
                >
                  {t('record.span.confirmDelete')}
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
              {t('record.span.delete')}
            </button>
          )}
        </>
      )}
    </section>
  )
}

function MarkerControl({
  boundary,
  enabled,
  title,
  onEnabled,
  onTitle,
  onReset,
}: {
  readonly boundary: 'begin' | 'end'
  readonly enabled: boolean
  readonly title: string
  readonly onEnabled: (enabled: boolean) => void
  readonly onTitle: (title: string) => void
  readonly onReset: () => void
}) {
  const t = useTranslate()
  const titleId = useId()
  const prefix =
    boundary === 'begin' ? 'record.span.beginMarker' : 'record.span.endMarker'
  return (
    <div className="record-details__marker">
      <div className="record-details__switch-line">
        <span>{t(`${prefix}Legend`)}</span>
        <button
          type="button"
          className="record-details__switch"
          role="switch"
          aria-label={t(`${prefix}Enabled`)}
          aria-checked={enabled}
          onClick={() => onEnabled(!enabled)}
        >
          <span aria-hidden="true" />
        </button>
      </div>
      {enabled ? (
        <div className="record-details__field">
          <span className="record-details__label-line meta-text">
            <label htmlFor={titleId}>{t('record.span.markerTitle')}</label>
            <button
              type="button"
              className="record-details__reset"
              disabled={title.length === 0}
              onClick={onReset}
            >
              {t('record.span.markerReset')}
            </button>
          </span>
          <input
            id={titleId}
            value={title}
            placeholder={t('record.span.markerAutomatic')}
            onChange={(event) => onTitle(event.currentTarget.value)}
          />
        </div>
      ) : null}
    </div>
  )
}
