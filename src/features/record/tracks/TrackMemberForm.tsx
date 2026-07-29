import { isCivilDate } from '../../../core/client'
import { useTranslate } from '../../../i18n'
import {
  RecordDatePicker,
  RecordTagPicker,
  SemanticIconPicker,
} from '../metadata'
import type { TrackMemberDraftFields } from './trackDrafts'

export function TrackMemberForm({
  draft,
  update,
}: {
  readonly draft: TrackMemberDraftFields
  readonly update: (change: Partial<TrackMemberDraftFields>) => void
}) {
  const t = useTranslate()
  const validDate =
    isCivilDate(draft.date) &&
    (draft.kind === 'event' || draft.ongoing || isCivilDate(draft.endDate))
  return (
    <fieldset className="record-track-member">
      <legend>{t('record.track.memberDetails')}</legend>
      <label>
        <span>{t('record.track.memberKind')}</span>
        <select
          value={draft.kind}
          onChange={(event) =>
            update({
              kind: event.currentTarget.value as 'event' | 'span',
            })
          }
        >
          <option value="event">{t('record.objects.kindEvent')}</option>
          <option value="span">{t('record.objects.kindSpan')}</option>
        </select>
      </label>
      <label>
        <span>{t('record.track.memberTitle')}</span>
        <input
          value={draft.title}
          onChange={(event) => update({ title: event.currentTarget.value })}
        />
      </label>
      <label>
        <span>
          {t(
            draft.kind === 'event'
              ? 'record.event.date'
              : 'record.span.startDate',
          )}
        </span>
        <RecordDatePicker
          label={t(
            draft.kind === 'event'
              ? 'record.event.date'
              : 'record.span.startDate',
          )}
          value={draft.date}
          invalid={!validDate}
          onChange={(date) => update({ date })}
        />
      </label>
      {draft.kind === 'span' ? (
        <>
          <label className="record-track-member__check">
            <input
              type="checkbox"
              checked={draft.ongoing}
              onChange={(event) =>
                update({ ongoing: event.currentTarget.checked })
              }
            />
            <span>{t('record.span.ongoing')}</span>
          </label>
          {draft.ongoing ? null : (
            <label>
              <span>{t('record.span.endDate')}</span>
              <RecordDatePicker
                label={t('record.span.endDate')}
                value={draft.endDate}
                invalid={!isCivilDate(draft.endDate)}
                onChange={(endDate) => update({ endDate })}
              />
            </label>
          )}
          <label className="record-track-member__check">
            <input
              type="checkbox"
              checked={draft.beginMarkerEnabled}
              onChange={(event) =>
                update({ beginMarkerEnabled: event.currentTarget.checked })
              }
            />
            <span>{t('record.span.beginMarkerEnabled')}</span>
          </label>
          {draft.beginMarkerEnabled ? (
            <label>
              <span>{t('record.span.markerTitle')}</span>
              <input
                value={draft.beginMarkerTitle}
                placeholder={t('record.span.markerAutomatic')}
                onChange={(event) =>
                  update({ beginMarkerTitle: event.currentTarget.value })
                }
              />
            </label>
          ) : null}
          <label className="record-track-member__check">
            <input
              type="checkbox"
              checked={draft.endMarkerEnabled}
              onChange={(event) =>
                update({ endMarkerEnabled: event.currentTarget.checked })
              }
            />
            <span>{t('record.span.endMarkerEnabled')}</span>
          </label>
          {draft.endMarkerEnabled ? (
            <label>
              <span>{t('record.span.markerTitle')}</span>
              <input
                value={draft.endMarkerTitle}
                placeholder={t('record.span.markerAutomatic')}
                onChange={(event) =>
                  update({ endMarkerTitle: event.currentTarget.value })
                }
              />
            </label>
          ) : null}
        </>
      ) : null}
      <label>
        <span>{t('record.track.memberWriting')}</span>
        <textarea
          value={draft.markdown}
          onChange={(event) => update({ markdown: event.currentTarget.value })}
        />
      </label>
      <SemanticIconPicker
        value={draft.iconId}
        onChange={(iconId) => update({ iconId })}
      />
      {draft.tagStateOmitted ? (
        <p className="meta-text">{t('record.track.suggestedTagMayApply')}</p>
      ) : (
        <RecordTagPicker
          tags={{
            ordered: draft.tagIds,
            display: draft.displayTagId || null,
          }}
          onChange={(tags) =>
            update({
              tagIds: tags.ordered,
              displayTagId: tags.display ?? '',
              tagStateOmitted: false,
            })
          }
        />
      )}
      {draft.tagStateOmitted ? (
        <button
          type="button"
          className="button button--secondary"
          onClick={() => update({ tagIds: [], tagStateOmitted: false })}
        >
          {t('record.track.useNoTags')}
        </button>
      ) : null}
    </fieldset>
  )
}
