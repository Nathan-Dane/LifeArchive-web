import { useId, useState } from 'react'
import type { CivilDate } from '../../../core/client'
import { failureMessage, semanticName, useLocalisation } from '../../../i18n'
import { RecordSemanticIcon } from '../events'
import { PREDEFINED_TAG_IDS, SemanticIconPicker } from '../metadata'
import { TrackMemberForm } from './TrackMemberForm'
import type { Tracks } from './useTracks'

export function TrackDetails({
  tracks,
  date,
}: {
  readonly tracks: Tracks
  readonly date: CivilDate | null
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const headingId = useId()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [detachMembers, setDetachMembers] = useState(false)
  const draft = tracks.state.draft
  if (!draft) return null
  const memberCount = tracks.state.selectedSummary?.memberCount ?? 0
  const includeFirst =
    tracks.state.creating && tracks.state.memberDraft !== null
  const valid = draft.name.length > 0 && draft.iconId.length > 0

  return (
    <section className="record-details" aria-labelledby={headingId}>
      <header className="record-details__head">
        <h2 id={headingId} className="title">
          {t(
            tracks.state.creating
              ? 'record.track.createHeading'
              : 'record.track.editHeading',
          )}
        </h2>
      </header>
      {tracks.state.failure ? (
        <p role="alert" className="record-details__failure">
          {t('record.track.failureDraftKept')}{' '}
          {failureMessage(localisation, tracks.state.failure)}
        </p>
      ) : null}
      {tracks.state.conflict ? (
        <div className="record-editor__conflict" role="alert">
          <h3>{t('record.track.conflictTitle')}</h3>
          <p>{t('record.track.conflictDetail')}</p>
          <div className="record-editor__conflict-actions">
            {tracks.state.creating ? (
              <button
                type="button"
                className="button"
                onClick={() => void tracks.retryCreateWithNewIds()}
              >
                {t('record.track.retryCreate')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="button"
                  onClick={() => void tracks.saveMine()}
                >
                  {t('record.track.saveMine')}
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={tracks.useArchiveVersion}
                >
                  {t('record.track.useArchive')}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
      {tracks.state.memberConflict ? (
        <div className="record-editor__conflict" role="alert">
          <h3>{t('record.track.memberConflictTitle')}</h3>
          <p>{t('record.track.memberConflictDetail')}</p>
          <button
            type="button"
            className="button"
            onClick={() => void tracks.refreshMemberContext()}
          >
            {t('record.track.refreshAndRetry')}
          </button>
        </div>
      ) : null}
      <section className="record-details__section">
        <h3 className="eyebrow">{t('record.details.identity')}</h3>
        <label className="record-details__field">
          <span>{t('record.track.name')}</span>
          <span className="record-details__identity">
            <RecordSemanticIcon
              id={draft.iconId}
              className="record-details__icon"
            />
            <input
              value={draft.name}
              onChange={(event) =>
                tracks.updateTrack({ name: event.currentTarget.value })
              }
            />
          </span>
        </label>
        <SemanticIconPicker
          value={draft.iconId}
          disabled={tracks.state.status === 'saving'}
          onChange={(iconId) => tracks.updateTrack({ iconId })}
        />
        <label className="record-details__field">
          <span>{t('record.track.suggestedTag')}</span>
          <select
            value={draft.suggestedTagId}
            onChange={(event) =>
              tracks.updateTrack({
                suggestedTagId: event.currentTarget.value,
              })
            }
          >
            <option value="">{t('record.track.noSuggestedTag')}</option>
            {draft.suggestedTagId &&
            !(PREDEFINED_TAG_IDS as readonly string[]).includes(
              draft.suggestedTagId,
            ) ? (
              <option value={draft.suggestedTagId}>
                {
                  semanticName(
                    localisation,
                    'record',
                    'tag',
                    draft.suggestedTagId,
                  ).text
                }
              </option>
            ) : null}
            {PREDEFINED_TAG_IDS.map((id) => (
              <option key={id} value={id}>
                {semanticName(localisation, 'record', 'tag', id).text}
              </option>
            ))}
          </select>
        </label>
        <label className="record-details__switch-line">
          <span>{t('record.track.archived')}</span>
          <input
            type="checkbox"
            checked={draft.isArchived}
            onChange={(event) =>
              tracks.updateTrack({ isArchived: event.currentTarget.checked })
            }
          />
        </label>
      </section>

      {tracks.state.creating ? (
        <>
          <label className="record-track-member__check">
            <input
              type="checkbox"
              checked={includeFirst}
              onChange={(event) => {
                const include = event.currentTarget.checked
                if (date) tracks.includeFirstMember(include, date)
              }}
            />
            <span>{t('record.track.createWithFirst')}</span>
          </label>
          {includeFirst && tracks.state.memberDraft ? (
            <TrackMemberForm
              draft={tracks.state.memberDraft}
              update={tracks.updateMember}
            />
          ) : null}
          <div className="record-details__actions">
            <button
              type="button"
              className="button"
              disabled={
                !valid ||
                tracks.state.status === 'saving' ||
                (includeFirst && !tracks.state.memberDraft)
              }
              onClick={() => void tracks.create()}
            >
              {t(
                includeFirst
                  ? 'record.track.createAtomically'
                  : 'record.track.create',
              )}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                tracks.cancelCreate()
              }}
            >
              {t('record.event.cancel')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="record-details__actions">
            <button
              type="button"
              className="button"
              disabled={!valid || tracks.state.status === 'saving'}
              onClick={() => void tracks.save()}
            >
              {t('record.track.save')}
            </button>
          </div>
          {tracks.state.addingMember && tracks.state.memberDraft ? (
            <>
              <TrackMemberForm
                draft={tracks.state.memberDraft}
                update={tracks.updateMember}
              />
              <div className="record-details__actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => void tracks.createMember()}
                >
                  {t('record.track.createMember')}
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={tracks.cancelAddMember}
                >
                  {t('record.event.cancel')}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="button button--secondary"
              disabled={!date}
              onClick={() => {
                if (date) tracks.startAddMember(date)
              }}
            >
              {t('record.track.addMember')}
            </button>
          )}
          {confirmingDelete ? (
            <div className="record-details__delete-confirm" role="alert">
              <p>
                {memberCount > 0
                  ? t('record.track.deletePopulated', { count: memberCount })
                  : t('record.track.deleteEmpty')}
              </p>
              {memberCount > 0 ? (
                <label className="record-track-member__check">
                  <input
                    type="checkbox"
                    checked={detachMembers}
                    onChange={(event) =>
                      setDetachMembers(event.currentTarget.checked)
                    }
                  />
                  <span>{t('record.track.detachConfirm')}</span>
                </label>
              ) : null}
              <div className="record-details__actions">
                <button
                  type="button"
                  className="button button--destructive"
                  disabled={memberCount > 0 && !detachMembers}
                  onClick={() => void tracks.deleteTrack(detachMembers)}
                >
                  {t('record.track.confirmDelete')}
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
              {t('record.track.delete')}
            </button>
          )}
        </>
      )}
    </section>
  )
}
