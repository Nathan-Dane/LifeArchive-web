import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import {
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
import { RecordControlIcon } from '../../ui/overlay'
import { useRecordPersonOrigin } from '../../ui/navigation/recordPersonOrigin'
import { PeopleManager } from './PeopleManager'
import { PersonEditorPage } from './PersonEditorPage'
import { PersonProfilePage } from './PersonProfilePage'
import { PersonQuickCreateDialog } from './PersonQuickCreateDialog'
import { usePeople, type People } from './usePeople'

export function PeoplePage({ client }: { readonly client: LifeArchiveClient }) {
  const people = usePeople(client)
  const t = useLocalisation().t
  const navigate = useNavigate()
  const location = useLocation()
  const recordOrigin = useRecordPersonOrigin()
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
    if (recordOrigin.returnToRecord()) return
    navigate('/index/people')
  }
  const navigatePersonRoute = (to: string) =>
    navigate(to, { state: recordOrigin.stateForPersonRoute() })

  return (
    <div className="people-page">
      {recordOrigin.expiredOrigin ? (
        <p className="person-page__origin-notice" role="status">
          {t('people.profile.recordOriginExpired')}
        </p>
      ) : null}
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
              backToRecord={recordOrigin.hasOrigin}
              onEdit={(personId) =>
                navigatePersonRoute(`/index/people/${personId}/edit`)
              }
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
              backToRecord={recordOrigin.hasOrigin}
              onViewProfile={(personId) =>
                navigatePersonRoute(`/index/people/${personId}`)
              }
            />
          }
        />
        <Route path="*" element={<Navigate to="/index/people" replace />} />
      </Routes>
      <PersonQuickCreateDialog
        people={people}
        open={quickCreateOpen}
        anchorRef={newPersonButton}
        onClose={() => {
          setQuickCreateOpen(false)
          people.resetQuickCreate()
        }}
        onCreated={(snapshot) => {
          setQuickCreateOpen(false)
          navigate(`/index/people/${snapshot.person.id}/edit`)
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
        <span className="eyebrow">{t('index.page.title')}</span>
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
            {t(manageMode ? 'people.manage.done' : 'people.manage.directory')}
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
        onManageModeChange={onManageModeChange}
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
  backToRecord,
}: {
  readonly client: LifeArchiveClient
  readonly people: People
  readonly mode: 'profile' | 'editor'
  readonly onBack: () => void
  readonly onDeleted: () => void
  readonly onEdit?: (personId: StableId) => void
  readonly onViewProfile?: (personId: StableId) => void
  readonly backToRecord: boolean
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
        backToRecord={backToRecord}
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
      backToRecord={backToRecord}
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
