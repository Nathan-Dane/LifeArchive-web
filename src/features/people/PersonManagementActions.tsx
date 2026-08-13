import { useState } from 'react'
import type { PersonSnapshot } from '../../core/client'
import { useLocalisation } from '../../i18n'
import type { People } from './usePeople'
import { PeopleSelect } from './PeopleSelect'

export function PersonManagementActions({
  people,
  selected,
  busy,
}: {
  readonly people: People
  readonly selected: PersonSnapshot
  readonly busy: boolean
}) {
  const t = useLocalisation().t
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeDuplicate, setMergeDuplicate] = useState('')
  const [displayNameSource, setDisplayNameSource] = useState<
    'retained' | 'duplicate'
  >('retained')
  const [aboutSource, setAboutSource] = useState<
    'retained' | 'duplicate' | 'combined'
  >('retained')
  const [photoSource, setPhotoSource] = useState<
    'retained' | 'duplicate' | 'none'
  >('retained')
  const mergeCandidates = people.state.people.filter(
    ({ person }) => person.id !== selected.person.id && !person.isArchived,
  )

  return (
    <section className="person-card person-management-actions">
      <button
        type="button"
        className="button button--secondary"
        disabled={busy}
        onClick={() => void people.setArchived(!selected.person.isArchived)}
      >
        {t(selected.person.isArchived ? 'people.restore' : 'people.archive')}
      </button>
      <button
        type="button"
        className="button button--secondary"
        disabled={
          busy || selected.person.isArchived || mergeCandidates.length === 0
        }
        onClick={() => setMergeOpen((value) => !value)}
      >
        {t('people.merge')}
      </button>
      {mergeOpen ? (
        <div className="person-merge">
          <h3>{t('people.merge.heading')}</h3>
          {people.state.mergeConflict ? (
            <p role="alert">{t('people.merge.conflict')}</p>
          ) : null}
          <div className="person-field">
            <span>{t('people.merge.duplicate')}</span>
            <PeopleSelect
              value={mergeDuplicate}
              ariaLabel={t('people.merge.duplicate')}
              options={[
                { value: '', label: t('people.merge.choose') },
                ...mergeCandidates.map((candidate) => ({
                  value: candidate.person.id,
                  label: candidate.person.displayName,
                })),
              ]}
              onChange={setMergeDuplicate}
            />
          </div>
          <MergeChoice
            label={t('people.merge.name')}
            value={displayNameSource}
            choices={['retained', 'duplicate']}
            onChange={setDisplayNameSource}
          />
          <MergeChoice
            label={t('people.merge.about')}
            value={aboutSource}
            choices={['retained', 'duplicate', 'combined']}
            onChange={setAboutSource}
          />
          <MergeChoice
            label={t('people.merge.photo')}
            value={photoSource}
            choices={['retained', 'duplicate', 'none']}
            onChange={setPhotoSource}
          />
          <button
            type="button"
            className="button button--destructive"
            disabled={!mergeDuplicate}
            onClick={() => {
              const duplicate = mergeCandidates.find(
                ({ person }) => person.id === mergeDuplicate,
              )
              if (duplicate) {
                void people.merge(duplicate, {
                  displayNameSource,
                  aboutSource,
                  photoSource,
                })
              }
            }}
          >
            {t('people.merge.confirm')}
          </button>
        </div>
      ) : null}
      {confirmDelete ? (
        <div className="record-details__delete-confirm" role="alert">
          <p>{t('people.delete.confirm')}</p>
          <button
            type="button"
            className="button button--destructive"
            onClick={() => void people.deletePerson()}
          >
            {t('people.delete')}
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setConfirmDelete(false)}
          >
            {t('people.cancel')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="button button--destructive"
          onClick={() => setConfirmDelete(true)}
        >
          {t('people.delete')}
        </button>
      )}
    </section>
  )
}

function MergeChoice<Value extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  readonly label: string
  readonly value: Value
  readonly choices: readonly Value[]
  readonly onChange: (value: Value) => void
}) {
  const t = useLocalisation().t
  const labels = {
    retained: 'people.merge.retained',
    duplicate: 'people.merge.duplicateChoice',
    combined: 'people.merge.combine',
    none: 'people.merge.none',
  } as const
  return (
    <div className="person-field">
      <span>{label}</span>
      <PeopleSelect
        value={value}
        ariaLabel={label}
        options={choices.map((choice) => ({
          value: choice,
          label: t(labels[choice as keyof typeof labels]),
        }))}
        onChange={onChange}
      />
    </div>
  )
}
