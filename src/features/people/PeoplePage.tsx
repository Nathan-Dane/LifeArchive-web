import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import {
  isStableId,
  stableId,
  type LifeArchiveClient,
  type StableId,
} from '../../core/client'
import { failureMessage, useLocalisation } from '../../i18n'
import { RecordControlIcon, RecordOverlay } from '../../ui/overlay'
import { STANDARD_CONNECTION_LABELS } from './connectionLabels'
import { PeopleManager } from './PeopleManager'
import { PersonEditorPage } from './PersonEditorPage'
import { PersonProfilePage } from './PersonProfilePage'
import { usePeople, type People } from './usePeople'

export function PeoplePage({ client }: { readonly client: LifeArchiveClient }) {
  const people = usePeople(client)
  const navigate = useNavigate()
  const location = useLocation()
  const [directoryScroll, setDirectoryScroll] = useState(0)
  const [manageMode, setManageMode] = useState(false)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const newPersonButton = useRef<HTMLButtonElement>(null)
  const returnFocusPersonId = useRef<string | null>(null)

  useEffect(() => {
    if (location.pathname !== '/index/people') return
    const personId = returnFocusPersonId.current
    if (!personId) return
    returnFocusPersonId.current = null
    globalThis.queueMicrotask(() => {
      document
        .querySelector<HTMLElement>(`[data-person-id="${personId}"]`)
        ?.focus()
    })
  }, [location.pathname])

  const backToDirectory = () => {
    people.closeEditor()
    navigate('/index/people')
  }

  return (
    <div className="people-page">
      <Routes>
        <Route
          index
          element={
            <PeopleDirectory
              client={client}
              people={people}
              manageMode={manageMode}
              initialScroll={directoryScroll}
              newPersonButton={newPersonButton}
              onScrollChange={setDirectoryScroll}
              onManageModeChange={setManageMode}
              onCreate={() => setQuickCreateOpen(true)}
              onSelect={(personId) => {
                returnFocusPersonId.current = personId
                navigate(personId)
              }}
            />
          }
        />
        <Route
          path=":personId"
          element={
            <AddressedPerson
              client={client}
              people={people}
              mode="profile"
              onBack={backToDirectory}
              onDeleted={backToDirectory}
              onEdit={(personId) => navigate(`${personId}/edit`)}
            />
          }
        />
        <Route
          path=":personId/edit"
          element={
            <AddressedPerson
              client={client}
              people={people}
              mode="editor"
              onBack={backToDirectory}
              onDeleted={backToDirectory}
              onViewProfile={(personId) =>
                navigate(`/index/people/${personId}`)
              }
            />
          }
        />
        <Route path="*" element={<Navigate to="/index/people" replace />} />
      </Routes>
      <QuickCreateDialog
        people={people}
        open={quickCreateOpen}
        anchorRef={newPersonButton}
        onClose={() => {
          setQuickCreateOpen(false)
          people.resetQuickCreate()
        }}
        onCreated={(personId) => {
          setQuickCreateOpen(false)
          navigate(`${personId}/edit`)
        }}
      />
    </div>
  )
}

function PeopleDirectory({
  client,
  people,
  manageMode,
  initialScroll,
  newPersonButton,
  onScrollChange,
  onManageModeChange,
  onCreate,
  onSelect,
}: {
  readonly client: LifeArchiveClient
  readonly people: People
  readonly manageMode: boolean
  readonly initialScroll: number
  readonly newPersonButton: RefObject<HTMLButtonElement | null>
  readonly onScrollChange: (value: number) => void
  readonly onManageModeChange: (value: boolean) => void
  readonly onCreate: () => void
  readonly onSelect: (personId: string) => void
}) {
  const t = useLocalisation().t
  const headingId = useId()

  return (
    <section className="people-directory" aria-labelledby={headingId}>
      <nav className="people-breadcrumbs" aria-label={t('people.breadcrumbs')}>
        <Link to="/index">{t('index.page.title')}</Link>
        <RecordControlIcon name="next" />
        <span aria-current="page">{t('people.page.title')}</span>
      </nav>
      <header className="people-directory__header">
        <div>
          <h1 id={headingId}>{t('people.page.title')}</h1>
          <p>{t('people.page.detail')}</p>
        </div>
        <div className="people-directory__actions">
          <button
            type="button"
            className="button button--secondary"
            aria-pressed={manageMode}
            onClick={() => onManageModeChange(!manageMode)}
          >
            {t(manageMode ? 'people.manage.done' : 'people.manage')}
          </button>
          <button
            ref={newPersonButton}
            type="button"
            className="button button--primary"
            onClick={onCreate}
          >
            <RecordControlIcon name="add" />
            <span>{t('people.new')}</span>
          </button>
        </div>
      </header>
      <PeopleManager
        client={client}
        people={people}
        headingId={headingId}
        presentation="directory"
        manageMode={manageMode}
        showClose={false}
        initialScroll={initialScroll}
        initialShowArchived
        onScrollChange={onScrollChange}
        onCreate={onCreate}
        onSelect={(snapshot) => onSelect(snapshot.person.id)}
        onSetArchived={(snapshot, archived) =>
          void people.setArchivedFromDirectory(snapshot, archived)
        }
      />
    </section>
  )
}

function AddressedPerson({
  client,
  people,
  mode,
  onBack,
  onDeleted,
  onEdit,
  onViewProfile,
}: {
  readonly client: LifeArchiveClient
  readonly people: People
  readonly mode: 'profile' | 'editor'
  readonly onBack: () => void
  readonly onDeleted: () => void
  readonly onEdit?: (personId: StableId) => void
  readonly onViewProfile?: (personId: StableId) => void
}) {
  const localisation = useLocalisation()
  const { personId = '' } = useParams()
  const validPersonId = isStableId(personId) ? stableId(personId) : null
  const selectedPersonId = people.state.selected?.person.id
  const selectById = people.selectById

  useEffect(() => {
    if (!validPersonId) return
    if (selectedPersonId === validPersonId) return
    void selectById(validPersonId)
  }, [selectById, selectedPersonId, validPersonId])

  if (!validPersonId) {
    return <PersonLoadFailure onBack={onBack} />
  }
  if (people.state.profileStatus === 'failed' && people.state.profileFailure) {
    return (
      <PersonLoadFailure
        failure={failureMessage(localisation, people.state.profileFailure)}
        onBack={onBack}
        onRetry={() => void people.selectById(validPersonId)}
      />
    )
  }
  if (mode === 'profile') {
    return (
      <PersonProfilePage
        client={client}
        people={people}
        onBack={onBack}
        onEdit={() => onEdit?.(validPersonId)}
        onDeleted={onDeleted}
      />
    )
  }
  return (
    <PersonEditorPage
      client={client}
      people={people}
      onBack={onBack}
      onViewProfile={() => onViewProfile?.(validPersonId)}
      onDeleted={onDeleted}
    />
  )
}

function PersonLoadFailure({
  failure,
  onBack,
  onRetry,
}: {
  readonly failure?: string
  readonly onBack: () => void
  readonly onRetry?: () => void
}) {
  const t = useLocalisation().t
  return (
    <section className="person-page person-page--state">
      <h1>{t('people.notFound')}</h1>
      <p role={failure ? 'alert' : undefined}>
        {failure ?? t('people.notFound.detail')}
      </p>
      <div className="people-directory__actions">
        {onRetry ? (
          <button type="button" className="button" onClick={onRetry}>
            {t('people.retry')}
          </button>
        ) : null}
        <button type="button" className="button" onClick={onBack}>
          {t('people.back')}
        </button>
      </div>
    </section>
  )
}

function QuickCreateDialog({
  people,
  open,
  anchorRef,
  onClose,
  onCreated,
}: {
  readonly people: People
  readonly open: boolean
  readonly anchorRef: RefObject<HTMLElement | null>
  readonly onClose: () => void
  readonly onCreated: (personId: string) => void
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const headingId = useId()
  const nameInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [connection, setConnection] = useState('')
  const busy = people.state.quickCreateStatus === 'saving'
  const valid = /\S/u.test(name)

  const close = () => {
    if (busy) return
    setName('')
    setConnection('')
    onClose()
  }
  const create = async () => {
    const snapshot = await people.quickCreate(name, connection || null)
    if (!snapshot) return
    setName('')
    setConnection('')
    onCreated(snapshot.person.id)
  }

  return (
    <RecordOverlay
      open={open}
      kind="modal"
      modalPlacement="center"
      labelledBy={headingId}
      anchorRef={anchorRef}
      initialFocusRef={nameInput}
      onClose={close}
      className="people-quick-create"
    >
      <header className="record-overlay__header">
        <div>
          <h2 id={headingId} className="ui-heading">
            {t('people.create.heading')}
          </h2>
          <p className="meta-text">{t('people.create.quick.detail')}</p>
        </div>
        <button
          type="button"
          className="record-overlay__close"
          aria-label={t('people.cancel')}
          disabled={busy}
          onClick={close}
        >
          <RecordControlIcon name="close" />
        </button>
      </header>
      <div className="people-quick-create__body">
        {people.state.quickCreateFailure ? (
          <p role="alert" className="record-details__failure">
            {failureMessage(localisation, people.state.quickCreateFailure)}
          </p>
        ) : null}
        <label className="person-field">
          <span>{t('people.name')}</span>
          <input
            ref={nameInput}
            value={name}
            disabled={busy}
            required
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <label className="person-field">
          <span>{t('people.connections.optional')}</span>
          <select
            value={connection}
            disabled={busy}
            onChange={(event) => setConnection(event.currentTarget.value)}
          >
            <option value="">{t('people.connections.none')}</option>
            {STANDARD_CONNECTION_LABELS.map(({ value, message }) => (
              <option key={value} value={value}>
                {t(message)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <footer className="record-overlay__footer people-quick-create__footer">
        <button
          type="button"
          className="button button--secondary"
          disabled={busy}
          onClick={close}
        >
          {t('people.cancel')}
        </button>
        <button
          type="button"
          className="button button--primary"
          disabled={!valid || busy}
          onClick={() => void create()}
        >
          {t(busy ? 'people.saving' : 'people.create.continue')}
        </button>
      </footer>
    </RecordOverlay>
  )
}
