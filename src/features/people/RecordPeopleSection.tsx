import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type {
  CivilDate,
  ClientFailure,
  CurrentOrdinaryPersonRole,
  EntryPeopleSnapshot,
  InvalidationToken,
  LifeArchiveClient,
  LinkedPersonSnapshot,
  PersonLinkDraft,
  PersonRecordRole,
  PersonSnapshot,
  RecordPeopleMutation,
  RecordPeopleTarget,
  Revision,
  StableId,
  TimeScale,
} from '../../core/client'
import { civilDate } from '../../core/client'
import { failureMessage, useLocalisation } from '../../i18n'
import { deviceCalendar } from '../../platform/calendar'
import { RecordControlIcon, RecordOverlay } from '../../ui/overlay'
import { MATERIAL_UI_GLYPHS, RecordDatePicker } from '../record/metadata'
import { PeopleSelect } from './PeopleSelect'
import { PersonAvatar } from './PersonAvatar'
import { PersonQuickCreateDialog } from './PersonQuickCreateDialog'
import { PeopleTaskHeader } from './PeopleTaskHeader'
import {
  displayRole,
  groupRecordPeople,
  recordPersonRoleSelected,
  toggleRecordPersonRole,
  type RecordPeopleGroups,
  type RecordPersonRole,
} from './recordPeoplePresentation'
import { usePeople } from './usePeople'

interface UndoState {
  readonly snapshot: EntryPeopleSnapshot | null
  readonly message: string
}

export function RecordPeopleSection({
  client,
  target,
  entryKind,
  contactDateBounds,
  onEntryRevision,
  onViewPerson,
  onEditPerson,
}: {
  readonly client: LifeArchiveClient
  readonly target: RecordPeopleTarget | null
  readonly entryKind: TimeScale | 'event' | 'span'
  readonly contactDateBounds?: {
    readonly minimum: CivilDate
    readonly maximum: CivilDate
  }
  readonly onEntryRevision?: (entryId: StableId, revision: Revision) => void
  readonly onViewPerson?: (
    personId: StableId,
    opener: HTMLButtonElement,
  ) => void
  readonly onEditPerson?: (
    personId: StableId,
    opener: HTMLButtonElement,
  ) => void
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const headingId = useId()
  const contextHeadingId = useId()
  const entryManagerHeadingId = useId()
  const sectionOptionsId = useId()
  const sectionOptionsButtonId = useId()
  const contextClose = useRef<HTMLButtonElement>(null)
  const contextOpener = useRef<HTMLButtonElement>(null)
  const entryManagerClose = useRef<HTMLButtonElement>(null)
  const entryManagerOpener = useRef<HTMLButtonElement>(null)
  const sectionOptionsOpener = useRef<HTMLButtonElement>(null)
  const requestGeneration = useRef(0)
  const mutationInFlight = useRef(false)
  const activeMutation = useRef(0)
  const targetKey = recordPeopleTargetKey(target)
  const targetRef = useRef(target)
  const snapshotRef = useRef<EntryPeopleSnapshot | null>(null)
  const personButtons = useRef(new Map<StableId, HTMLButtonElement>())
  const [snapshot, setSnapshot] = useState<EntryPeopleSnapshot | null>(null)
  const [loadedAbsent, setLoadedAbsent] = useState(false)
  const [failure, setFailure] = useState<
    Parameters<typeof failureMessage>[1] | null
  >(null)
  const [undo, setUndo] = useState<UndoState | null>(null)
  const [editingPersonId, setEditingPersonId] = useState<StableId | null>(null)
  const [entryManagerOpen, setEntryManagerOpen] = useState(false)
  const [sectionOptionsOpen, setSectionOptionsOpen] = useState(false)
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
    if (!currentTarget) return
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
      if (!active) return
      setUndo(null)
      setEditingPersonId(null)
      setEntryManagerOpen(false)
      setSectionOptionsOpen(false)
      setPendingMutation(null)
      setFailure(null)
      setBusy(false)
      void load()
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

  const mutateWithUndo = useCallback(
    async (mutation: RecordPeopleMutation, message: string) => {
      const prior = snapshotRef.current
      const changed = await mutate(mutation)
      if (changed) setUndo({ snapshot: prior, message })
      return changed
    },
    [mutate],
  )

  const restoreUndo = useCallback(async () => {
    if (!undo) return
    const prior = undo.snapshot
    const current = snapshotRef.current
    if (!prior?.peopleSectionVisible) {
      if (current?.peopleSectionVisible) {
        if (await mutate({ kind: 'removeSection', sectionId: 'people' })) {
          setUndo(null)
        }
      } else {
        setUndo(null)
      }
      return
    }
    if (!current?.peopleSectionVisible) {
      const restoredSection = await mutate({
        kind: 'addSection',
        sectionId: 'people',
      })
      if (!restoredSection) return
    }
    const restoredLinks =
      prior.links.length === 0
        ? await mutate({ kind: 'clearLinks' })
        : await mutate({
            kind: 'replaceLinks',
            links: prior.links.map(linkDraft),
          })
    if (restoredLinks) setUndo(null)
  }, [mutate, undo])

  const remove = useCallback(
    async (linked: LinkedPersonSnapshot) => {
      const changed = await mutateWithUndo(
        { kind: 'removePeople', personIds: [linked.person.id] },
        t('record.people.removed', { name: linked.person.displayName }),
      )
      if (changed) {
        setEditingPersonId((current) =>
          current === linked.person.id ? null : current,
        )
        const destination = personButtons.current.get(
          snapshotRef.current?.links[0]?.person.id ?? linked.person.id,
        )
        globalThis.setTimeout(
          () => (destination ?? entryManagerOpener.current)?.focus(),
          0,
        )
      }
      return changed
    },
    [mutateWithUndo, t],
  )

  const updateRole = useCallback(
    async (person: PersonSnapshot, role: RecordPersonRole) => {
      const linked = snapshotRef.current?.links.find(
        (value) => value.person.id === person.person.id,
      )
      const next = linked
        ? toggleRecordPersonRole(linkDraft(linked), role)
        : { personId: person.person.id, roleId: role }
      return mutateWithUndo(
        { kind: 'upsertLink', link: next },
        t(linked ? 'record.people.contextChanged' : 'record.people.added', {
          name: person.person.displayName,
        }),
      )
    },
    [mutateWithUndo, t],
  )

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
          <MutationFailure
            failure={failure}
            mutation={pendingMutation}
            busy={busy}
            onRetry={mutate}
          />
        ) : null}
        {!failure && pendingMutation && !busy ? (
          <MutationConflict mutation={pendingMutation} onRetry={mutate} />
        ) : null}
        <details>
          <summary>{t('record.people.addContext')}</summary>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void mutateWithUndo(
                { kind: 'addSection', sectionId: 'people' },
                t('record.people.sectionAdded'),
              )
            }
          >
            <RecordControlIcon name="add" />
            <span>{t('record.people.addSection')}</span>
          </button>
        </details>
        <UndoNotice undo={undo} busy={busy} onUndo={restoreUndo} />
      </div>
    )
  }
  if (!snapshot) return null

  const groups = groupRecordPeople(snapshot.links)
  const editing = editingPersonId
    ? (snapshot.links.find(({ person }) => person.id === editingPersonId) ??
      null)
    : null
  const allowsInteraction = entryKind === 'day' || entryKind === 'event'

  const openTask = (
    linked: LinkedPersonSnapshot,
    opener: HTMLButtonElement,
  ) => {
    contextOpener.current = opener
    setEditingPersonId(linked.person.id)
  }

  return (
    <section
      className="record-people record-people--weighted"
      aria-labelledby={headingId}
    >
      <header className="record-people__header">
        <h2 id={headingId} aria-label={t('record.people.heading')}>
          {t('record.people.headingWithCount', {
            count: snapshot.links.length,
          })}
        </h2>
        <div className="record-people__header-actions">
          <button
            ref={entryManagerOpener}
            type="button"
            className="record-people__header-action"
            disabled={busy}
            aria-label={t('record.people.manage')}
            onClick={() => setEntryManagerOpen(true)}
          >
            <RecordControlIcon name="add" />
          </button>
          <button
            id={sectionOptionsButtonId}
            ref={sectionOptionsOpener}
            type="button"
            className="record-people__header-action"
            disabled={busy}
            aria-label={t('record.people.sectionOptions')}
            aria-haspopup="menu"
            aria-expanded={sectionOptionsOpen}
            aria-controls={sectionOptionsId}
            onClick={() => setSectionOptionsOpen((current) => !current)}
          >
            <RecordControlIcon name="more" />
          </button>
        </div>
      </header>
      <div className="record-people__body">
        {failure ? (
          <MutationFailure
            failure={failure}
            mutation={pendingMutation}
            busy={busy}
            onRetry={mutate}
          />
        ) : null}
        {!failure && pendingMutation && !busy ? (
          <MutationConflict mutation={pendingMutation} onRetry={mutate} />
        ) : null}
        {snapshot.links.length === 0 ? (
          <div className="record-people__empty">
            <p>{t('record.people.empty')}</p>
            <button
              type="button"
              className="button button--primary"
              disabled={busy}
              onClick={() => setEntryManagerOpen(true)}
            >
              {t('people.add')}
            </button>
          </div>
        ) : (
          <RecordPeopleHierarchy
            client={client}
            groups={groups}
            personButtons={personButtons}
            onOpen={openTask}
          />
        )}
      </div>
      <UndoNotice undo={undo} busy={busy} onUndo={restoreUndo} />
      <RecordOverlay
        id={sectionOptionsId}
        open={sectionOptionsOpen}
        kind="menu"
        labelledBy={sectionOptionsButtonId}
        anchorRef={sectionOptionsOpener}
        onClose={() => setSectionOptionsOpen(false)}
        className="record-menu record-people__section-menu"
      >
        <div className="record-menu__items">
          <button
            type="button"
            className="record-menu__item"
            role="menuitem"
            disabled={busy || snapshot.links.length === 0}
            onClick={() => {
              setSectionOptionsOpen(false)
              void mutateWithUndo(
                { kind: 'clearLinks' },
                t('record.people.cleared'),
              )
            }}
          >
            {t('record.people.clear')}
          </button>
          <button
            type="button"
            className="record-menu__item record-people__section-menu-danger"
            role="menuitem"
            disabled={busy}
            onClick={() => {
              setSectionOptionsOpen(false)
              void mutateWithUndo(
                { kind: 'removeSection', sectionId: 'people' },
                t('record.people.sectionRemoved'),
              )
            }}
          >
            {t('record.people.removeSection')}
          </button>
        </div>
      </RecordOverlay>
      <RecordOverlay
        open={editing !== null && !entryManagerOpen}
        kind="modal"
        modalPlacement="center"
        labelledBy={contextHeadingId}
        anchorRef={contextOpener}
        initialFocusRef={contextClose}
        onClose={() => setEditingPersonId(null)}
        className="record-person-task"
      >
        {editing ? (
          <PersonEntryTask
            client={client}
            headingId={contextHeadingId}
            closeRef={contextClose}
            linked={editing}
            allowsInteraction={allowsInteraction}
            selectableRoles={snapshot.availableRoles}
            contactDateBounds={recordContactBounds(target, contactDateBounds)}
            busy={busy}
            onClose={() => setEditingPersonId(null)}
            onToggleRole={(role) => updateRole(snapshotOfLinked(editing), role)}
            onViewPerson={
              onViewPerson
                ? (personId, action) =>
                    onViewPerson(personId, contextOpener.current ?? action)
                : undefined
            }
            onEditPerson={
              onEditPerson
                ? (personId, action) =>
                    onEditPerson(personId, contextOpener.current ?? action)
                : undefined
            }
            onRemove={async () => {
              if (await remove(editing)) setEditingPersonId(null)
            }}
          />
        ) : null}
      </RecordOverlay>
      <RecordOverlay
        open={entryManagerOpen}
        kind="modal"
        modalPlacement="center"
        labelledBy={entryManagerHeadingId}
        anchorRef={entryManagerOpener}
        initialFocusRef={entryManagerClose}
        onClose={() => setEntryManagerOpen(false)}
        className="record-entry-people-manager"
      >
        <EntryPeopleManager
          client={client}
          headingId={entryManagerHeadingId}
          closeRef={entryManagerClose}
          links={snapshot.links}
          selectableRoles={snapshot.availableRoles}
          busy={busy}
          onClose={() => setEntryManagerOpen(false)}
          onToggleRole={updateRole}
          onMove={(index, offset) => {
            const links = snapshotRef.current?.links.map(linkDraft) ?? []
            const destination = index + offset
            if (destination < 0 || destination >= links.length) return
            ;[links[index], links[destination]] = [
              links[destination]!,
              links[index]!,
            ]
            void mutateWithUndo(
              { kind: 'replaceLinks', links },
              t('record.people.reordered'),
            )
          }}
          onRemove={remove}
          onCreatedPerson={async (person, opener) => {
            const firstRole = snapshot.availableRoles[0]
            if (!firstRole) return false
            const attached = await updateRole(person, firstRole)
            if (!attached) return false
            onEditPerson?.(person.person.id, opener)
            setEntryManagerOpen(false)
            return true
          }}
        />
      </RecordOverlay>
    </section>
  )
}

function RecordPeopleHierarchy({
  client,
  groups,
  personButtons,
  onOpen,
}: {
  readonly client: LifeArchiveClient
  readonly groups: RecordPeopleGroups
  readonly personButtons: React.RefObject<Map<StableId, HTMLButtonElement>>
  readonly onOpen: (
    linked: LinkedPersonSnapshot,
    opener: HTMLButtonElement,
  ) => void
}) {
  const t = useLocalisation().t
  return (
    <div className="record-people__hierarchy">
      {groups.significant.length > 0 ? (
        <div
          className="record-people__prominent"
          role="list"
          aria-label={t('record.people.prominent')}
        >
          {groups.significant.map((linked) => {
            const role = displayRole(linked)
            return (
              <article
                key={linked.person.id}
                className="record-person-card"
                data-role={role}
                role="listitem"
              >
                <button
                  ref={(element) => {
                    if (element)
                      personButtons.current.set(linked.person.id, element)
                    else personButtons.current.delete(linked.person.id)
                  }}
                  type="button"
                  data-record-person-id={linked.person.id}
                  data-record-person-opener-key={`record-person-${linked.person.id}`}
                  aria-label={personTaskLabel(t, linked)}
                  onClick={(event) => onOpen(linked, event.currentTarget)}
                >
                  <PersonAvatar
                    client={client}
                    name={linked.person.displayName}
                    photo={linked.profilePhoto}
                    size="large"
                  />
                  <span className="record-person-card__copy">
                    <strong>{linked.person.displayName}</strong>
                    <span>{recordRoleLabel(t, role)}</span>
                  </span>
                </button>
              </article>
            )
          })}
        </div>
      ) : null}
      {groups.involved.length > 0 ? (
        <RecordPeopleRows
          client={client}
          heading={t('record.people.group.involved')}
          links={groups.involved}
          personButtons={personButtons}
          onOpen={onOpen}
        />
      ) : null}
      {groups.brief.length > 0 ? (
        <RecordPeopleRows
          client={client}
          heading={t('record.people.group.brief')}
          links={groups.brief}
          personButtons={personButtons}
          onOpen={onOpen}
        />
      ) : null}
      {groups.neutral.length > 0 ? (
        <RecordPeopleRows
          client={client}
          heading={t('record.people.group.also')}
          links={groups.neutral}
          personButtons={personButtons}
          onOpen={onOpen}
        />
      ) : null}
    </div>
  )
}

function RecordPeopleRows({
  client,
  heading,
  links,
  personButtons,
  onOpen,
}: {
  readonly client: LifeArchiveClient
  readonly heading: string
  readonly links: readonly LinkedPersonSnapshot[]
  readonly personButtons: React.RefObject<Map<StableId, HTMLButtonElement>>
  readonly onOpen: (
    linked: LinkedPersonSnapshot,
    opener: HTMLButtonElement,
  ) => void
}) {
  const t = useLocalisation().t
  const headingId = useId()
  return (
    <section className="record-people__row-group" aria-labelledby={headingId}>
      <h3 id={headingId}>{heading}</h3>
      <div role="list">
        {links.map((linked) => {
          const role = displayRole(linked)
          return (
            <article key={linked.person.id} role="listitem">
              <button
                ref={(element) => {
                  if (element)
                    personButtons.current.set(linked.person.id, element)
                  else personButtons.current.delete(linked.person.id)
                }}
                type="button"
                data-record-person-id={linked.person.id}
                data-record-person-opener-key={`record-person-${linked.person.id}`}
                aria-label={personTaskLabel(t, linked)}
                onClick={(event) => onOpen(linked, event.currentTarget)}
              >
                <PersonAvatar
                  client={client}
                  name={linked.person.displayName}
                  photo={linked.profilePhoto}
                  size="small"
                />
                <strong>{linked.person.displayName}</strong>
                <span>{recordRoleLabel(t, role)}</span>
                <RecordControlIcon name="next" />
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function PersonEntryTask({
  client,
  headingId,
  closeRef,
  linked,
  allowsInteraction,
  selectableRoles,
  contactDateBounds,
  busy,
  onClose,
  onToggleRole,
  onViewPerson,
  onEditPerson,
  onRemove,
}: {
  readonly client: LifeArchiveClient
  readonly headingId: string
  readonly closeRef: React.RefObject<HTMLButtonElement | null>
  readonly linked: LinkedPersonSnapshot
  readonly allowsInteraction: boolean
  readonly selectableRoles: readonly PersonRecordRole[]
  readonly contactDateBounds: {
    readonly minimum: CivilDate
    readonly maximum: CivilDate
  } | null
  readonly busy: boolean
  readonly onClose: () => void
  readonly onToggleRole: (role: RecordPersonRole) => Promise<boolean>
  readonly onViewPerson?: (
    personId: StableId,
    opener: HTMLButtonElement,
  ) => void
  readonly onEditPerson?: (
    personId: StableId,
    opener: HTMLButtonElement,
  ) => void
  readonly onRemove: () => Promise<void>
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const [contactDate, setContactDate] = useState('')
  const [contactKind, setContactKind] =
    useState<CurrentOrdinaryPersonRole>('brief')
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
    if (!contactDateValid) return
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
        roleId: contactKind,
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
      <header className="record-person-task__header">
        <button
          ref={closeRef}
          type="button"
          className="record-overlay__close"
          aria-label={t('people.close.editor')}
          onClick={onClose}
        >
          <RecordControlIcon name="close" />
        </button>
        <strong>
          {t('record.people.task.title', {
            name: linked.person.displayName,
          })}
        </strong>
        <span aria-hidden="true" />
      </header>
      <div className="record-person-task__body">
        <div className="record-person-task__identity task-hero">
          <PersonAvatar
            client={client}
            name={linked.person.displayName}
            photo={linked.profilePhoto}
            size="large"
          />
          <h2 id={headingId}>
            <span className="visually-hidden">
              {t('record.people.contextPrefix')}{' '}
            </span>
            {linked.person.displayName}
          </h2>
          {linked.person.connectionLabels[0] ? (
            <p>{linked.person.connectionLabels[0]}</p>
          ) : null}
        </div>
        <section className="record-person-task__section">
          <h3 className="eyebrow">{t('record.people.task.presence')}</h3>
          <div className="record-person-task__role-row">
            <RoleControls
              person={snapshotOfLinked(linked)}
              link={linkDraft(linked)}
              selectableRoles={selectableRoles}
              busy={busy}
              onToggle={onToggleRole}
            />
            <button
              type="button"
              className="record-person-role__remove"
              disabled={busy}
              aria-label={t('record.people.remove', {
                name: linked.person.displayName,
              })}
              onClick={() => void onRemove()}
            >
              <span className="material-symbols-rounded" aria-hidden="true">
                {MATERIAL_UI_GLYPHS.delete}
              </span>
            </button>
          </div>
        </section>
        {onViewPerson || onEditPerson ? (
          <div className="record-person-task__actions action-list">
            {onViewPerson ? (
              <button
                type="button"
                onClick={(event) =>
                  onViewPerson(linked.person.id, event.currentTarget)
                }
              >
                <span>{t('record.people.viewPerson')}</span>
                <RecordControlIcon name="next" />
              </button>
            ) : null}
            {onEditPerson ? (
              <button
                type="button"
                onClick={(event) =>
                  onEditPerson(linked.person.id, event.currentTarget)
                }
              >
                <span>{t('record.people.editPerson')}</span>
                <RecordControlIcon name="next" />
              </button>
            ) : null}
          </div>
        ) : null}
        {!allowsInteraction ? (
          <fieldset className="record-person-task__contact">
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
            <div className="person-field">
              <span>{t('record.people.contactDate')}</span>
              <RecordDatePicker
                label={t('record.people.contactDate')}
                value={contactDate}
                minimum={contactDateBounds?.minimum}
                maximum={contactDateBounds?.maximum}
                invalid={!contactDateValid && contactDate.length > 0}
                onChange={setContactDate}
              />
            </div>
            <div className="person-field">
              <span>{t('record.people.contactKind')}</span>
              <PeopleSelect
                value={contactKind}
                ariaLabel={t('record.people.contactKind')}
                options={[
                  { value: 'brief', label: t('record.people.role.brief') },
                  {
                    value: 'involved',
                    label: t('record.people.role.involved'),
                  },
                  {
                    value: 'activity',
                    label: t('record.people.role.activity'),
                  },
                  {
                    value: 'central',
                    label: t('record.people.role.central'),
                  },
                ]}
                onChange={(next) =>
                  setContactKind(next as CurrentOrdinaryPersonRole)
                }
              />
            </div>
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
    </>
  )
}

function EntryPeopleManager({
  client,
  headingId,
  closeRef,
  links,
  selectableRoles,
  busy,
  onClose,
  onToggleRole,
  onMove,
  onRemove,
  onCreatedPerson,
}: {
  readonly client: LifeArchiveClient
  readonly headingId: string
  readonly closeRef: React.RefObject<HTMLButtonElement | null>
  readonly links: readonly LinkedPersonSnapshot[]
  readonly selectableRoles: readonly PersonRecordRole[]
  readonly busy: boolean
  readonly onClose: () => void
  readonly onToggleRole: (
    person: PersonSnapshot,
    role: RecordPersonRole,
  ) => Promise<boolean>
  readonly onMove: (index: number, offset: -1 | 1) => void
  readonly onRemove: (linked: LinkedPersonSnapshot) => Promise<boolean>
  readonly onCreatedPerson: (
    person: PersonSnapshot,
    opener: HTMLButtonElement,
  ) => Promise<boolean>
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const people = usePeople(client)
  const createOpener = useRef<HTMLButtonElement>(null)
  const [query, setQuery] = useState('')
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const listPeople = people.list
  const listedQuery = people.state.listedQuery

  useEffect(() => {
    if (query === listedQuery) return
    const timer = globalThis.setTimeout(() => void listPeople(query), 250)
    return () => globalThis.clearTimeout(timer)
  }, [listPeople, listedQuery, query])

  const linkedIds = new Set(links.map(({ person }) => person.id))
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const assigned = normalizedQuery
    ? links.filter(({ person }) =>
        [person.displayName, ...person.connectionLabels].some((value) =>
          value.toLocaleLowerCase().includes(normalizedQuery),
        ),
      )
    : links
  const unassigned = people.state.people.filter(
    ({ person }) => !person.isArchived && !linkedIds.has(person.id),
  )

  return (
    <>
      <PeopleTaskHeader
        headingId={headingId}
        title={t('record.people.manager.title')}
        closeLabel={t('record.people.closeManager')}
        closeRef={closeRef}
        onClose={onClose}
      />
      <div className="record-entry-people-manager__body">
        <label className="record-entry-people-manager__search">
          <span className="visually-hidden">{t('people.search')}</span>
          <input
            type="search"
            value={query}
            placeholder={t('people.search.placeholder.directory')}
            onChange={(event) => {
              const value = event.currentTarget.value
              setQuery(value)
              people.setQuery(value)
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
        <ManagerGroup heading={t('record.people.assigned')}>
          {assigned.length === 0 ? (
            <p className="record-entry-people-manager__empty">
              {t('record.people.assigned.empty')}
            </p>
          ) : (
            assigned.map((linked, index) => (
              <ManagerPersonRow
                key={linked.person.id}
                client={client}
                person={snapshotOfLinked(linked)}
                link={linkDraft(linked)}
                selectableRoles={selectableRoles}
                busy={busy}
                selected
                canMoveUp={index > 0}
                canMoveDown={index < assigned.length - 1}
                onToggleRole={(role) =>
                  onToggleRole(snapshotOfLinked(linked), role)
                }
                onMove={(offset) => onMove(links.indexOf(linked), offset)}
                onRemove={() => onRemove(linked)}
              />
            ))
          )}
        </ManagerGroup>
        <ManagerGroup heading={t('record.people.unassigned')}>
          {unassigned.length === 0 && people.state.status !== 'loading' ? (
            <p className="record-entry-people-manager__empty">
              {t('record.people.unassigned.empty')}
            </p>
          ) : (
            unassigned.map((person) => (
              <ManagerPersonRow
                key={person.person.id}
                client={client}
                person={person}
                link={null}
                selectableRoles={selectableRoles}
                busy={busy}
                onToggleRole={(role) => onToggleRole(person, role)}
              />
            ))
          )}
        </ManagerGroup>
        {people.state.hasMore ? (
          <button
            type="button"
            className="button button--secondary"
            disabled={busy}
            onClick={() => void people.loadMore()}
          >
            {t('people.loadMore')}
          </button>
        ) : null}
      </div>
      <footer className="record-entry-people-manager__footer">
        <button
          ref={createOpener}
          type="button"
          className="record-entry-people-manager__create"
          disabled={busy}
          onClick={() => setQuickCreateOpen(true)}
        >
          <RecordControlIcon name="add" />
          <span>{t('people.new')}</span>
        </button>
      </footer>
      <PersonQuickCreateDialog
        people={people}
        open={quickCreateOpen}
        anchorRef={createOpener}
        externallyBusy={busy}
        onClose={() => setQuickCreateOpen(false)}
        onCreated={(person) => {
          const opener = createOpener.current
          return opener ? onCreatedPerson(person, opener) : false
        }}
      />
    </>
  )
}

function ManagerGroup({
  heading,
  children,
}: {
  readonly heading: string
  readonly children: React.ReactNode
}) {
  const headingId = useId()
  return (
    <section
      className="record-entry-people-manager__group"
      aria-labelledby={headingId}
    >
      <h3 id={headingId}>{heading}</h3>
      <div className="record-entry-people-manager__list">{children}</div>
    </section>
  )
}

function ManagerPersonRow({
  client,
  person,
  link,
  selectableRoles,
  busy,
  selected = false,
  canMoveUp = false,
  canMoveDown = false,
  onToggleRole,
  onMove,
  onRemove,
}: {
  readonly client: LifeArchiveClient
  readonly person: PersonSnapshot
  readonly link: PersonLinkDraft | null
  readonly selectableRoles: readonly PersonRecordRole[]
  readonly busy: boolean
  readonly selected?: boolean
  readonly canMoveUp?: boolean
  readonly canMoveDown?: boolean
  readonly onToggleRole: (role: RecordPersonRole) => Promise<boolean>
  readonly onMove?: (offset: -1 | 1) => void
  readonly onRemove?: () => Promise<boolean>
}) {
  const t = useLocalisation().t
  return (
    <article
      className="record-entry-person-row"
      data-selected={selected || undefined}
    >
      <div className="record-entry-person-row__head">
        <PersonAvatar
          client={client}
          name={person.person.displayName}
          photo={person.profilePhoto}
          size="small"
        />
        <span className="record-entry-person-row__identity-copy">
          <strong>{person.person.displayName}</strong>
          {selected && link ? (
            <small>
              {t('record.people.assigned.meta', {
                role: recordRoleLabel(t, displayRoleFromDraft(link)),
              })}
            </small>
          ) : person.person.connectionLabels[0] ? (
            <small>{person.person.connectionLabels[0]}</small>
          ) : null}
        </span>
        {selected && onMove ? (
          <div className="record-entry-person-row__order">
            <button
              type="button"
              disabled={busy || !canMoveUp}
              aria-label={t('record.people.moveUp', {
                name: person.person.displayName,
              })}
              onClick={() => onMove(-1)}
            >
              <RecordControlIcon name="up" />
            </button>
            <button
              type="button"
              disabled={busy || !canMoveDown}
              aria-label={t('record.people.moveDown', {
                name: person.person.displayName,
              })}
              onClick={() => onMove(1)}
            >
              <RecordControlIcon name="down" />
            </button>
          </div>
        ) : null}
      </div>
      <div className="record-entry-person-row__controls">
        <RoleControls
          person={person}
          link={link}
          selectableRoles={selectableRoles}
          busy={busy}
          onToggle={onToggleRole}
          compact
        />
        {selected && onRemove ? (
          <button
            type="button"
            className="record-person-role__remove"
            disabled={busy}
            aria-label={t('record.people.remove', {
              name: person.person.displayName,
            })}
            onClick={() => void onRemove()}
          >
            <span className="record-person-role__bin" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </article>
  )
}

function displayRoleFromDraft(link: PersonLinkDraft): RecordPersonRole {
  return link.roleId
}

function RoleControls({
  person,
  link,
  selectableRoles,
  busy,
  compact = false,
  onToggle,
}: {
  readonly person: PersonSnapshot
  readonly link: PersonLinkDraft | null
  readonly selectableRoles: readonly PersonRecordRole[]
  readonly busy: boolean
  readonly compact?: boolean
  readonly onToggle: (role: RecordPersonRole) => Promise<boolean>
}) {
  const t = useLocalisation().t
  const descriptionId = useId()
  const periodRoles = selectableRoles.includes('inPeriod')
  return (
    <div
      className="record-person-roles"
      style={{
        gridTemplateColumns: `repeat(${selectableRoles.length}, minmax(0, 1fr))`,
      }}
      data-compact={compact || undefined}
      role="group"
      aria-label={t('record.people.rolesFor', {
        name: person.person.displayName,
      })}
      aria-describedby={descriptionId}
    >
      <span id={descriptionId} className="visually-hidden">
        {t('record.people.roles.detail')}
      </span>
      {selectableRoles.map((role) => (
        <span
          key={`${role}-description`}
          id={`${descriptionId}-${role}`}
          className="visually-hidden"
        >
          {recordRoleDescription(t, role, periodRoles)}
        </span>
      ))}
      {selectableRoles.map((role) => {
        return (
          <button
            key={role}
            type="button"
            aria-pressed={recordPersonRoleSelected(link, role)}
            aria-describedby={`${descriptionId}-${role}`}
            disabled={busy}
            onClick={() => void onToggle(role)}
          >
            {recordRoleLabel(t, role)}
          </button>
        )
      })}
    </div>
  )
}

function MutationFailure({
  failure,
  mutation,
  busy,
  onRetry,
}: {
  readonly failure: Parameters<typeof failureMessage>[1]
  readonly mutation: RecordPeopleMutation | null
  readonly busy: boolean
  readonly onRetry: (mutation: RecordPeopleMutation) => Promise<boolean>
}) {
  const localisation = useLocalisation()
  return (
    <div role="alert" className="record-details__failure">
      <p>{failureMessage(localisation, failure)}</p>
      {mutation ? (
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => void onRetry(mutation)}
        >
          {localisation.t('people.retry')}
        </button>
      ) : null}
    </div>
  )
}

function MutationConflict({
  mutation,
  onRetry,
}: {
  readonly mutation: RecordPeopleMutation
  readonly onRetry: (mutation: RecordPeopleMutation) => Promise<boolean>
}) {
  const t = useLocalisation().t
  return (
    <div role="alert" className="record-editor__conflict">
      <p>{t('record.people.conflict')}</p>
      <button
        type="button"
        className="button"
        onClick={() => void onRetry(mutation)}
      >
        {t('people.retry')}
      </button>
    </div>
  )
}

function UndoNotice({
  undo,
  busy,
  onUndo,
}: {
  readonly undo: UndoState | null
  readonly busy: boolean
  readonly onUndo: () => Promise<void>
}) {
  const t = useLocalisation().t
  if (!undo) return null
  return (
    <div className="record-people__undo" role="status" aria-live="polite">
      <span>{undo.message}</span>
      <button type="button" disabled={busy} onClick={() => void onUndo()}>
        {t('record.people.undo')}
      </button>
    </div>
  )
}

function personTaskLabel(
  t: ReturnType<typeof useLocalisation>['t'],
  linked: LinkedPersonSnapshot,
) {
  return t('record.people.tileLabel', {
    name: linked.person.displayName,
    role: recordRoleLabel(t, linked.link.roleId),
  })
}

function recordRoleLabel(
  t: ReturnType<typeof useLocalisation>['t'],
  role: PersonRecordRole,
): string {
  switch (role) {
    case 'brief':
      return t('record.people.role.brief')
    case 'involved':
      return t('record.people.role.involved')
    case 'activity':
      return t('record.people.role.activity')
    case 'central':
      return t('record.people.role.central')
    case 'inPeriod':
      return t('record.people.role.inPeriod')
    case 'legacyIncluded':
      return t('record.people.role.legacyIncluded')
    case 'legacyTogether':
      return t('record.people.role.legacyTogether')
    case 'legacyAbout':
      return t('record.people.role.legacyAbout')
  }
}

function recordRoleDescription(
  t: ReturnType<typeof useLocalisation>['t'],
  role: PersonRecordRole,
  period: boolean,
): string {
  switch (role) {
    case 'brief':
      return t('record.people.roleDescription.brief')
    case 'involved':
      return period
        ? t('record.people.roleDescription.periodInvolved')
        : t('record.people.roleDescription.involved')
    case 'activity':
      return t('record.people.roleDescription.activity')
    case 'central':
      return period
        ? t('record.people.roleDescription.periodCentral')
        : t('record.people.roleDescription.central')
    case 'inPeriod':
      return t('record.people.roleDescription.inPeriod')
    case 'legacyIncluded':
    case 'legacyTogether':
    case 'legacyAbout':
      return recordRoleLabel(t, role)
  }
}

function linkDraft(linked: LinkedPersonSnapshot): PersonLinkDraft {
  return {
    personId: linked.person.id,
    roleId: linked.link.roleId,
  }
}

function snapshotOfLinked(linked: LinkedPersonSnapshot): PersonSnapshot {
  return {
    person: linked.person,
    revision: linked.personRevision,
    profilePhoto: linked.profilePhoto,
    lastRecordedContactDate: null,
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
