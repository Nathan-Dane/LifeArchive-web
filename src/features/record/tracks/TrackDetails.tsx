import { useId, useState, type RefObject } from 'react'
import { failureMessage, useLocalisation } from '../../../i18n'
import { RecordTagPicker, SemanticIconPicker } from '../metadata'
import { RecordControlIcon } from '../overlays'
import { TrackHistory } from './TrackHistory'
import type { CreatedTrack, Tracks } from './useTracks'

export function TrackDetails({
  tracks,
  headingId,
  closeRef,
  onBack,
  onClose,
  onCreated,
  onManagementRefresh,
}: {
  readonly tracks: Tracks
  readonly headingId: string
  readonly closeRef: RefObject<HTMLButtonElement | null>
  readonly onBack?: () => void
  readonly onClose: () => void
  readonly onCreated: (created: CreatedTrack) => void
  readonly onManagementRefresh?: () => void
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const nameId = useId()
  const membersId = useId()
  const [membersExpanded, setMembersExpanded] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [detachMembers, setDetachMembers] = useState(false)
  const draft = tracks.state.draft
  if (!draft) return null

  const memberCount = tracks.state.selectedSummary?.memberCount ?? 0
  const valid = draft.name.trim().length > 0 && draft.iconId.length > 0
  const busy =
    tracks.state.status === 'saving' || tracks.state.status === 'loading'
  const suggestedTag = draft.suggestedTagId

  const save = async () => {
    if (tracks.state.creating) {
      const created = await tracks.create()
      if (created) onCreated(created)
      return
    }
    if (await tracks.save()) onManagementRefresh?.()
  }

  const deleteTrack = async () => {
    const deleted = await tracks.deleteTrack(detachMembers)
    if (deleted) onManagementRefresh?.()
  }

  return (
    <>
      <header className="record-overlay__header record-track-editor__header">
        {onBack ? (
          <button
            type="button"
            className="record-overlay__back"
            aria-label={t('record.track.backToManager')}
            onClick={onBack}
          >
            <RecordControlIcon name="back" />
          </button>
        ) : null}
        <div>
          <h2 id={headingId} className="ui-heading">
            {t(
              tracks.state.creating
                ? 'record.track.createHeading'
                : 'record.track.editHeading',
            )}
          </h2>
          <p className="meta-text">
            {t(
              tracks.state.creating
                ? 'record.track.createDetail'
                : 'record.track.editDetail',
            )}
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="record-overlay__close"
          aria-label={t('record.track.closeEditor')}
          onClick={onClose}
        >
          <RecordControlIcon name="close" />
        </button>
      </header>

      <div className="record-track-editor__body">
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

        <section className="record-track-editor__identity">
          <div className="record-details__field">
            <label className="meta-text" htmlFor={nameId}>
              {t('record.track.titleAndIcon')}
            </label>
            <div className="record-details__identity">
              <SemanticIconPicker
                value={draft.iconId}
                disabled={busy}
                onChange={(iconId) => tracks.updateTrack({ iconId })}
              />
              <input
                id={nameId}
                value={draft.name}
                disabled={busy}
                onChange={(event) =>
                  tracks.updateTrack({ name: event.currentTarget.value })
                }
              />
            </div>
          </div>

          <RecordTagPicker
            label={t('record.track.defaultTag')}
            tags={{
              ordered: suggestedTag ? [suggestedTag] : [],
              display: suggestedTag || null,
            }}
            disabled={busy}
            onChange={(tags) => {
              const added = tags.ordered.find((id) => id !== suggestedTag)
              tracks.updateTrack({
                suggestedTagId: added ?? tags.display ?? tags.ordered[0] ?? '',
              })
            }}
          />
        </section>

        {!tracks.state.creating ? (
          <section className="record-track-editor__members">
            <button
              type="button"
              className="record-track-editor__members-toggle"
              aria-expanded={membersExpanded}
              aria-controls={membersId}
              onClick={() => setMembersExpanded((current) => !current)}
            >
              <span>
                <strong>{t('record.track.contained')}</strong>
                <span className="meta-text">
                  {t('record.track.memberCount', { count: memberCount })}
                </span>
              </span>
              <span aria-hidden="true">
                <RecordControlIcon name="expand" />
              </span>
            </button>
            <div id={membersId} hidden={!membersExpanded}>
              <TrackHistory tracks={tracks} showHeader={false} />
            </div>
          </section>
        ) : null}

        <div className="record-track-editor__secondary-actions">
          <button type="button" className="button button--secondary" disabled>
            {t('record.track.seeHistory')}
          </button>
          {!tracks.state.creating ? (
            <button
              type="button"
              className="button button--secondary"
              aria-pressed={draft.isArchived}
              disabled={busy}
              onClick={() =>
                tracks.updateTrack({ isArchived: !draft.isArchived })
              }
            >
              {t(
                draft.isArchived
                  ? 'record.track.unarchive'
                  : 'record.track.archive',
              )}
            </button>
          ) : null}
        </div>

        {!tracks.state.creating && confirmingDelete ? (
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
                className="button button--secondary"
                onClick={() => setConfirmingDelete(false)}
              >
                {t('record.event.cancel')}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <footer className="record-overlay__footer record-track-editor__footer">
        {!tracks.state.creating ? (
          <button
            type="button"
            className="button button--destructive record-track-editor__delete"
            disabled={
              busy || (confirmingDelete && memberCount > 0 && !detachMembers)
            }
            onClick={() => {
              if (confirmingDelete) {
                void deleteTrack()
              } else {
                setConfirmingDelete(true)
              }
            }}
          >
            {t(
              confirmingDelete
                ? 'record.track.confirmDelete'
                : 'record.track.delete',
            )}
          </button>
        ) : null}
        <button
          type="button"
          className="button button--primary"
          disabled={!valid || busy}
          onClick={() => void save()}
        >
          {t('record.track.save')}
        </button>
      </footer>
    </>
  )
}
