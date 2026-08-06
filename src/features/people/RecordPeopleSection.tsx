import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type {
  ClientFailure,
  CivilDate,
  EntryPeopleSnapshot,
  InvalidationToken,
  LifeArchiveClient,
  LinkedPersonSnapshot,
  PersonInteractionLevel,
  PersonLinkDraft,
  RecordPeopleMutation,
  RecordPeopleTarget,
  Revision,
  StableId,
  TimeScale,
} from '../../core/client'
import { civilDate } from '../../core/client'
import { failureMessage, useLocalisation } from '../../i18n'
import { RecordControlIcon, RecordOverlay } from '../record/overlays'
import { deviceCalendar } from '../record/navigation/deviceCalendar'
import { PeopleChooser } from './PeopleChooser'
import { PersonAvatar } from './PersonAvatar'

export function RecordPeopleSection({
  client,
  target,
  entryKind,
  contactDateBounds,
  onEntryRevision,
}: {
  readonly client: LifeArchiveClient
  readonly target: RecordPeopleTarget | null
  readonly entryKind: TimeScale | 'event' | 'span'
  readonly contactDateBounds?: {
    readonly minimum: CivilDate
    readonly maximum: CivilDate
  }
  readonly onEntryRevision?: (entryId: StableId, revision: Revision) => void
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const headingId = useId()
  const contextHeadingId = useId()
  const entryManagerHeadingId = useId()
  const contextClose = useRef<HTMLButtonElement>(null)
  const contextOpener = useRef<HTMLButtonElement>(null)
  const entryManagerClose = useRef<HTMLButtonElement>(null)
  const entryManagerOpener = useRef<HTMLButtonElement>(null)
  const requestGeneration = useRef(0)
  const mutationInFlight = useRef(false)
  const activeMutation = useRef(0)
  const targetKey = recordPeopleTargetKey(target)
  const targetRef = useRef(target)
  const snapshotRef = useRef<EntryPeopleSnapshot | null>(null)
  const tileButtons = useRef<(HTMLButtonElement | null)[]>([])
  const [snapshot, setSnapshot] = useState<EntryPeopleSnapshot | null>(null)
  const [loadedAbsent, setLoadedAbsent] = useState(false)
  const [failure, setFailure] = useState<
    Parameters<typeof failureMessage>[1] | null
  >(null)
  const [undo, setUndo] = useState<readonly PersonLinkDraft[] | null>(null)
  const [removedName, setRemovedName] = useState<string | null>(null)
  const [editing, setEditing] = useState<LinkedPersonSnapshot | null>(null)
  const [entryManagerOpen, setEntryManagerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pendingMutation, setPendingMutation] =
    useState<RecordPeopleMutation | null>(null)
  const invalidationRef = useRef<InvalidationToken | null>(null)

  useEffect(() => {
    targetRef.current = target
  }, [target])

  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current
    const currentTarget = targetRef.current
    setSnapshot(null)
    snapshotRef.current = null
    setLoadedAbsent(false)
    if (!currentTarget) {
      setSnapshot(null)
      return
    }
    const result = await client.people.loadRecordContext({
      target: currentTarget,
    })
    if (requestGeneration.current !== generation) return
    if (result.status === 'failed') {
      setFailure(result.failure)
      return
    }
    setFailure(null)
    setSnapshot(result.value.current)
    snapshotRef.current = result.value.current
    setLoadedAbsent(result.value.outcome === 'absent')
    invalidationRef.current = result.value.invalidation
  }, [client])

  useEffect(() => {
    let active = true
    activeMutation.current += 1
    mutationInFlight.current = false
    invalidationRef.current = null
    globalThis.queueMicrotask(() => {
      if (active) {
        setUndo(null)
        setRemovedName(null)
        setEditing(null)
        setEntryManagerOpen(false)
        setPendingMutation(null)
        setFailure(null)
        setBusy(false)
        void load()
      }
    })
    return () => {
      active = false
      requestGeneration.current += 1
    }
  }, [load, targetKey])

  const mutate = useCallback(
    async (mutation: RecordPeopleMutation) => {
      const currentTarget = targetRef.current
      if (!currentTarget || mutationInFlight.current) return false
      mutationInFlight.current = true
      const operationToken = ++activeMutation.current
      setBusy(true)
      setFailure(null)
      setPendingMutation(mutation)
      const generation = requestGeneration.current
      const operationTargetKey = recordPeopleTargetKey(currentTarget)
      const currentSnapshot = snapshotRef.current
      const result = await client.people.mutateRecordContext({
        target: currentTarget,
        expectedRevision: currentSnapshot?.entryRevision ?? null,
        newEntryId:
          currentSnapshot || !mutationMayCreateOwner(mutation)
            ? null
            : client.operations.newStableId(),
        mutation,
        nowMs: Date.now(),
      })
      if (activeMutation.current !== operationToken) return false
      if (
        requestGeneration.current !== generation ||
        recordPeopleTargetKey(targetRef.current) !== operationTargetKey
      ) {
        mutationInFlight.current = false
        setBusy(false)
        return false
      }
      mutationInFlight.current = false
      setBusy(false)
      if (result.status === 'failed') {
        setFailure(result.failure)
        return false
      }
      if (result.value.outcome === 'conflict') {
        setSnapshot(result.value.conflict.current)
        snapshotRef.current = result.value.conflict.current
        return false
      }
      setFailure(null)
      setPendingMutation(null)
      setSnapshot(result.value.current)
      snapshotRef.current = result.value.current
      setLoadedAbsent(result.value.current === null)
      invalidationRef.current = result.value.invalidation
      if (result.value.current) {
        onEntryRevision?.(
          result.value.current.entryId,
          result.value.current.entryRevision,
        )
      }
      return true
    },
    [client, onEntryRevision],
  )

  const currentDrafts = snapshot?.links.map(linkDraft) ?? []
  const selectedIds = currentDrafts.map(({ personId }) => personId)
  const replaceSelection = async (ids: readonly StableId[]) => {
    const current = new Map(currentDrafts.map((link) => [link.personId, link]))
    const links = ids.map(
      (personId): PersonLinkDraft =>
        current.get(personId) ?? {
          personId,
          interactionLevel: 'none',
          tookPart: false,
          isSubject: false,
        },
    )
    return mutate({ kind: 'replaceLinks', links })
  }

  const remove = async (linked: LinkedPersonSnapshot, index?: number) => {
    const prior = currentDrafts
    if (await mutate({ kind: 'removePeople', personIds: [linked.person.id] })) {
      setUndo(prior)
      setRemovedName(linked.person.displayName)
      globalThis.setTimeout(() => {
        const remainingIndex = Math.min(
          index ?? 0,
          Math.max(0, (snapshotRef.current?.links.length ?? 1) - 1),
        )
        const destination =
          tileButtons.current[remainingIndex] ?? entryManagerOpener.current
        destination?.focus()
      }, 0)
    }
  }

  if (!target) return null
  if (!snapshot && failure) {
    return (
      <div className="record-add-context">
        <p role="alert">{failureMessage(localisation, failure)}</p>
        <button
          type="button"
          className="button"
          onClick={() =>
            void (pendingMutation ? mutate(pendingMutation) : load())
          }
        >
          {t('people.retry')}
        </button>
      </div>
    )
  }
  if (
    (loadedAbsent && !snapshot) ||
    (snapshot !== null && !snapshot.peopleSectionVisible)
  ) {
    return (
      <div className="record-add-context">
        {failure ? (
          <div role="alert" className="record-details__failure">
            <p>{failureMessage(localisation, failure)}</p>
            {pendingMutation ? (
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => void mutate(pendingMutation)}
              >
                {t('people.retry')}
              </button>
            ) : null}
          </div>
        ) : null}
        {!failure && pendingMutation && !busy ? (
          <div role="alert" className="record-editor__conflict">
            <p>{t('record.people.conflict')}</p>
            <button
              type="button"
              className="button"
              onClick={() => void mutate(pendingMutation)}
            >
              {t('people.retry')}
            </button>
          </div>
        ) : null}
        <details>
          <summary>{t('record.people.addContext')}</summary>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void mutate({ kind: 'addSection', sectionId: 'people' })
            }
          >
            <RecordControlIcon name="add" />
            <span>{t('record.people.addSection')}</span>
          </button>
        </details>
      </div>
    )
  }
  if (!snapshot) return null

  return (
    <section className="record-people" aria-labelledby={headingId}>
      <header>
        <h2 id={headingId}>{t('record.people.heading')}</h2>
      </header>
      {failure ? (
        <div role="alert" className="record-details__failure">
          <p>{failureMessage(localisation, failure)}</p>
          {pendingMutation ? (
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => void mutate(pendingMutation)}
            >
              {t('people.retry')}
            </button>
          ) : null}
        </div>
      ) : null}
      {!failure && pendingMutation && !busy ? (
        <div role="alert" className="record-editor__conflict">
          <p>{t('record.people.conflict')}</p>
          <button
            type="button"
            className="button"
            onClick={() => void mutate(pendingMutation)}
          >
            {t('people.retry')}
          </button>
        </div>
      ) : null}
      {snapshot.links.length === 0 ? (
        <p>{t('record.people.empty')}</p>
      ) : (
        <div
          className="record-people__tiles"
          role="list"
          aria-label={t('record.people.heading')}
        >
          {snapshot.links.map((linked, index) => (
            <article
              key={linked.person.id}
              className="record-person-tile"
              role="listitem"
            >
              <button
                ref={(element) => {
                  tileButtons.current[index] = element
                  if (editing?.person.id === linked.person.id)
                    contextOpener.current = element
                }}
                type="button"
                aria-label={t('record.people.tileLabel', {
                  name: linked.person.displayName,
                  interaction: t(
                    `record.people.interaction.${linked.link.interactionLevel}`,
                  ),
                  participation: t(
                    linked.link.tookPart
                      ? 'record.people.tookPart'
                      : 'record.people.didNotTakePart',
                  ),
                  subject: t(
                    linked.link.isSubject
                      ? 'record.people.isSubject'
                      : 'record.people.isNotSubject',
                  ),
                })}
                onClick={(event) => {
                  contextOpener.current = event.currentTarget
                  setEditing(linked)
                }}
              >
                <PersonAvatar
                  client={client}
                  name={linked.person.displayName}
                  photo={linked.profilePhoto}
                  size="medium"
                />
                <strong>{linked.person.displayName}</strong>
                <span>
                  {t(
                    `record.people.interaction.${linked.link.interactionLevel}`,
                  )}
                </span>
                {linked.link.tookPart ? (
                  <span>{t('record.people.tookPart')}</span>
                ) : null}
                {linked.link.isSubject ? (
                  <span>{t('record.people.isSubject')}</span>
                ) : null}
              </button>
              <button
                type="button"
                disabled={busy}
                aria-label={t('record.people.remove', {
                  name: linked.person.displayName,
                })}
                onClick={() => void remove(linked, index)}
              >
                <RecordControlIcon name="close" />
              </button>
            </article>
          ))}
        </div>
      )}
      <div className="record-people__actions">
        <PeopleChooser
          client={client}
          value={selectedIds}
          triggerLabel={t('people.add')}
          disabled={busy}
          onChange={replaceSelection}
        />
        <button
          ref={entryManagerOpener}
          type="button"
          className="button button--secondary"
          disabled={busy}
          onClick={() => setEntryManagerOpen(true)}
        >
          {t('record.people.manage')}
        </button>
        <button
          type="button"
          className="button button--secondary"
          disabled={busy || snapshot.links.length === 0}
          onClick={() => void mutate({ kind: 'clearLinks' })}
        >
          {t('record.people.clear')}
        </button>
        <button
          type="button"
          className="button button--secondary"
          disabled={busy}
          onClick={() =>
            void mutate({ kind: 'removeSection', sectionId: 'people' })
          }
        >
          {t('record.people.removeSection')}
        </button>
      </div>
      {undo && removedName ? (
        <div className="record-people__undo" role="status" aria-live="polite">
          <span>{t('record.people.removed', { name: removedName })}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void mutate({ kind: 'replaceLinks', links: undo }).then(
                (restored) => {
                  if (restored) {
                    setUndo(null)
                    setRemovedName(null)
                  }
                },
              )
            }}
          >
            {t('record.people.undo')}
          </button>
        </div>
      ) : null}
      <RecordOverlay
        open={editing !== null && !entryManagerOpen}
        kind="modal"
        labelledBy={contextHeadingId}
        anchorRef={contextOpener}
        initialFocusRef={contextClose}
        onClose={() => setEditing(null)}
        className="record-person-context"
      >
        {editing ? (
          <PersonContextEditor
            client={client}
            headingId={contextHeadingId}
            closeRef={contextClose}
            linked={editing}
            allowsInteraction={entryKind === 'day' || entryKind === 'event'}
            contactDateBounds={recordContactBounds(target, contactDateBounds)}
            busy={busy}
            onClose={() => setEditing(null)}
            onSave={async (link) => {
              if (await mutate({ kind: 'upsertLink', link })) setEditing(null)
            }}
          />
        ) : null}
      </RecordOverlay>
      <RecordOverlay
        open={entryManagerOpen}
        kind="modal"
        labelledBy={editing ? contextHeadingId : entryManagerHeadingId}
        anchorRef={entryManagerOpener}
        initialFocusRef={editing ? contextClose : entryManagerClose}
        onClose={() => {
          setEditing(null)
          setEntryManagerOpen(false)
        }}
        className={editing ? 'record-person-context' : 'people-manager'}
      >
        {editing ? (
          <PersonContextEditor
            client={client}
            headingId={contextHeadingId}
            closeRef={contextClose}
            linked={editing}
            allowsInteraction={entryKind === 'day' || entryKind === 'event'}
            contactDateBounds={recordContactBounds(target, contactDateBounds)}
            busy={busy}
            onBack={() => {
              setEditing(null)
              globalThis.queueMicrotask(() => contextOpener.current?.focus())
            }}
            onClose={() => {
              setEditing(null)
              setEntryManagerOpen(false)
            }}
            onSave={async (link) => {
              if (await mutate({ kind: 'upsertLink', link })) setEditing(null)
            }}
          />
        ) : (
          <EntryPeopleManager
            client={client}
            headingId={entryManagerHeadingId}
            closeRef={entryManagerClose}
            links={snapshot.links}
            busy={busy}
            onClose={() => setEntryManagerOpen(false)}
            onEdit={(linked, opener) => {
              contextOpener.current = opener
              setEditing(linked)
              globalThis.queueMicrotask(() => contextClose.current?.focus())
            }}
            onMove={(index, offset) => {
              const links = [...currentDrafts]
              const destination = index + offset
              if (destination < 0 || destination >= links.length) return
              ;[links[index], links[destination]] = [
                links[destination]!,
                links[index]!,
              ]
              void mutate({ kind: 'replaceLinks', links })
            }}
            onRemove={(linked, index) => void remove(linked, index)}
          />
        )}
      </RecordOverlay>
    </section>
  )
}

function PersonContextEditor({
  client,
  headingId,
  closeRef,
  linked,
  allowsInteraction,
  contactDateBounds,
  busy,
  onClose,
  onBack,
  onSave,
}: {
  readonly client: LifeArchiveClient
  readonly headingId: string
  readonly closeRef: React.RefObject<HTMLButtonElement | null>
  readonly linked: LinkedPersonSnapshot
  readonly allowsInteraction: boolean
  readonly contactDateBounds: {
    readonly minimum: CivilDate
    readonly maximum: CivilDate
  } | null
  readonly busy: boolean
  readonly onClose: () => void
  readonly onBack?: () => void
  readonly onSave: (link: PersonLinkDraft) => Promise<void>
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const [interactionLevel, setInteraction] = useState<PersonInteractionLevel>(
    allowsInteraction || linked.link.interactionLevel !== 'none'
      ? linked.link.interactionLevel
      : 'brief',
  )
  const [tookPart, setTookPart] = useState(linked.link.tookPart)
  const [isSubject, setIsSubject] = useState(linked.link.isSubject)
  const [contactDate, setContactDate] = useState('')
  const [logging, setLogging] = useState(false)
  const [logFailure, setLogFailure] = useState<ClientFailure | null>(null)
  const [logConflict, setLogConflict] = useState(false)
  const [logSucceeded, setLogSucceeded] = useState(false)
  const contactDateValid =
    contactDate.length > 0 &&
    (!contactDateBounds ||
      (contactDate >= contactDateBounds.minimum &&
        contactDate <= contactDateBounds.maximum))
  const log = async () => {
    if (!contactDateValid || interactionLevel === 'none') return
    setLogging(true)
    setLogFailure(null)
    setLogConflict(false)
    setLogSucceeded(false)
    const calendar = deviceCalendar()
    const day = await client.time.window({
      scale: 'day',
      containing: civilDate(contactDate),
      timeZoneId: calendar.timeZoneId,
      weekRules: calendar.weekRules,
    })
    if (day.status === 'failed') {
      setLogFailure(day.failure)
    } else {
      const result = await client.people.logContact({
        personId: linked.person.id,
        interactionLevel,
        day: day.value,
        newEntryId: client.operations.newStableId(),
        nowMs: Date.now(),
      })
      if (result.status === 'failed') setLogFailure(result.failure)
      else if (result.value.outcome === 'conflict') setLogConflict(true)
      else setLogSucceeded(true)
    }
    setLogging(false)
  }
  return (
    <>
      <header className="record-overlay__header">
        {onBack ? (
          <button
            type="button"
            className="record-overlay__back"
            aria-label={t('record.people.backToManager')}
            onClick={onBack}
          >
            <RecordControlIcon name="back" />
          </button>
        ) : null}
        <h2 id={headingId}>
          {t('record.people.context', { name: linked.person.displayName })}
        </h2>
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
      <div className="record-person-context__body">
        {allowsInteraction ? (
          <fieldset>
            <legend>{t('record.people.interaction')}</legend>
            {(['none', 'brief', 'timeTogether'] as const).map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="interaction"
                  checked={interactionLevel === value}
                  onChange={() => setInteraction(value)}
                />
                <span>{t(`record.people.interaction.${value}`)}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        <label>
          <input
            type="checkbox"
            checked={tookPart}
            onChange={(event) => setTookPart(event.currentTarget.checked)}
          />
          <span>{t('record.people.tookPart')}</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={isSubject}
            onChange={(event) => setIsSubject(event.currentTarget.checked)}
          />
          <span>{t('record.people.isSubject')}</span>
        </label>
        {!allowsInteraction ? (
          <fieldset>
            <legend>{t('record.people.logOnDate')}</legend>
            {logFailure ? (
              <p role="alert">{failureMessage(localisation, logFailure)}</p>
            ) : null}
            {logConflict ? (
              <p role="alert">{t('record.people.logConflict')}</p>
            ) : null}
            {logSucceeded ? (
              <p role="status">{t('record.people.logSucceeded')}</p>
            ) : null}
            <label>
              <span>{t('record.people.contactDate')}</span>
              <input
                type="date"
                value={contactDate}
                min={contactDateBounds?.minimum}
                max={contactDateBounds?.maximum}
                aria-invalid={!contactDateValid && contactDate.length > 0}
                onChange={(event) => setContactDate(event.currentTarget.value)}
              />
            </label>
            <label>
              <span>{t('record.people.contactKind')}</span>
              <select
                value={interactionLevel}
                onChange={(event) =>
                  setInteraction(
                    event.currentTarget.value as PersonInteractionLevel,
                  )
                }
              >
                <option value="brief">
                  {t('record.people.interaction.brief')}
                </option>
                <option value="timeTogether">
                  {t('record.people.interaction.timeTogether')}
                </option>
              </select>
            </label>
            <button
              type="button"
              className="button button--secondary"
              disabled={
                !contactDateValid ||
                logging ||
                busy ||
                logFailure?.durableOutcome === 'unknown'
              }
              onClick={() => void log()}
            >
              {t('record.people.log')}
            </button>
          </fieldset>
        ) : null}
      </div>
      <footer className="record-overlay__footer">
        <button
          type="button"
          className="button button--primary"
          onClick={() =>
            void onSave({
              personId: linked.person.id,
              interactionLevel: allowsInteraction
                ? interactionLevel
                : linked.link.interactionLevel,
              tookPart,
              isSubject,
            })
          }
          disabled={busy}
        >
          {t('record.people.save')}
        </button>
      </footer>
    </>
  )
}

function EntryPeopleManager({
  client,
  headingId,
  closeRef,
  links,
  busy,
  onClose,
  onEdit,
  onMove,
  onRemove,
}: {
  readonly client: LifeArchiveClient
  readonly headingId: string
  readonly closeRef: React.RefObject<HTMLButtonElement | null>
  readonly links: readonly LinkedPersonSnapshot[]
  readonly busy: boolean
  readonly onClose: () => void
  readonly onEdit: (
    linked: LinkedPersonSnapshot,
    opener: HTMLButtonElement,
  ) => void
  readonly onMove: (index: number, offset: -1 | 1) => void
  readonly onRemove: (linked: LinkedPersonSnapshot, index: number) => void
}) {
  const t = useLocalisation().t
  return (
    <>
      <header className="record-overlay__header people-manager__header">
        <div>
          <h2 id={headingId} className="ui-heading">
            {t('record.people.manage')}
          </h2>
          <p className="meta-text">{t('record.people.manage.detail')}</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="record-overlay__close"
          aria-label={t('record.people.closeManager')}
          onClick={onClose}
        >
          <RecordControlIcon name="close" />
        </button>
      </header>
      <div className="people-manager__body">
        {links.length === 0 ? <p>{t('record.people.empty')}</p> : null}
        <div className="people-manager__list record-entry-people-manager__list">
          {links.map((linked, index) => (
            <div
              key={linked.person.id}
              className="record-entry-people-manager__row"
            >
              <button
                type="button"
                disabled={busy}
                onClick={(event) => onEdit(linked, event.currentTarget)}
              >
                <PersonAvatar
                  client={client}
                  name={linked.person.displayName}
                  photo={linked.profilePhoto}
                  size="small"
                />
                <span className="people-manager__copy">
                  <strong>{linked.person.displayName}</strong>
                  <span>
                    {t(
                      `record.people.interaction.${linked.link.interactionLevel}`,
                    )}
                  </span>
                </span>
                <span aria-hidden="true">
                  <RecordControlIcon name="next" />
                </span>
              </button>
              <div className="record-entry-people-manager__order">
                <button
                  type="button"
                  disabled={busy || index === 0}
                  aria-label={t('record.people.moveUp', {
                    name: linked.person.displayName,
                  })}
                  onClick={() => onMove(index, -1)}
                >
                  {t('record.people.up')}
                </button>
                <button
                  type="button"
                  disabled={busy || index === links.length - 1}
                  aria-label={t('record.people.moveDown', {
                    name: linked.person.displayName,
                  })}
                  onClick={() => onMove(index, 1)}
                >
                  {t('record.people.down')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={t('record.people.remove', {
                    name: linked.person.displayName,
                  })}
                  onClick={() => onRemove(linked, index)}
                >
                  <RecordControlIcon name="close" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function linkDraft(linked: LinkedPersonSnapshot): PersonLinkDraft {
  return {
    personId: linked.person.id,
    interactionLevel: linked.link.interactionLevel,
    tookPart: linked.link.tookPart,
    isSubject: linked.link.isSubject,
  }
}

function recordPeopleTargetKey(target: RecordPeopleTarget | null): string {
  if (!target) return 'none'
  return target.kind === 'entry'
    ? `entry:${target.entryId}`
    : `ordinary:${target.window.id}`
}

function mutationMayCreateOwner(mutation: RecordPeopleMutation): boolean {
  switch (mutation.kind) {
    case 'addSection':
    case 'addLinks':
    case 'upsertLink':
      return true
    case 'replaceLinks':
      return mutation.links.length > 0
    case 'removePeople':
    case 'clearLinks':
    case 'removeSection':
      return false
  }
}

function recordContactBounds(
  target: RecordPeopleTarget,
  explicit:
    | {
        readonly minimum: CivilDate
        readonly maximum: CivilDate
      }
    | undefined,
): { readonly minimum: CivilDate; readonly maximum: CivilDate } | null {
  if (explicit) return explicit
  return target.kind === 'ordinary'
    ? {
        minimum: target.window.startDate,
        maximum: target.window.endDate,
      }
    : null
}
