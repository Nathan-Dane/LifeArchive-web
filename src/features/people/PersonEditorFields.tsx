import { useId, useRef } from 'react'
import type { LifeArchiveClient, PersonProfile } from '../../core/client'
import { failureMessage, useLocalisation } from '../../i18n'
import { RecordControlIcon } from '../../ui/overlay'
import { ConnectionLabelsEditor } from './ConnectionLabelsEditor'
import { PersonAvatar } from './PersonAvatar'
import { PeopleSelect } from './PeopleSelect'
import {
  OtherNameRow,
  PartialDateEditor,
  ReferenceRow,
} from './PersonProfileFields'
import type { People } from './usePeople'

export function PersonEditorFeedback({
  people,
  createdHandoffFailed = false,
}: {
  readonly people: People
  readonly createdHandoffFailed?: boolean
}) {
  const localisation = useLocalisation()
  const t = localisation.t

  return (
    <>
      {people.state.failure ? (
        <div role="alert" className="record-details__failure">
          <p>
            {t('people.failure.kept')}{' '}
            {failureMessage(localisation, people.state.failure)}
          </p>
          {people.state.pendingMutation ? (
            <button
              type="button"
              className="button"
              onClick={() => void people.retryMutation()}
            >
              {t('people.retry')}
            </button>
          ) : null}
        </div>
      ) : null}
      {people.state.pendingMutation &&
      people.state.status === 'ready' &&
      !people.state.conflict ? (
        <div className="record-editor__conflict" role="alert">
          <h3>{t('people.mutationConflict.title')}</h3>
          <p>{t('people.mutationConflict.detail')}</p>
          <div className="record-editor__conflict-actions">
            <button
              type="button"
              className="button"
              onClick={() => void people.retryMutation()}
            >
              {t('people.retry')}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={people.dismissMutationConflict}
            >
              {t('people.conflict.useArchive')}
            </button>
          </div>
        </div>
      ) : null}
      {createdHandoffFailed ? (
        <p role="alert" className="record-details__failure">
          {t('people.created.linkFailed')}
        </p>
      ) : null}
      {people.state.conflict ? (
        <div className="record-editor__conflict" role="alert">
          <h3>{t('people.conflict.title')}</h3>
          <p>{t('people.conflict.detail')}</p>
          <div className="record-editor__conflict-actions">
            <button
              type="button"
              className="button"
              onClick={() => void people.saveMine()}
            >
              {t('people.conflict.saveMine')}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={people.useArchiveVersion}
            >
              {t('people.conflict.useArchive')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}

/** The complete editable Person profile, shared by modal and routed editors. */
export function PersonEditorFields({
  client,
  people,
}: {
  readonly client: LifeArchiveClient
  readonly people: People
}) {
  const t = useLocalisation().t
  const nameId = useId()
  const nameErrorId = useId()
  const photoInput = useRef<HTMLInputElement>(null)
  const draft = people.state.draft
  const selected = people.state.selected
  if (!draft) return null
  const busy = people.state.status === 'saving'
  const valid = /\S/u.test(draft.displayName)

  return (
    <>
      <section className="person-card person-card--identity">
        <div className="person-photo-editor person-photo-editor--portrait-control">
          <input
            ref={photoInput}
            className="visually-hidden"
            type="file"
            accept="image/*"
            aria-label={t('people.photo.change')}
            disabled={busy || people.state.creating}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file) void people.importPhoto(file)
              event.currentTarget.value = ''
            }}
          />
          <div className="person-photo-editor__control">
            {people.state.creating ? (
              <PersonAvatar
                client={client}
                name={draft.displayName || t('people.create.heading')}
                photo={null}
                size="large"
              />
            ) : (
              <button
                type="button"
                className="person-photo-editor__replace"
                disabled={busy}
                aria-label={t('people.photo.change')}
                onClick={() => photoInput.current?.click()}
              >
                <PersonAvatar
                  client={client}
                  name={draft.displayName || t('people.create.heading')}
                  photo={selected?.profilePhoto ?? null}
                  size="large"
                />
                <span>{t('people.photo.change')}</span>
              </button>
            )}
            {!people.state.creating && selected?.profilePhoto ? (
              <button
                type="button"
                className="person-photo-editor__remove"
                disabled={busy}
                aria-label={t('people.photo.remove')}
                onClick={() => void people.removePhoto()}
              >
                <RecordControlIcon name="close" />
              </button>
            ) : null}
          </div>
        </div>
        <label className="person-field" htmlFor={nameId}>
          <span className="meta-text">{t('people.name')}</span>
          <input
            id={nameId}
            value={draft.displayName}
            disabled={busy}
            aria-invalid={!valid}
            aria-describedby={!valid ? nameErrorId : undefined}
            onChange={(event) =>
              people.update({ displayName: event.currentTarget.value })
            }
          />
        </label>
        {!valid ? (
          <span id={nameErrorId} className="meta-text">
            {t('people.name.required')}
          </span>
        ) : null}
        <ConnectionLabelsEditor
          labels={draft.connectionLabels}
          disabled={busy}
          onChange={(connectionLabels) => people.update({ connectionLabels })}
        />
        <label className="person-field">
          <span className="meta-text">{t('people.about')}</span>
          <textarea
            value={draft.about ?? ''}
            disabled={busy}
            rows={4}
            onChange={(event) =>
              people.update({ about: event.currentTarget.value || null })
            }
          />
        </label>
      </section>

      <section className="person-card">
        <h2 className="eyebrow">{t('people.names')}</h2>
        <label className="person-field">
          <span className="meta-text">{t('people.pronunciation')}</span>
          <input
            value={draft.pronunciation ?? ''}
            disabled={busy}
            onChange={(event) =>
              people.update({
                pronunciation: event.currentTarget.value || null,
              })
            }
          />
        </label>
        <label className="person-field">
          <span className="meta-text">{t('people.pronouns')}</span>
          <input
            value={draft.pronouns ?? ''}
            disabled={busy}
            onChange={(event) =>
              people.update({ pronouns: event.currentTarget.value || null })
            }
          />
        </label>
        <div className="person-repeat">
          <span className="meta-text">{t('people.otherNames')}</span>
          {draft.otherNames.map((name, index) => (
            <OtherNameRow
              key={index}
              index={index}
              name={name}
              disabled={busy}
              onChange={(value) =>
                people.update({
                  otherNames: draft.otherNames.map((current, item) =>
                    item === index ? value : current,
                  ),
                })
              }
              onRemove={() =>
                people.update({
                  otherNames: draft.otherNames.filter(
                    (_, item) => item !== index,
                  ),
                })
              }
            />
          ))}
          <button
            type="button"
            className="button button--secondary"
            disabled={busy}
            onClick={() =>
              people.update({
                otherNames: [
                  ...draft.otherNames,
                  { kindId: 'nickname', value: '' },
                ],
              })
            }
          >
            <RecordControlIcon name="add" />
            <span>{t('people.otherNames.add')}</span>
          </button>
        </div>
      </section>

      <section className="person-card">
        <h2 className="eyebrow">{t('people.life')}</h2>
        <div className="person-field">
          <span className="meta-text">{t('people.life.status')}</span>
          <PeopleSelect
            value={draft.lifeStatus}
            ariaLabel={t('people.life.status')}
            disabled={busy}
            options={[
              {
                value: 'notSpecified',
                label: t('people.life.status.notSpecified'),
              },
              { value: 'living', label: t('people.life.status.living') },
              { value: 'deceased', label: t('people.life.status.deceased') },
            ]}
            onChange={(lifeStatus) =>
              people.update({
                lifeStatus: lifeStatus as PersonProfile['lifeStatus'],
              })
            }
          />
        </div>
        <PartialDateEditor
          label={t('people.birth')}
          value={draft.birthDate}
          disabled={busy}
          onChange={(birthDate) => people.update({ birthDate })}
        />
        <PartialDateEditor
          label={t('people.death')}
          value={draft.deathDate}
          disabled={busy}
          onChange={(deathDate) => people.update({ deathDate })}
        />
      </section>

      <section className="person-card">
        <h2 className="eyebrow">{t('people.references')}</h2>
        {draft.references.map((reference, index) => (
          <ReferenceRow
            key={index}
            index={index}
            reference={reference}
            disabled={busy}
            onChange={(value) =>
              people.update({
                references: draft.references.map((current, item) =>
                  item === index ? value : current,
                ),
              })
            }
            onRemove={() =>
              people.update({
                references: draft.references.filter(
                  (_, item) => item !== index,
                ),
              })
            }
          />
        ))}
        <button
          type="button"
          className="button button--secondary"
          disabled={busy}
          onClick={() =>
            people.update({
              references: [
                ...draft.references,
                { kindId: 'personalWebsite', label: null, url: '' },
              ],
            })
          }
        >
          <RecordControlIcon name="add" />
          <span>{t('people.references.add')}</span>
        </button>
      </section>
    </>
  )
}
