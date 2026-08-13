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
  onScrollChange,
  onShowArchivedChange,
  onClose,
  onCreate,
  onSelect,
}: {
  readonly client: LifeArchiveClient
  readonly people: People
  readonly headingId: string
  readonly closeRef?: RefObject<HTMLButtonElement | null>
  readonly showClose?: boolean
  readonly initialScroll?: number
  readonly initialShowArchived?: boolean
  readonly onScrollChange?: (value: number) => void
  readonly onShowArchivedChange?: (value: boolean) => void
  readonly onClose?: () => void
  readonly onCreate: () => void
  readonly onSelect: (snapshot: PersonSnapshot) => void
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
      <div
        ref={body}
        className="people-manager__body"
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
        {people.state.failure ? (
          <div role="alert" className="record-details__failure">
            <p>{failureMessage(localisation, people.state.failure)}</p>
            <button
              type="button"
              className="button"
              onClick={() => void people.list(query)}
            >
              {t('people.retry')}
            </button>
          </div>
        ) : null}
        {people.state.status === 'loading' &&
        people.state.people.length === 0 ? (
          <p role="status">{t('people.loading')}</p>
        ) : null}
        <PeopleGroup
          client={client}
          heading={t('people.active')}
          people={active}
          onSelect={onSelect}
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
                onSelect={onSelect}
              />
            ) : null}
          </section>
        ) : null}
        {active.length === 0 &&
        (archived.length === 0 || !showArchived) &&
        people.state.status !== 'loading' ? (
          <p className="people-manager__empty">
            {t(query ? 'people.empty.search' : 'people.empty')}
          </p>
        ) : null}
        {people.state.hasMore ? (
          <button
            type="button"
            className="button button--secondary"
            onClick={() => void people.loadMore()}
          >
            {t('people.loadMore')}
          </button>
        ) : null}
      </div>
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
    </>
  )
}

function PeopleGroup({
  client,
  heading,
  people,
  archived = false,
  onSelect,
}: {
  readonly client: LifeArchiveClient
  readonly heading: string
  readonly people: readonly PersonSnapshot[]
  readonly archived?: boolean
  readonly onSelect: (snapshot: PersonSnapshot) => void
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
            <span aria-hidden="true">
              <RecordControlIcon name="next" />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
