import { useId, useRef, useState } from 'react'
import type { PersonSnapshot } from '../../core/client'
import { useLocalisation } from '../../i18n'
import { RecordControlIcon, RecordOverlay } from '../../ui/overlay'
import { PeopleSelect } from './PeopleSelect'
import { PeopleTaskHeader } from './PeopleTaskHeader'
import type { People } from './usePeople'

interface CommonActionsProps {
  readonly people: People
  readonly selected: PersonSnapshot
  readonly onArchived?: () => void
  readonly onDeleted?: () => void
}

export function PersonProfileActions({
  people,
  selected,
  onEdit,
  onArchived,
  onDeleted,
}: CommonActionsProps & { readonly onEdit: () => void }) {
  const t = useLocalisation().t
  const busy = people.state.status === 'saving'
  const [deleteOpen, setDeleteOpen] = useState(false)

  const archive = async () => {
    if (await people.setArchived(!selected.person.isArchived)) onArchived?.()
  }

  return (
    <>
      <div
        className="person-page-actions"
        role="group"
        aria-label={t('people.actions')}
      >
        <button
          type="button"
          className="button button--primary"
          disabled={busy}
          onClick={onEdit}
        >
          {t('people.editPerson')}
        </button>
        <button
          type="button"
          className="button button--secondary"
          disabled={busy}
          onClick={() => void archive()}
        >
          {t(selected.person.isArchived ? 'people.restore' : 'people.archive')}
          <RecordControlIcon name="next" />
        </button>
        <button
          type="button"
          className="button button--destructive"
          disabled={busy}
          onClick={() => setDeleteOpen(true)}
        >
          {t('people.delete')}
          <RecordControlIcon name="next" />
        </button>
      </div>
      <DeletePersonTask
        open={deleteOpen}
        people={people}
        onClose={() => setDeleteOpen(false)}
        onDeleted={onDeleted}
      />
    </>
  )
}

export function PersonEditorActions({
  people,
  selected,
  onViewProfile,
  onSaved,
  onArchived,
  onDeleted,
}: CommonActionsProps & {
  readonly onViewProfile: () => void
  readonly onSaved?: () => void
}) {
  const t = useLocalisation().t
  const busy = people.state.status === 'saving'
  const valid = Boolean(people.state.draft?.displayName.match(/\S/u))
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const mergeCandidates = people.state.people.filter(
    ({ person }) => person.id !== selected.person.id && !person.isArchived,
  )

  const save = async () => {
    if (await people.save()) onSaved?.()
  }
  const archive = async () => {
    if (await people.setArchived(!selected.person.isArchived)) onArchived?.()
  }

  return (
    <>
      <div
        className="person-page-actions"
        role="group"
        aria-label={t('people.actions')}
      >
        <button
          type="button"
          className="button button--primary"
          disabled={!valid || busy}
          onClick={() => void save()}
        >
          {t(busy ? 'people.saving' : 'people.saveChanges')}
        </button>
        <button
          type="button"
          className="button button--secondary"
          disabled={busy}
          onClick={onViewProfile}
        >
          {t('people.viewProfile')}
          <RecordControlIcon name="next" />
        </button>
        <button
          type="button"
          className="button button--secondary"
          disabled={busy}
          onClick={() => void archive()}
        >
          {t(selected.person.isArchived ? 'people.restore' : 'people.archive')}
          <RecordControlIcon name="next" />
        </button>
        <button
          type="button"
          className="button button--secondary"
          disabled={
            busy || selected.person.isArchived || mergeCandidates.length === 0
          }
          onClick={() => setMergeOpen(true)}
        >
          {t('people.mergeWith')}
          <RecordControlIcon name="next" />
        </button>
        <button
          type="button"
          className="button button--destructive"
          disabled={busy}
          onClick={() => setDeleteOpen(true)}
        >
          {t('people.delete')}
          <RecordControlIcon name="next" />
        </button>
      </div>
      <MergePersonTask
        open={mergeOpen}
        people={people}
        selected={selected}
        onClose={() => setMergeOpen(false)}
      />
      <DeletePersonTask
        open={deleteOpen}
        people={people}
        onClose={() => setDeleteOpen(false)}
        onDeleted={onDeleted}
      />
    </>
  )
}

function DeletePersonTask({
  open,
  people,
  onClose,
  onDeleted,
}: {
  readonly open: boolean
  readonly people: People
  readonly onClose: () => void
  readonly onDeleted?: () => void
}) {
  const t = useLocalisation().t
  const headingId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [attempted, setAttempted] = useState(false)
  const close = () => {
    setAttempted(false)
    onClose()
  }
  const remove = async () => {
    setAttempted(true)
    if (await people.deletePerson()) {
      close()
      onDeleted?.()
    }
  }

  return (
    <RecordOverlay
      open={open}
      kind="modal"
      modalPlacement="center"
      labelledBy={headingId}
      initialFocusRef={closeRef}
      onClose={close}
      className="person-lifecycle-task"
    >
      <PeopleTaskHeader
        headingId={headingId}
        title={t('people.delete')}
        closeLabel={t('people.cancelDelete')}
        closeRef={closeRef}
        onClose={close}
      />
      <div className="person-lifecycle-task__body">
        <p>{t('people.delete.confirm')}</p>
        {attempted && people.state.failure ? (
          <p role="alert">{t('people.delete.failed')}</p>
        ) : null}
      </div>
      <footer className="record-overlay__footer person-lifecycle-task__footer">
        <button
          type="button"
          className="button button--secondary"
          disabled={people.state.status === 'saving'}
          onClick={close}
        >
          {t('people.cancel')}
        </button>
        <button
          type="button"
          className="button button--destructive"
          disabled={people.state.status === 'saving'}
          onClick={() => void remove()}
        >
          {t('people.delete')}
        </button>
      </footer>
    </RecordOverlay>
  )
}

function MergePersonTask({
  open,
  people,
  selected,
  onClose,
}: {
  readonly open: boolean
  readonly people: People
  readonly selected: PersonSnapshot
  readonly onClose: () => void
}) {
  const t = useLocalisation().t
  const headingId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [duplicateId, setDuplicateId] = useState('')
  const [displayNameSource, setDisplayNameSource] = useState<
    'retained' | 'duplicate'
  >('retained')
  const [aboutSource, setAboutSource] = useState<
    'retained' | 'duplicate' | 'combined'
  >('retained')
  const [photoSource, setPhotoSource] = useState<
    'retained' | 'duplicate' | 'none'
  >('retained')
  const candidates = people.state.people.filter(
    ({ person }) => person.id !== selected.person.id && !person.isArchived,
  )

  const merge = async () => {
    const duplicate = candidates.find(({ person }) => person.id === duplicateId)
    if (
      duplicate &&
      (await people.merge(duplicate, {
        displayNameSource,
        aboutSource,
        photoSource,
      }))
    ) {
      onClose()
    }
  }

  return (
    <RecordOverlay
      open={open}
      kind="modal"
      modalPlacement="center"
      labelledBy={headingId}
      initialFocusRef={closeRef}
      onClose={onClose}
      className="person-lifecycle-task person-lifecycle-task--merge"
    >
      <PeopleTaskHeader
        headingId={headingId}
        title={t('people.merge.heading')}
        closeLabel={t('people.cancelMerge')}
        closeRef={closeRef}
        onClose={onClose}
      />
      <div className="person-lifecycle-task__body person-merge">
        {people.state.mergeConflict ? (
          <p role="alert">{t('people.merge.conflict')}</p>
        ) : null}
        <div className="person-field">
          <span>{t('people.merge.duplicate')}</span>
          <PeopleSelect
            value={duplicateId}
            ariaLabel={t('people.merge.duplicate')}
            options={[
              { value: '', label: t('people.merge.choose') },
              ...candidates.map((candidate) => ({
                value: candidate.person.id,
                label: candidate.person.displayName,
              })),
            ]}
            onChange={setDuplicateId}
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
      </div>
      <footer className="record-overlay__footer person-lifecycle-task__footer">
        <button
          type="button"
          className="button button--secondary"
          disabled={people.state.status === 'saving'}
          onClick={onClose}
        >
          {t('people.cancel')}
        </button>
        <button
          type="button"
          className="button button--destructive"
          disabled={!duplicateId || people.state.status === 'saving'}
          onClick={() => void merge()}
        >
          {t('people.merge.confirm')}
        </button>
      </footer>
    </RecordOverlay>
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
