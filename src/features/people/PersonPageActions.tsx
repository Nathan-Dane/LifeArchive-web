import { useId, useRef, useState } from 'react'
import type { PersonSnapshot } from '../../core/client'
import { useLocalisation } from '../../i18n'
import { RecordControlIcon, RecordOverlay } from '../../ui/overlay'
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
        </button>
        <button
          type="button"
          className="button button--destructive"
          disabled={busy}
          onClick={() => setDeleteOpen(true)}
        >
          {t('people.delete')}
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
        </button>
        <button
          type="button"
          className="button button--secondary"
          disabled={busy}
          onClick={() => void archive()}
        >
          {t(selected.person.isArchived ? 'people.restore' : 'people.archive')}
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
        </button>
        <button
          type="button"
          className="button button--destructive"
          disabled={busy}
          onClick={() => setDeleteOpen(true)}
        >
          {t('people.delete')}
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
      <header className="record-overlay__header">
        <h2 id={headingId} className="ui-heading">
          {t('people.delete')}
        </h2>
        <button
          ref={closeRef}
          type="button"
          className="record-overlay__close"
          aria-label={t('people.cancelDelete')}
          onClick={close}
        >
          <RecordControlIcon name="close" />
        </button>
      </header>
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
      <header className="record-overlay__header">
        <h2 id={headingId} className="ui-heading">
          {t('people.merge.heading')}
        </h2>
        <button
          ref={closeRef}
          type="button"
          className="record-overlay__close"
          aria-label={t('people.cancelMerge')}
          onClick={onClose}
        >
          <RecordControlIcon name="close" />
        </button>
      </header>
      <div className="person-lifecycle-task__body person-merge">
        {people.state.mergeConflict ? (
          <p role="alert">{t('people.merge.conflict')}</p>
        ) : null}
        <label>
          <span>{t('people.merge.duplicate')}</span>
          <select
            value={duplicateId}
            onChange={(event) => setDuplicateId(event.currentTarget.value)}
          >
            <option value="">{t('people.merge.choose')}</option>
            {candidates.map((candidate) => (
              <option key={candidate.person.id} value={candidate.person.id}>
                {candidate.person.displayName}
              </option>
            ))}
          </select>
        </label>
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
    <label>
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value as Value)}
      >
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {t(labels[choice as keyof typeof labels])}
          </option>
        ))}
      </select>
    </label>
  )
}
