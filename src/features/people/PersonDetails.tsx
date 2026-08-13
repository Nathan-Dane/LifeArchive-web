import { useId, useRef, useState, type RefObject } from 'react'
import type {
  LifeArchiveClient,
  PersonProfile,
  PersonSnapshot,
} from '../../core/client'
import { failureMessage, useLocalisation } from '../../i18n'
import { RecordControlIcon } from '../../ui/overlay'
import { ConnectionLabelsEditor } from './ConnectionLabelsEditor'
import { PersonAvatar } from './PersonAvatar'
import { PersonInsights } from './PersonInsights'
import { PersonManagementActions } from './PersonManagementActions'
import {
  OtherNameRow,
  PartialDateEditor,
  ReferenceRow,
} from './PersonProfileFields'
import type { People } from './usePeople'

export function PersonDetails({
  client,
  people,
  headingId,
  closeRef,
  onBack,
  onClose,
  onCreated,
  onChanged,
}: {
  readonly client: LifeArchiveClient
  readonly people: People
  readonly headingId: string
  readonly closeRef: RefObject<HTMLButtonElement | null>
  readonly onBack?: () => void
  readonly onClose: () => void
  readonly onCreated?: (
    snapshot: PersonSnapshot,
  ) => void | boolean | Promise<void | boolean>
  readonly onChanged?: () => void
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const nameId = useId()
  const nameErrorId = useId()
  const photoInput = useRef<HTMLInputElement>(null)
  const [createdHandoffFailed, setCreatedHandoffFailed] = useState(false)
  const draft = people.state.draft
  const selected = people.state.selected
  if (!draft) return null
  const busy = people.state.status === 'saving'
  const valid = /\S/u.test(draft.displayName)

  const save = async () => {
    if (people.state.creating) {
      const created = await people.create()
      if (created) {
        const accepted = await onCreated?.(created.snapshot)
        setCreatedHandoffFailed(accepted === false)
      }
      return
    }
    if (await people.save()) onChanged?.()
  }

  return (
    <>
      <header className="record-overlay__header person-editor__header">
        {onBack ? (
          <button
            type="button"
            className="record-overlay__back"
            aria-label={t('people.back')}
            onClick={onBack}
          >
            <RecordControlIcon name="back" />
          </button>
        ) : null}
        <div>
          <h2 id={headingId} className="ui-heading">
            {t(
              people.state.creating
                ? 'people.create.heading'
                : 'people.edit.heading',
            )}
          </h2>
          <p className="meta-text">
            {t(
              people.state.creating
                ? 'people.create.detail'
                : 'people.edit.detail',
            )}
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="record-overlay__close"
          aria-label={t('people.close.editor')}
          onClick={onClose}
        >
          <RecordControlIcon name="close" />
        </button>
      </header>

      <div className="person-editor__body">
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
                onClick={people.saveMine}
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

        <section className="person-card person-card--identity">
          <div className="person-photo-editor">
            <PersonAvatar
              client={client}
              name={draft.displayName || t('people.create.heading')}
              photo={selected?.profilePhoto ?? null}
              size="large"
            />
            {!people.state.creating ? (
              <div>
                <input
                  ref={photoInput}
                  className="visually-hidden"
                  type="file"
                  accept="image/*"
                  aria-label={t('people.photo.change')}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    if (file) void people.importPhoto(file)
                    event.currentTarget.value = ''
                  }}
                />
                <button
                  type="button"
                  className="button button--secondary"
                  disabled={busy}
                  onClick={() => photoInput.current?.click()}
                >
                  {t('people.photo.change')}
                </button>
                {selected?.profilePhoto ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={busy}
                    onClick={() => void people.removePhoto()}
                  >
                    {t('people.photo.remove')}
                  </button>
                ) : null}
              </div>
            ) : null}
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
          <h3 className="eyebrow">{t('people.names')}</h3>
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
          <h3 className="eyebrow">{t('people.life')}</h3>
          <label className="person-field">
            <span className="meta-text">{t('people.life.status')}</span>
            <select
              value={draft.lifeStatus}
              disabled={busy}
              onChange={(event) =>
                people.update({
                  lifeStatus: event.currentTarget
                    .value as PersonProfile['lifeStatus'],
                })
              }
            >
              <option value="notSpecified">
                {t('people.life.status.notSpecified')}
              </option>
              <option value="living">{t('people.life.status.living')}</option>
              <option value="deceased">
                {t('people.life.status.deceased')}
              </option>
            </select>
          </label>
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
          <h3 className="eyebrow">{t('people.references')}</h3>
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

        {!people.state.creating && selected ? (
          <PersonInsights people={people} />
        ) : null}

        {!people.state.creating && selected ? (
          <PersonManagementActions
            people={people}
            selected={selected}
            busy={busy}
          />
        ) : null}
      </div>

      <footer className="record-overlay__footer person-editor__footer">
        <button
          type="button"
          className="button button--primary"
          disabled={!valid || busy}
          onClick={() => void save()}
        >
          {t(busy ? 'people.saving' : 'people.save')}
        </button>
      </footer>
    </>
  )
}
