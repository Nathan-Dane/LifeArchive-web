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
        <label className="people-manager__search">
          <span className="visually-hidden">{t('people.search')}</span>
          <input
            type="search"
            value={query}
            placeholder={t('people.search.placeholder')}
            onChange={(event) => {
              setQuery(event.currentTarget.value)
              people.setQuery(event.currentTarget.value)
            }}
          />
        </label>
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
          heading={t('people.active')}
          people={active}
          manageMode={manageMode}
          pendingPersonId={people.state.directoryMutationPersonId}
          onSelect={onSelect}
          onSetArchived={onSetArchived}
        />
        {archived.length > 0 ? (
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
                archived
                manageMode={manageMode}
                pendingPersonId={people.state.directoryMutationPersonId}
                onSelect={onSelect}
                onSetArchived={onSetArchived}
              />
            ) : null}
          </section>
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
  archived = false,
  manageMode = false,
  pendingPersonId,
  onSelect,
  onSetArchived,
}: {
  readonly client: LifeArchiveClient
  readonly heading: string
  readonly people: readonly PersonSnapshot[]
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
      <h3 id={headingId} className="eyebrow">
        {heading}
      </h3>
      <div className="people-manager__list">
        {people.map((snapshot) => (
          <button
            key={snapshot.person.id}
            type="button"
            data-person-id={snapshot.person.id}
            disabled={pendingPersonId === snapshot.person.id}
            onClick={() =>
              manageMode && onSetArchived
                ? onSetArchived(snapshot, !snapshot.person.isArchived)
                : onSelect(snapshot)
            }
          >
            <PersonAvatar
              client={client}
              name={snapshot.person.displayName}
              photo={snapshot.profilePhoto}
              size="small"
            />
            <span className="people-manager__copy">
              <strong>{snapshot.person.displayName}</strong>
              {snapshot.person.connectionLabels[0] ? (
                <span>
                  {t('people.primaryConnection', {
                    label: snapshot.person.connectionLabels[0],
                  })}
                </span>
              ) : null}
              {snapshot.lastRecordedContactDate ? (
                <span className="meta-text">
                  {t('people.lastContact', {
                    date: format.civilDate(
                      snapshot.lastRecordedContactDate,
                      'medium',
                    ),
                  })}
                </span>
              ) : null}
              {archived ? (
                <span className="meta-text">{t('people.archived.label')}</span>
              ) : null}
            </span>
            {manageMode ? (
              <span className="people-manager__row-action">
                {t(archived ? 'people.restore' : 'people.archive')}
              </span>
            ) : (
              <span aria-hidden="true">
                <RecordControlIcon name="next" />
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}
