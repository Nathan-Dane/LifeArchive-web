import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import type { LifeArchiveClient, PersonSnapshot } from '../../core/client'
import { failureMessage, useFormat, useLocalisation } from '../../i18n'
import { RecordControlIcon } from '../../ui/overlay'
import { PersonAvatar } from './PersonAvatar'
import type { People } from './usePeople'

export function PeopleManager({
  client,
  people,
  headingId,
  closeRef,
  showClose = true,
  initialScroll = 0,
  initialShowArchived = false,
  presentation = 'overlay',
  manageMode = false,
  onScrollChange,
  onManageModeChange,
  onShowArchivedChange,
  onClose,
  onCreate,
  onSelect,
  onSetArchived,
}: {
  readonly client: LifeArchiveClient
  readonly people: People
  readonly headingId: string
  readonly closeRef?: RefObject<HTMLButtonElement | null>
  readonly showClose?: boolean
  readonly initialScroll?: number
  readonly initialShowArchived?: boolean
  readonly presentation?: 'overlay' | 'directory'
  readonly manageMode?: boolean
  readonly onScrollChange?: (value: number) => void
  readonly onManageModeChange?: (value: boolean) => void
  readonly onShowArchivedChange?: (value: boolean) => void
  readonly onClose?: () => void
  readonly onCreate: () => void
  readonly onSelect: (snapshot: PersonSnapshot) => void
  readonly onSetArchived?: (snapshot: PersonSnapshot, archived: boolean) => void
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const [query, setQuery] = useState(people.state.query)
  const [showArchived, setShowArchived] = useState(initialShowArchived)
  const body = useRef<HTMLDivElement>(null)
  const listPeople = people.list
  const listedQuery = people.state.listedQuery
  const active = people.state.people.filter(({ person }) => !person.isArchived)
  const archived = people.state.people.filter(({ person }) => person.isArchived)

  useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = initialScroll
  }, [initialScroll])

  useEffect(() => {
    if (query === listedQuery) return
    const timer = globalThis.setTimeout(() => void listPeople(query), 250)
    return () => globalThis.clearTimeout(timer)
  }, [listPeople, listedQuery, query])

  return (
    <>
      {presentation === 'overlay' ? (
        <header className="record-overlay__header people-manager__header">
          <div>
            <h2 id={headingId} className="ui-heading">
              {t('people.manage')}
            </h2>
            <p className="meta-text">{t('people.manage.detail')}</p>
          </div>
          {showClose ? (
            <button
              ref={closeRef}
              type="button"
              className="record-overlay__close"
              aria-label={t('people.close.manager')}
              onClick={onClose}
            >
              <RecordControlIcon name="close" />
            </button>
          ) : null}
        </header>
      ) : null}
      <div
        ref={body}
        className="people-manager__body"
        data-presentation={presentation}
        onScroll={(event) => onScrollChange?.(event.currentTarget.scrollTop)}
      >
        <div className="people-manager__toolbar" role="search">
          <label className="people-manager__search">
            <span className="visually-hidden">{t('people.search')}</span>
            <input
              type="search"
              value={query}
              placeholder={t(
                presentation === 'directory'
                  ? 'people.search.placeholder.directory'
                  : 'people.search.placeholder',
              )}
              onChange={(event) => {
                setQuery(event.currentTarget.value)
                people.setQuery(event.currentTarget.value)
              }}
            />
          </label>
          {presentation === 'directory' ? (
            <button
              type="button"
              className="button button--secondary"
              aria-pressed={manageMode}
              onClick={() => onManageModeChange?.(!manageMode)}
            >
              {t(manageMode ? 'people.manage.done' : 'people.manage.directory')}
            </button>
          ) : null}
        </div>
        {people.state.listFailure && people.state.listStatus === 'failed' ? (
          <div role="alert" className="record-details__failure">
            <p>{failureMessage(localisation, people.state.listFailure)}</p>
            <button
              type="button"
              className="button"
              onClick={() => void people.list(query)}
            >
              {t('people.retry')}
            </button>
          </div>
        ) : null}
        {people.state.listStatus === 'loading' &&
        people.state.people.length === 0 ? (
          <p role="status">{t('people.loading')}</p>
        ) : null}
        <PeopleGroup
          client={client}
          heading={t(
            presentation === 'directory'
              ? 'people.active.directory'
              : 'people.active',
          )}
          people={active}
          presentation={presentation}
          manageMode={manageMode}
          pendingPersonId={people.state.directoryMutationPersonId}
          onSelect={onSelect}
          onSetArchived={onSetArchived}
        />
        {archived.length > 0 && presentation === 'overlay' ? (
          <section className="people-manager__archived">
            <button
              type="button"
              aria-expanded={showArchived}
              onClick={() =>
                setShowArchived((value) => {
                  onShowArchivedChange?.(!value)
                  return !value
                })
              }
            >
              <span>{t('people.archived')}</span>
              <span aria-hidden="true">
                <RecordControlIcon name="expand" />
              </span>
            </button>
            {showArchived ? (
              <PeopleGroup
                client={client}
                heading={t('people.archived')}
                people={archived}
                presentation={presentation}
                archived
                manageMode={manageMode}
                pendingPersonId={people.state.directoryMutationPersonId}
                onSelect={onSelect}
                onSetArchived={onSetArchived}
              />
            ) : null}
          </section>
        ) : archived.length > 0 ? (
          <PeopleGroup
            client={client}
            heading={t('people.archived.directory')}
            people={archived}
            archived
            presentation={presentation}
            manageMode={manageMode}
            pendingPersonId={people.state.directoryMutationPersonId}
            onSelect={onSelect}
            onSetArchived={onSetArchived}
          />
        ) : null}
        {active.length === 0 &&
        (archived.length === 0 || !showArchived) &&
        people.state.listStatus !== 'loading' ? (
          <p className="people-manager__empty">
            {t(query ? 'people.empty.search' : 'people.empty')}
          </p>
        ) : null}
        {people.state.listStatus === 'appendFailed' &&
        people.state.listFailure ? (
          <div role="alert" className="record-details__failure">
            <p>{failureMessage(localisation, people.state.listFailure)}</p>
            <button
              type="button"
              className="button"
              onClick={() => void people.loadMore()}
            >
              {t('people.retry')}
            </button>
          </div>
        ) : null}
        {people.state.directoryMutationFailure ? (
          <p role="alert" className="record-details__failure">
            {failureMessage(
              localisation,
              people.state.directoryMutationFailure,
            )}
          </p>
        ) : null}
        {people.state.directoryMutationConflict ? (
          <p role="alert" className="record-details__failure">
            {t('people.mutationConflict.detail')}
          </p>
        ) : null}
        {people.state.hasMore && people.state.listStatus !== 'appendFailed' ? (
          <button
            type="button"
            className="button button--secondary"
            disabled={people.state.listStatus === 'loadingMore'}
            onClick={() => void people.loadMore()}
          >
            {t(
              people.state.listStatus === 'loadingMore'
                ? 'people.loading'
                : 'people.loadMore',
            )}
          </button>
        ) : null}
      </div>
      {presentation === 'overlay' ? (
        <footer className="record-overlay__footer people-manager__footer">
          <button
            type="button"
            className="button button--primary"
            onClick={onCreate}
          >
            <RecordControlIcon name="add" />
            <span>{t('people.new')}</span>
          </button>
        </footer>
      ) : null}
    </>
  )
}

function PeopleGroup({
  client,
  heading,
  people,
  presentation = 'overlay',
  archived = false,
  manageMode = false,
  pendingPersonId,
  onSelect,
  onSetArchived,
}: {
  readonly client: LifeArchiveClient
  readonly heading: string
  readonly people: readonly PersonSnapshot[]
  readonly presentation?: 'overlay' | 'directory'
  readonly archived?: boolean
  readonly manageMode?: boolean
  readonly pendingPersonId: PersonSnapshot['person']['id'] | null
  readonly onSelect: (snapshot: PersonSnapshot) => void
  readonly onSetArchived?: (snapshot: PersonSnapshot, archived: boolean) => void
}) {
  const t = useLocalisation().t
  const format = useFormat()
  const headingId = useId()
  if (people.length === 0) return null
  return (
    <section
      className="people-manager__group"
      aria-labelledby={headingId}
      data-archived={archived || undefined}
    >
      <div className="people-manager__group-heading eyebrow">
        <h3 id={headingId}>{heading}</h3>
        <span>{people.length}</span>
      </div>
      <div className="people-manager__list">
        {people.map((snapshot) => {
          const contactDate = snapshot.lastRecordedContactDate
            ? format.civilDate(snapshot.lastRecordedContactDate, 'medium')
            : null
          return (
            <div className="people-manager__row" key={snapshot.person.id}>
              <button
                type="button"
                className="people-manager__open"
                data-person-id={snapshot.person.id}
                disabled={pendingPersonId === snapshot.person.id}
                onClick={() => onSelect(snapshot)}
              >
                <PersonAvatar
                  client={client}
                  name={snapshot.person.displayName}
                  photo={snapshot.profilePhoto}
                  size="small"
                />
                <span className="people-manager__copy">
                  <strong>{snapshot.person.displayName}</strong>
                  {presentation === 'directory' ? (
                    <span className="meta-text">
                      {snapshot.person.connectionLabels[0] ??
                        t('people.connections.none')}
                      {contactDate
                        ? ` · ${t('people.lastContact.short', {
                            date: contactDate,
                          })}`
                        : ''}
                    </span>
                  ) : (
                    <>
                      {snapshot.person.connectionLabels[0] ? (
                        <span>
                          {t('people.primaryConnection', {
                            label: snapshot.person.connectionLabels[0],
                          })}
                        </span>
                      ) : null}
                      {contactDate ? (
                        <span className="meta-text">
                          {t('people.lastContact', { date: contactDate })}
                        </span>
                      ) : null}
                      {archived ? (
                        <span className="meta-text">
                          {t('people.archived.label')}
                        </span>
                      ) : null}
                    </>
                  )}
                </span>
                {!manageMode ? (
                  <span className="people-manager__trail" aria-hidden="true">
                    {presentation === 'directory' && contactDate ? (
                      <span>{contactDate}</span>
                    ) : null}
                    <RecordControlIcon name="next" />
                  </span>
                ) : null}
              </button>
              {manageMode && onSetArchived ? (
                <button
                  type="button"
                  className="people-manager__manage-action"
                  aria-label={t(
                    archived ? 'people.restore.named' : 'people.archive.named',
                    { name: snapshot.person.displayName },
                  )}
                  disabled={pendingPersonId === snapshot.person.id}
                  onClick={() =>
                    onSetArchived(snapshot, !snapshot.person.isArchived)
                  }
                >
                  <RecordControlIcon name={archived ? 'restore' : 'archive'} />
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
