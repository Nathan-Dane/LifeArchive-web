import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ClientFailure,
  InvalidationToken,
  LifeArchiveClient,
  PersonContactHistoryPage,
  PersonContactHistoryRange,
  PersonContactSummary,
  PersonInteractionLevel,
  PersonListCursor,
  PersonMemorySummary,
  PersonProfile,
  PersonSnapshot,
} from '../../core/client'
import { deviceCalendar } from '../../platform/calendar'

export type PersonDraft = PersonProfile

type MergeChoices = Pick<
  Parameters<LifeArchiveClient['people']['merge']>[0],
  'displayNameSource' | 'aboutSource' | 'photoSource'
>

type PendingPeopleMutation =
  | { readonly kind: 'create' }
  | { readonly kind: 'archive'; readonly archived: boolean }
  | { readonly kind: 'importPhoto'; readonly file: File }
  | { readonly kind: 'removePhoto' }
  | { readonly kind: 'delete' }
  | {
      readonly kind: 'merge'
      readonly duplicatePersonId: string
      readonly choices: MergeChoices
    }

interface PeopleState {
  readonly status: 'loading' | 'ready' | 'failed' | 'saving'
  readonly listStatus:
    'loading' | 'ready' | 'failed' | 'loadingMore' | 'appendFailed'
  readonly profileStatus: 'idle' | 'loading' | 'ready' | 'failed'
  readonly quickCreateStatus: 'idle' | 'saving' | 'failed'
  readonly people: readonly PersonSnapshot[]
  readonly hasMore: boolean
  readonly nextCursor: PersonListCursor | null
  readonly query: string
  readonly listedQuery: string | null
  readonly selected: PersonSnapshot | null
  readonly draft: PersonDraft | null
  readonly creating: boolean
  readonly failure: ClientFailure | null
  readonly listFailure: ClientFailure | null
  readonly profileFailure: ClientFailure | null
  readonly quickCreateFailure: ClientFailure | null
  readonly directoryMutationPersonId: PersonSnapshot['person']['id'] | null
  readonly directoryMutationFailure: ClientFailure | null
  readonly directoryMutationConflict: boolean
  readonly conflict: PersonSnapshot | null
  readonly invalidation: InvalidationToken | null
  readonly memories: readonly PersonMemorySummary[]
  readonly memoriesHasMore: boolean
  readonly contactSummary: PersonContactSummary | null
  readonly contactHistory: PersonContactHistoryPage | null
  readonly contactRange: PersonContactHistoryRange
  readonly contactLogStatus:
    'idle' | 'saving' | 'failed' | 'conflict' | 'succeeded'
  readonly contactLogFailure: ClientFailure | null
  readonly mergeConflict: boolean
  readonly pendingMutation: PendingPeopleMutation | null
}

const EMPTY_PROFILE: PersonDraft = {
  displayName: '',
  connectionLabels: [],
  about: null,
  otherNames: [],
  pronouns: null,
  pronunciation: null,
  lifeStatus: 'notSpecified',
  birthDate: null,
  deathDate: null,
  references: [],
}

export function personDraft(snapshot: PersonSnapshot): PersonDraft {
  const person = snapshot.person
  return {
    displayName: person.displayName,
    connectionLabels: [...person.connectionLabels],
    about: person.about,
    otherNames: person.otherNames.map((name) => ({ ...name })),
    pronouns: person.pronouns,
    pronunciation: person.pronunciation,
    lifeStatus: person.lifeStatus,
    birthDate: person.birthDate ? { ...person.birthDate } : null,
    deathDate: person.deathDate ? { ...person.deathDate } : null,
    references: person.references.map((reference) => ({ ...reference })),
  }
}

export function usePeople(client: LifeArchiveClient) {
  const listGeneration = useRef(0)
  const profileGeneration = useRef(0)
  const contactGeneration = useRef(0)
  const contactLogGeneration = useRef(0)
  const [state, setState] = useState<PeopleState>({
    status: 'loading',
    listStatus: 'loading',
    profileStatus: 'idle',
    quickCreateStatus: 'idle',
    people: [],
    hasMore: false,
    nextCursor: null,
    query: '',
    listedQuery: null,
    selected: null,
    draft: null,
    creating: false,
    failure: null,
    listFailure: null,
    profileFailure: null,
    quickCreateFailure: null,
    directoryMutationPersonId: null,
    directoryMutationFailure: null,
    directoryMutationConflict: false,
    conflict: null,
    invalidation: null,
    memories: [],
    memoriesHasMore: false,
    contactSummary: null,
    contactHistory: null,
    contactRange: 'thirtyDays',
    contactLogStatus: 'idle',
    contactLogFailure: null,
    mergeConflict: false,
    pendingMutation: null,
  })
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const list = useCallback(
    async (query = '', append = false) => {
      const requestGeneration = ++listGeneration.current
      setState((current) => ({
        ...current,
        status: append
          ? current.status
          : current.selected
            ? current.status
            : 'loading',
        listStatus: append ? 'loadingMore' : 'loading',
        query,
        listFailure: null,
      }))
      const current = stateRef.current
      const after = append ? current.nextCursor : null
      if (append && !after) {
        setState((value) => ({
          ...value,
          listStatus: 'ready',
          status:
            value.selected || value.profileStatus === 'loading'
              ? value.status
              : 'ready',
        }))
        return false
      }
      const result = await client.people.list({
        query: query.length > 0 ? query : null,
        includeArchived: true,
        limit: 25,
        after,
      })
      if (listGeneration.current !== requestGeneration) return false
      if (result.status === 'failed') {
        setState((value) => ({
          ...value,
          status:
            append || value.selected || value.profileStatus === 'loading'
              ? value.status
              : 'failed',
          listStatus: append ? 'appendFailed' : 'failed',
          listFailure: result.failure,
        }))
        return false
      }
      setState((value) => ({
        ...value,
        status:
          value.selected || value.profileStatus === 'loading'
            ? value.status
            : 'ready',
        listStatus: 'ready',
        listFailure: null,
        people: append
          ? mergePeople(value.people, result.value.people)
          : result.value.people,
        hasMore: result.value.hasMore,
        nextCursor: result.value.nextCursor,
        listedQuery: query,
        invalidation: result.value.invalidation,
      }))
      return true
    },
    [client],
  )

  useEffect(() => {
    let active = true
    globalThis.queueMicrotask(() => {
      if (active) void list('')
    })
    return () => {
      active = false
      listGeneration.current += 1
    }
    // The first request belongs to this mounted archive generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  const selectById = useCallback(
    async (personId: PersonSnapshot['person']['id']) => {
      const requestGeneration = ++profileGeneration.current
      contactLogGeneration.current += 1
      setState((current) => ({
        ...current,
        status: 'loading',
        profileStatus: 'loading',
        selected: null,
        draft: null,
        creating: false,
        failure: null,
        profileFailure: null,
        conflict: null,
        memories: [],
        contactSummary: null,
        contactHistory: null,
        contactLogStatus: 'idle',
        contactLogFailure: null,
        mergeConflict: false,
        pendingMutation: null,
      }))
      const loaded = await client.people.load(personId)
      if (profileGeneration.current !== requestGeneration) return false
      if (loaded.status === 'failed') {
        setState((current) => ({
          ...current,
          status: 'failed',
          profileStatus: 'failed',
          failure: loaded.failure,
          profileFailure: loaded.failure,
        }))
        return false
      }
      const currentSnapshot = loaded.value.current
      setState((current) => ({
        ...current,
        status: 'ready',
        profileStatus: 'ready',
        selected: currentSnapshot,
        draft: personDraft(currentSnapshot),
        people: replacePerson(current.people, currentSnapshot),
        invalidation: loaded.value.invalidation,
      }))
      const [memories, contact] = await Promise.all([
        client.people.memories({
          personId: currentSnapshot.person.id,
          limit: 10,
          before: null,
        }),
        client.people.contactSummary({
          personId: currentSnapshot.person.id,
          asOfDate: civilToday(),
        }),
      ])
      if (profileGeneration.current !== requestGeneration) return false
      setState((current) => {
        if (current.selected?.person.id !== currentSnapshot.person.id)
          return current
        return {
          ...current,
          memories: memories.status === 'ok' ? memories.value.memories : [],
          memoriesHasMore: memories.status === 'ok' && memories.value.hasMore,
          contactSummary:
            contact.status === 'ok' ? contact.value.summary : null,
          failure:
            memories.status === 'failed'
              ? memories.failure
              : contact.status === 'failed'
                ? contact.failure
                : current.failure,
          invalidation:
            contact.status === 'ok'
              ? contact.value.invalidation
              : memories.status === 'ok'
                ? memories.value.invalidation
                : current.invalidation,
        }
      })
      return true
    },
    [client],
  )

  const select = useCallback(
    (snapshot: PersonSnapshot) => selectById(snapshot.person.id),
    [selectById],
  )

  const startCreate = useCallback(() => {
    profileGeneration.current += 1
    contactGeneration.current += 1
    contactLogGeneration.current += 1
    setState((current) => ({
      ...current,
      selected: null,
      profileStatus: 'ready',
      draft: { ...EMPTY_PROFILE },
      creating: true,
      failure: null,
      profileFailure: null,
      conflict: null,
      memories: [],
      contactSummary: null,
      contactHistory: null,
      contactLogStatus: 'idle',
      contactLogFailure: null,
      mergeConflict: false,
      pendingMutation: null,
    }))
  }, [])

  const closeEditor = useCallback(() => {
    profileGeneration.current += 1
    contactGeneration.current += 1
    contactLogGeneration.current += 1
    setState((current) => ({
      ...current,
      selected: null,
      profileStatus: 'idle',
      draft: null,
      creating: false,
      failure: null,
      profileFailure: null,
      conflict: null,
      memories: [],
      contactSummary: null,
      contactHistory: null,
      contactLogStatus: 'idle',
      contactLogFailure: null,
      mergeConflict: false,
      pendingMutation: null,
    }))
  }, [])

  const update = useCallback((patch: Partial<PersonDraft>) => {
    setState((current) => ({
      ...current,
      draft: current.draft ? { ...current.draft, ...patch } : null,
      failure: null,
    }))
  }, [])

  const setQuery = useCallback((query: string) => {
    setState((current) => ({ ...current, query }))
  }, [])

  const replaceSnapshot = useCallback(
    (snapshot: PersonSnapshot, invalidation?: InvalidationToken) => {
      setState((current) => ({
        ...current,
        status: 'ready',
        selected: snapshot,
        people: replacePerson(current.people, snapshot),
        invalidation: invalidation ?? current.invalidation,
        pendingMutation: null,
        mergeConflict: false,
      }))
    },
    [],
  )

  const create = useCallback(async () => {
    const current = stateRef.current
    if (!current.creating || !current.draft) return null
    setState((value) => ({
      ...value,
      status: 'saving',
      profileStatus: 'ready',
      failure: null,
      pendingMutation: { kind: 'create' },
    }))
    const result = await client.people.create({
      newPersonId: client.operations.newStableId(),
      profile: current.draft,
      nowMs: Date.now(),
    })
    if (result.status === 'failed') {
      setState((value) => ({
        ...value,
        status: 'failed',
        failure: result.failure,
      }))
      return null
    }
    if (result.value.outcome === 'conflict') {
      setState((value) => ({ ...value, status: 'ready' }))
      return null
    }
    const success = result.value
    const snapshot = success.current
    setState((value) => ({
      ...value,
      status: 'ready',
      profileStatus: 'ready',
      people: replacePerson(value.people, snapshot),
      selected: snapshot,
      draft: personDraft(snapshot),
      creating: false,
      invalidation: success.invalidation,
      pendingMutation: null,
    }))
    return { snapshot, invalidation: success.invalidation }
  }, [client])

  const quickCreate = useCallback(
    async (displayName: string, connectionLabel: string | null) => {
      const trimmedName = displayName.trim()
      if (!trimmedName) return null
      setState((value) => ({
        ...value,
        quickCreateStatus: 'saving',
        quickCreateFailure: null,
      }))
      const result = await client.people.create({
        newPersonId: client.operations.newStableId(),
        profile: {
          ...EMPTY_PROFILE,
          displayName: trimmedName,
          connectionLabels: connectionLabel ? [connectionLabel] : [],
        },
        nowMs: Date.now(),
      })
      if (result.status === 'failed') {
        setState((value) => ({
          ...value,
          quickCreateStatus: 'failed',
          quickCreateFailure: result.failure,
        }))
        return null
      }
      if (result.value.outcome === 'conflict') {
        setState((value) => ({ ...value, quickCreateStatus: 'idle' }))
        return null
      }
      const success = result.value
      const snapshot = success.current
      setState((value) => ({
        ...value,
        people: replacePerson(value.people, snapshot),
        selected: snapshot,
        draft: personDraft(snapshot),
        creating: false,
        profileStatus: 'ready',
        quickCreateStatus: 'idle',
        quickCreateFailure: null,
        invalidation: success.invalidation,
      }))
      return snapshot
    },
    [client],
  )

  const resetQuickCreate = useCallback(() => {
    setState((current) => ({
      ...current,
      quickCreateStatus: 'idle',
      quickCreateFailure: null,
    }))
  }, [])

  const saveSnapshot = useCallback(
    async (selected: PersonSnapshot, submitted: PersonDraft) => {
      setState((current) => ({
        ...current,
        status: 'saving',
        failure: null,
        pendingMutation: null,
      }))
      const result = await client.people.save({
        id: selected.person.id,
        expectedRevision: selected.revision,
        profile: submitted,
        isArchived: selected.person.isArchived,
        nowMs: Date.now(),
      })
      if (result.status === 'failed') {
        setState((current) => ({
          ...current,
          status: 'failed',
          failure: result.failure,
        }))
        return false
      }
      if (result.value.outcome === 'conflict') {
        const conflict = result.value.conflict.current
        setState((current) => ({
          ...current,
          status: 'ready',
          draft: submitted,
          conflict,
        }))
        return false
      }
      const success = result.value
      setState((current) => ({
        ...current,
        status: 'ready',
        selected: success.current,
        draft: personDraft(success.current),
        people: replacePerson(current.people, success.current),
        conflict: null,
        invalidation: success.invalidation,
        pendingMutation: null,
      }))
      return true
    },
    [client],
  )

  const save = useCallback(async () => {
    if (!state.selected || !state.draft) return false
    return saveSnapshot(state.selected, state.draft)
  }, [saveSnapshot, state.draft, state.selected])

  const saveMine = useCallback(async () => {
    if (!state.conflict || !state.draft) return false
    return saveSnapshot(state.conflict, state.draft)
  }, [saveSnapshot, state.conflict, state.draft])

  const useArchiveVersion = useCallback(() => {
    setState((current) =>
      current.conflict
        ? {
            ...current,
            selected: current.conflict,
            draft: personDraft(current.conflict),
            conflict: null,
          }
        : current,
    )
  }, [])

  const setArchived = useCallback(
    async (archived: boolean) => {
      const current = stateRef.current
      if (!current.selected || !current.draft) return false
      const pending = { kind: 'archive', archived } as const
      setState((value) => ({
        ...value,
        status: 'saving',
        failure: null,
        pendingMutation: pending,
      }))
      const result = await client.people.save({
        id: current.selected.person.id,
        expectedRevision: current.selected.revision,
        profile: current.draft,
        isArchived: archived,
        nowMs: Date.now(),
      })
      if (result.status === 'failed' || result.value.outcome === 'conflict') {
        setState((value) => ({
          ...value,
          status: result.status === 'failed' ? 'failed' : 'ready',
          failure: result.status === 'failed' ? result.failure : value.failure,
          ...(result.status === 'ok' && result.value.outcome === 'conflict'
            ? latestMutationSnapshot(value, result.value.conflict.current)
            : {}),
        }))
        return false
      }
      replaceSnapshot(result.value.current, result.value.invalidation)
      return true
    },
    [client, replaceSnapshot],
  )

  const setArchivedFromDirectory = useCallback(
    async (snapshot: PersonSnapshot, archived: boolean) => {
      setState((value) => ({
        ...value,
        directoryMutationPersonId: snapshot.person.id,
        directoryMutationFailure: null,
        directoryMutationConflict: false,
      }))
      const result = await client.people.save({
        id: snapshot.person.id,
        expectedRevision: snapshot.revision,
        profile: personDraft(snapshot),
        isArchived: archived,
        nowMs: Date.now(),
      })
      if (result.status === 'failed') {
        setState((value) => ({
          ...value,
          directoryMutationPersonId: null,
          directoryMutationFailure: result.failure,
        }))
        return false
      }
      if (result.value.outcome === 'conflict') {
        const conflict = result.value
        setState((value) => ({
          ...value,
          people: replacePerson(value.people, conflict.conflict.current),
          directoryMutationPersonId: null,
          directoryMutationConflict: true,
        }))
        return false
      }
      const success = result.value
      setState((value) => ({
        ...value,
        people: replacePerson(value.people, success.current),
        invalidation: success.invalidation,
        directoryMutationPersonId: null,
        directoryMutationFailure: null,
        directoryMutationConflict: false,
      }))
      return true
    },
    [client],
  )

  const importPhoto = useCallback(
    async (file: File) => {
      const current = stateRef.current
      if (!current.selected) return false
      const pending = { kind: 'importPhoto', file } as const
      setState((value) => ({
        ...value,
        status: 'saving',
        failure: null,
        pendingMutation: pending,
      }))
      const result = await client.people.importPhoto({
        personId: current.selected.person.id,
        expectedRevision: current.selected.revision,
        newPhotoId: client.operations.newStableId(),
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        bytes: await file.arrayBuffer(),
        createdAtMs: Date.now(),
        capturedAtMs: null,
        width: null,
        height: null,
      })
      if (result.status === 'failed' || result.value.outcome === 'conflict') {
        setState((value) => ({
          ...value,
          status: result.status === 'failed' ? 'failed' : 'ready',
          failure: result.status === 'failed' ? result.failure : value.failure,
          ...(result.status === 'ok' && result.value.outcome === 'conflict'
            ? latestMutationSnapshot(value, result.value.conflict.current)
            : {}),
        }))
        return false
      }
      replaceSnapshot(result.value.current, result.value.invalidation)
      return true
    },
    [client, replaceSnapshot],
  )

  const removePhoto = useCallback(async () => {
    const current = stateRef.current
    if (!current.selected) return false
    setState((value) => ({
      ...value,
      status: 'saving',
      failure: null,
      pendingMutation: { kind: 'removePhoto' },
    }))
    const result = await client.people.removePhoto({
      personId: current.selected.person.id,
      expectedRevision: current.selected.revision,
      nowMs: Date.now(),
    })
    if (result.status === 'failed' || result.value.outcome === 'conflict') {
      setState((value) => ({
        ...value,
        status: result.status === 'failed' ? 'failed' : 'ready',
        failure: result.status === 'failed' ? result.failure : value.failure,
        ...(result.status === 'ok' && result.value.outcome === 'conflict'
          ? latestMutationSnapshot(value, result.value.conflict.current)
          : {}),
      }))
      return false
    }
    replaceSnapshot(result.value.current, result.value.invalidation)
    return true
  }, [client, replaceSnapshot])

  const deletePerson = useCallback(async () => {
    const current = stateRef.current
    if (!current.selected) return false
    setState((value) => ({
      ...value,
      status: 'saving',
      failure: null,
      pendingMutation: { kind: 'delete' },
    }))
    const result = await client.people.delete({
      personId: current.selected.person.id,
      expectedRevision: current.selected.revision,
      nowMs: Date.now(),
    })
    if (result.status === 'failed' || result.value.outcome === 'conflict') {
      setState((value) => ({
        ...value,
        status: result.status === 'failed' ? 'failed' : 'ready',
        failure: result.status === 'failed' ? result.failure : value.failure,
        ...(result.status === 'ok' && result.value.outcome === 'conflict'
          ? latestMutationSnapshot(value, result.value.conflict.current)
          : {}),
      }))
      return false
    }
    const success = result.value
    setState((value) => ({
      ...value,
      status: 'ready',
      people: value.people.filter(
        ({ person }) => person.id !== current.selected?.person.id,
      ),
      selected: null,
      draft: null,
      pendingMutation: null,
      invalidation: success.invalidation,
    }))
    return true
  }, [client])

  const merge = useCallback(
    async (duplicate: PersonSnapshot, choices: MergeChoices) => {
      const current = stateRef.current
      if (
        !current.selected ||
        current.selected.person.isArchived ||
        duplicate.person.isArchived
      )
        return false
      const pending = {
        kind: 'merge',
        duplicatePersonId: duplicate.person.id,
        choices,
      } as const
      setState((value) => ({
        ...value,
        status: 'saving',
        failure: null,
        mergeConflict: false,
        pendingMutation: pending,
      }))
      const result = await client.people.merge({
        retainedPersonId: current.selected.person.id,
        duplicatePersonId: duplicate.person.id,
        expectedRetainedRevision: current.selected.revision,
        expectedDuplicateRevision: duplicate.revision,
        ...choices,
        nowMs: Date.now(),
      })
      if (result.status === 'failed' || result.value.outcome === 'conflict') {
        setState((value) => ({
          ...value,
          status: result.status === 'failed' ? 'failed' : 'ready',
          failure: result.status === 'failed' ? result.failure : value.failure,
          mergeConflict:
            result.status === 'ok' && result.value.outcome === 'conflict',
          ...(result.status === 'ok' && result.value.outcome === 'conflict'
            ? latestMutationSnapshot(value, result.value.conflict.current)
            : {}),
        }))
        return false
      }
      const success = result.value
      setState((current) => ({
        ...current,
        status: 'ready',
        mergeConflict: false,
        selected: success.current,
        draft: personDraft(success.current),
        people: replacePerson(
          current.people.filter(
            ({ person }) => person.id !== duplicate.person.id,
          ),
          success.current,
        ),
        invalidation: success.invalidation,
        pendingMutation: null,
      }))
      return true
    },
    [client],
  )

  const loadContactHistory = useCallback(
    async (range: PersonContactHistoryRange, append = false) => {
      const current = stateRef.current
      if (!current.selected) return false
      const requestGeneration = ++contactGeneration.current
      const personId = current.selected.person.id
      const beforeDate = append
        ? (current.contactHistory?.days.at(-1)?.date ?? null)
        : null
      setState((value) => ({
        ...value,
        contactRange: range,
        failure: null,
      }))
      const result = await client.people.contactHistory({
        personId,
        asOfDate: civilToday(),
        range,
        limit: 30,
        beforeDate,
      })
      if (
        contactGeneration.current !== requestGeneration ||
        stateRef.current.selected?.person.id !== personId
      )
        return false
      if (result.status === 'failed') {
        setState((value) => ({ ...value, failure: result.failure }))
        return false
      }
      setState((value) => ({
        ...value,
        contactRange: range,
        contactHistory:
          append && value.contactHistory && value.contactRange === range
            ? {
                ...result.value,
                days: mergeContactDays(
                  value.contactHistory.days,
                  result.value.days,
                ),
              }
            : result.value,
        invalidation: result.value.invalidation,
      }))
      return true
    },
    [client],
  )

  const logContact = useCallback(
    async (
      date: ReturnType<typeof civilToday>,
      interactionLevel: Exclude<PersonInteractionLevel, 'none'>,
    ) => {
      const current = stateRef.current
      if (!current.selected) return false
      const personId = current.selected.person.id
      const requestGeneration = ++contactLogGeneration.current
      setState((value) => ({
        ...value,
        contactLogStatus: 'saving',
        contactLogFailure: null,
      }))
      const calendar = deviceCalendar()
      const day = await client.time.window({
        scale: 'day',
        containing: date,
        timeZoneId: calendar.timeZoneId,
        weekRules: calendar.weekRules,
      })
      if (contactLogGeneration.current !== requestGeneration) return false
      if (day.status === 'failed') {
        setState((value) => ({
          ...value,
          contactLogStatus: 'failed',
          contactLogFailure: day.failure,
        }))
        return false
      }
      const result = await client.people.logContact({
        personId,
        interactionLevel,
        day: day.value,
        newEntryId: client.operations.newStableId(),
        nowMs: Date.now(),
      })
      if (
        contactLogGeneration.current !== requestGeneration ||
        stateRef.current.selected?.person.id !== personId
      )
        return false
      if (result.status === 'failed') {
        setState((value) => ({
          ...value,
          contactLogStatus: 'failed',
          contactLogFailure: result.failure,
        }))
        return false
      }
      if (result.value.outcome === 'conflict') {
        setState((value) => ({
          ...value,
          contactLogStatus: 'conflict',
          contactLogFailure: null,
        }))
        return false
      }
      const success = result.value
      const [summary, history] = await Promise.all([
        client.people.contactSummary({
          personId,
          asOfDate: civilToday(),
        }),
        current.contactHistory
          ? client.people.contactHistory({
              personId,
              asOfDate: civilToday(),
              range: current.contactRange,
              limit: 30,
              beforeDate: null,
            })
          : null,
      ])
      if (
        contactLogGeneration.current !== requestGeneration ||
        stateRef.current.selected?.person.id !== personId
      )
        return false
      setState((value) => ({
        ...value,
        contactLogStatus: 'succeeded',
        contactLogFailure: null,
        contactSummary:
          summary.status === 'ok'
            ? summary.value.summary
            : value.contactSummary,
        contactHistory:
          history?.status === 'ok' ? history.value : value.contactHistory,
        invalidation:
          history?.status === 'ok'
            ? history.value.invalidation
            : summary.status === 'ok'
              ? summary.value.invalidation
              : success.invalidation,
      }))
      return true
    },
    [client],
  )

  const resetContactLog = useCallback(() => {
    contactLogGeneration.current += 1
    setState((current) => ({
      ...current,
      contactLogStatus: 'idle',
      contactLogFailure: null,
    }))
  }, [])

  const loadMoreMemories = useCallback(async () => {
    const current = stateRef.current
    if (!current.selected || current.memories.length === 0) return
    const personId = current.selected.person.id
    const result = await client.people.memories({
      personId,
      limit: 10,
      before: current.memories.at(-1) ?? null,
    })
    if (result.status === 'failed') {
      setState((value) => ({ ...value, failure: result.failure }))
      return
    }
    setState((value) =>
      value.selected?.person.id === personId
        ? {
            ...value,
            memories: [...value.memories, ...result.value.memories],
            memoriesHasMore: result.value.hasMore,
            invalidation: result.value.invalidation,
          }
        : value,
    )
  }, [client])

  const retryMutation = useCallback(async () => {
    const pending = stateRef.current.pendingMutation
    if (!pending) return false
    switch (pending.kind) {
      case 'create':
        return (await create()) !== null
      case 'archive':
        return setArchived(pending.archived)
      case 'importPhoto':
        return importPhoto(pending.file)
      case 'removePhoto':
        return removePhoto()
      case 'delete':
        return deletePerson()
      case 'merge': {
        const duplicate = stateRef.current.people.find(
          ({ person }) => person.id === pending.duplicatePersonId,
        )
        return duplicate ? merge(duplicate, pending.choices) : false
      }
    }
  }, [create, deletePerson, importPhoto, merge, removePhoto, setArchived])

  const dismissMutationConflict = useCallback(() => {
    setState((current) => ({
      ...current,
      failure: null,
      mergeConflict: false,
      pendingMutation: null,
    }))
  }, [])

  return {
    state,
    list,
    loadMore: () => list(state.query, true),
    select,
    selectById,
    startCreate,
    closeEditor,
    update,
    setQuery,
    create,
    quickCreate,
    resetQuickCreate,
    save,
    saveMine,
    useArchiveVersion,
    setArchived,
    setArchivedFromDirectory,
    importPhoto,
    removePhoto,
    deletePerson,
    merge,
    retryMutation,
    dismissMutationConflict,
    loadMoreMemories,
    loadContactHistory,
    logContact,
    resetContactLog,
    active: state.creating || state.selected !== null,
  }
}

export type People = ReturnType<typeof usePeople>

function replacePerson(
  people: readonly PersonSnapshot[],
  snapshot: PersonSnapshot,
): readonly PersonSnapshot[] {
  const index = people.findIndex(
    ({ person }) => person.id === snapshot.person.id,
  )
  if (index < 0) return [snapshot, ...people]
  return people.map((value, itemIndex) =>
    itemIndex === index ? snapshot : value,
  )
}

function mergePeople(
  existing: readonly PersonSnapshot[],
  incoming: readonly PersonSnapshot[],
): readonly PersonSnapshot[] {
  const incomingIds = new Set(incoming.map(({ person }) => person.id))
  return [
    ...existing.filter(({ person }) => !incomingIds.has(person.id)),
    ...incoming,
  ]
}

function latestMutationSnapshot(
  state: PeopleState,
  snapshot: PersonSnapshot,
): Pick<PeopleState, 'selected' | 'people'> {
  return {
    selected:
      state.selected?.person.id === snapshot.person.id
        ? snapshot
        : state.selected,
    people: replacePerson(state.people, snapshot),
  }
}

function mergeContactDays(
  existing: PersonContactHistoryPage['days'],
  incoming: PersonContactHistoryPage['days'],
): PersonContactHistoryPage['days'] {
  const incomingDates = new Set(incoming.map(({ date }) => date))
  return [
    ...existing.filter(({ date }) => !incomingDates.has(date)),
    ...incoming,
  ]
}

function civilToday() {
  return deviceCalendar().today()
}
