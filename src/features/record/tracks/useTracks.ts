import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type CivilDate,
  type ClientFailure,
  type InvalidationToken,
  type LifeArchiveClient,
  type RevisionConflict,
  type StableId,
  type StructuredConflictState,
  type StructuredObject,
  type StructuredSummary,
  type Track,
  type TrackConflictState,
  type TrackHistoryCursor,
  type TrackMember,
  type TrackSummary,
} from '../../../core/client'
import {
  emptyMemberDraft,
  emptyTrackDraft,
  fieldsFromTrack,
  memberDraft,
  trackDraft,
  type TrackDraftFields,
  type TrackMemberDraftFields,
} from './trackDrafts'

const LIST_LIMIT = 100
const HISTORY_LIMIT = 50

export type TrackStatus =
  | 'loading'
  | 'ready'
  | 'failed'
  | 'creating'
  | 'saving'
  | 'conflicted'
  | 'deleted'
  | 'mock'

export interface TracksState {
  readonly status: TrackStatus
  readonly tracks: readonly TrackSummary[]
  readonly includeArchived: boolean
  readonly selected: Track | null
  readonly selectedSummary: TrackSummary | null
  readonly invalidation: InvalidationToken | null
  readonly history: readonly TrackMember[]
  readonly nextCursor: TrackHistoryCursor | null
  readonly draft: TrackDraftFields | null
  readonly memberDraft: TrackMemberDraftFields | null
  readonly creating: boolean
  readonly addingMember: boolean
  readonly failure: ClientFailure | null
  readonly conflict: RevisionConflict<TrackConflictState> | null
  readonly memberConflict: RevisionConflict<StructuredConflictState> | null
}

export interface CreatedTrack {
  readonly summary: TrackSummary
  readonly invalidation: InvalidationToken
}

export interface Tracks {
  readonly state: TracksState
  readonly active: boolean
  readonly setIncludeArchived: (include: boolean) => void
  readonly loadManagementList: () => Promise<readonly TrackSummary[]>
  readonly retry: () => void
  readonly select: (summary: TrackSummary) => void
  readonly clearSelection: () => void
  readonly startCreate: (date: CivilDate) => void
  readonly cancelCreate: () => void
  readonly updateTrack: (change: Partial<TrackDraftFields>) => void
  readonly updateMember: (change: Partial<TrackMemberDraftFields>) => void
  readonly includeFirstMember: (include: boolean, date: CivilDate) => void
  readonly create: () => Promise<CreatedTrack | null>
  readonly retryCreateWithNewIds: () => Promise<boolean>
  readonly save: () => Promise<boolean>
  readonly useArchiveVersion: () => void
  readonly saveMine: () => Promise<boolean>
  readonly deleteTrack: (detachMembers: boolean) => Promise<boolean>
  readonly startAddMember: (date: CivilDate) => void
  readonly cancelAddMember: () => void
  readonly createMember: () => Promise<boolean>
  readonly refreshMemberContext: () => Promise<boolean>
  readonly loadMore: () => Promise<void>
  readonly refresh: () => void
}

interface Model {
  status: TrackStatus
  tracks: readonly TrackSummary[]
  includeArchived: boolean
  selected: Track | null
  selectedSummary: TrackSummary | null
  invalidation: InvalidationToken | null
  history: readonly TrackMember[]
  nextCursor: TrackHistoryCursor | null
  draft: TrackDraftFields | null
  memberDraft: TrackMemberDraftFields | null
  creating: boolean
  addingMember: boolean
  failure: ClientFailure | null
  conflict: RevisionConflict<TrackConflictState> | null
  memberConflict: RevisionConflict<StructuredConflictState> | null
  newTrackId: StableId | null
  newMemberId: StableId | null
}

interface TrackOptions {
  readonly developmentMock: boolean
  readonly onMemberCreated: (summary: StructuredSummary) => void
  readonly refreshObjects: () => void
}

function initialModel(): Model {
  return {
    status: 'loading',
    tracks: [],
    includeArchived: false,
    selected: null,
    selectedSummary: null,
    invalidation: null,
    history: [],
    nextCursor: null,
    draft: null,
    memberDraft: null,
    creating: false,
    addingMember: false,
    failure: null,
    conflict: null,
    memberConflict: null,
    newTrackId: null,
    newMemberId: null,
  }
}

function conflictTrack(
  conflict: RevisionConflict<TrackConflictState>,
): Track | null {
  return conflict.current.presence === 'present' ? conflict.current.track : null
}

export function useTracks(
  client: LifeArchiveClient,
  { developmentMock, onMemberCreated, refreshObjects }: TrackOptions,
): Tracks {
  const model = useRef<Model>(initialModel())
  const [view, setView] = useState<Model>(initialModel)
  const [listGeneration, setListGeneration] = useState(0)
  const loadGeneration = useRef(0)
  const publish = useCallback(() => setView({ ...model.current }), [])
  const refresh = useCallback(() => setListGeneration((value) => value + 1), [])

  useEffect(() => {
    let live = true
    const current = model.current
    if (!current.creating && !current.selected) current.status = 'loading'
    current.failure = null
    publish()
    void client.tracks
      .list({
        includeArchived: current.includeArchived,
        limit: LIST_LIMIT,
      })
      .then((result) => {
        if (!live) return
        if (result.status === 'failed') {
          current.failure = result.failure
          current.status = 'failed'
        } else {
          current.tracks = result.value.tracks
          if (!current.selected && !current.creating) {
            current.invalidation = result.value.invalidation
            current.status = developmentMock ? 'mock' : 'ready'
          }
          if (current.selectedSummary) {
            current.selectedSummary =
              result.value.tracks.find(
                ({ track }) => track.id === current.selected?.id,
              ) ?? current.selectedSummary
          }
        }
        publish()
      })
    return () => {
      live = false
    }
  }, [client, developmentMock, listGeneration, publish, view.includeArchived])

  const loadHistory = useCallback(
    async (
      track: Track,
      invalidation: InvalidationToken,
      cursor: TrackHistoryCursor | null,
      append: boolean,
    ) => {
      const requested = (loadGeneration.current += 1)
      const result = await client.tracks.history({
        trackId: track.id,
        expectedTrackRevision: track.revision,
        expectedInvalidation: invalidation,
        limit: HISTORY_LIMIT,
        cursor,
      })
      if (requested !== loadGeneration.current) return
      const current = model.current
      if (result.status === 'failed') {
        current.failure = result.failure
        current.status = 'failed'
      } else {
        current.selected = result.value.track
        current.invalidation = result.value.invalidation
        current.history = append
          ? [...current.history, ...result.value.members]
          : result.value.members
        current.nextCursor = result.value.nextCursor
        current.draft = fieldsFromTrack(result.value.track)
        current.status = developmentMock ? 'mock' : 'ready'
      }
      publish()
    },
    [client, developmentMock, publish],
  )

  const select = useCallback(
    (summary: TrackSummary) => {
      const current = model.current
      current.creating = false
      current.addingMember = false
      current.memberDraft = null
      current.newTrackId = null
      current.newMemberId = null
      current.selectedSummary = summary
      current.selected = summary.track
      current.draft = fieldsFromTrack(summary.track)
      current.history = []
      current.nextCursor = null
      current.failure = null
      current.conflict = null
      current.memberConflict = null
      current.status = 'loading'
      publish()
      const requested = (loadGeneration.current += 1)
      void client.tracks.load(summary.track.id).then((result) => {
        if (requested !== loadGeneration.current) return
        if (result.status === 'failed') {
          current.failure = result.failure
          current.status = 'failed'
          publish()
          return
        }
        if (result.value.presence !== 'present') {
          current.status = 'deleted'
          publish()
          return
        }
        current.selected = result.value.track
        current.invalidation = result.value.invalidation
        current.draft = fieldsFromTrack(result.value.track)
        publish()
        void loadHistory(
          result.value.track,
          result.value.invalidation,
          null,
          false,
        )
      })
    },
    [client, loadHistory, publish],
  )

  const clearSelection = useCallback(() => {
    loadGeneration.current += 1
    const current = model.current
    current.selected = null
    current.selectedSummary = null
    current.history = []
    current.nextCursor = null
    current.draft = null
    current.memberDraft = null
    current.creating = false
    current.addingMember = false
    current.failure = null
    current.conflict = null
    current.memberConflict = null
    current.newTrackId = null
    current.newMemberId = null
    current.status = developmentMock ? 'mock' : 'ready'
    publish()
  }, [developmentMock, publish])

  const startCreate = useCallback(
    (_date: CivilDate) => {
      loadGeneration.current += 1
      const current = model.current
      current.selected = null
      current.selectedSummary = null
      current.history = []
      current.nextCursor = null
      current.draft = emptyTrackDraft()
      current.memberDraft = null
      current.creating = true
      current.addingMember = false
      current.failure = null
      current.conflict = null
      current.memberConflict = null
      current.newTrackId = client.operations.newStableId()
      current.newMemberId = null
      current.status = 'creating'
      publish()
      void _date
    },
    [client, publish],
  )

  const cancelCreate = useCallback(() => {
    const current = model.current
    current.creating = false
    current.draft = null
    current.memberDraft = null
    current.failure = null
    current.conflict = null
    current.memberConflict = null
    current.newTrackId = null
    current.newMemberId = null
    current.status = developmentMock ? 'mock' : 'ready'
    publish()
  }, [developmentMock, publish])

  const updateTrack = useCallback(
    (change: Partial<TrackDraftFields>) => {
      const current = model.current
      if (!current.draft) return
      const oldIcon = current.draft.iconId
      current.draft = { ...current.draft, ...change }
      if (
        current.memberDraft &&
        current.memberDraft.iconId === oldIcon &&
        change.iconId
      ) {
        current.memberDraft = {
          ...current.memberDraft,
          iconId: change.iconId,
        }
      }
      current.failure = null
      if (!current.creating && !current.conflict) current.status = 'ready'
      publish()
    },
    [publish],
  )

  const updateMember = useCallback(
    (change: Partial<TrackMemberDraftFields>) => {
      const current = model.current
      if (!current.memberDraft) return
      current.memberDraft = { ...current.memberDraft, ...change }
      current.failure = null
      publish()
    },
    [publish],
  )

  const includeFirstMember = useCallback(
    (include: boolean, date: CivilDate) => {
      const current = model.current
      if (!current.creating || !current.draft) return
      current.memberDraft = include
        ? emptyMemberDraft(date, current.draft)
        : null
      current.newMemberId = include
        ? (current.newMemberId ?? client.operations.newStableId())
        : null
      publish()
    },
    [client, publish],
  )

  const create = useCallback(async (): Promise<CreatedTrack | null> => {
    const current = model.current
    if (!current.creating || !current.draft || !current.newTrackId) return null
    const draft = trackDraft(current.draft)
    const firstMember = current.memberDraft
      ? memberDraft(current.memberDraft)
      : null
    if (!draft || (current.memberDraft && !firstMember)) return null
    current.status = 'saving'
    current.failure = null
    current.memberConflict = null
    publish()
    const result =
      current.memberDraft && firstMember
        ? await client.tracks.createWithFirstMember({
            newTrackId: current.newTrackId,
            newMemberId: current.newMemberId!,
            track: draft,
            member: firstMember,
            tagStateOmitted: current.memberDraft.tagStateOmitted,
            nowMs: Date.now(),
          })
        : await client.tracks.create({
            newTrackId: current.newTrackId,
            draft,
            nowMs: Date.now(),
          })
    if (result.status === 'failed') {
      current.failure = result.failure
      current.status = 'failed'
      publish()
      return null
    }
    if ('outcome' in result.value && result.value.outcome === 'conflict') {
      current.conflict = result.value.conflict
      current.status = 'conflicted'
      publish()
      return null
    }
    const createdTrack = result.value.track
    const createdSummary: TrackSummary = {
      track: createdTrack,
      memberCount: 'member' in result.value ? 1 : 0,
      ongoingMemberCount:
        'member' in result.value &&
        result.value.member.summary.placement.kind === 'span' &&
        result.value.member.summary.placement.endDate === null
          ? 1
          : 0,
    }
    current.creating = false
    current.selected = createdTrack
    current.selectedSummary = createdSummary
    current.tracks = [
      ...current.tracks.filter(({ track }) => track.id !== createdTrack.id),
      createdSummary,
    ]
    current.invalidation = result.value.invalidation
    current.draft = fieldsFromTrack(createdTrack)
    current.memberDraft = null
    current.newTrackId = null
    current.newMemberId = null
    current.history = []
    current.nextCursor = null
    current.status = developmentMock ? 'mock' : 'ready'
    if ('member' in result.value) {
      onMemberCreated(result.value.member.summary)
      refreshObjects()
    }
    publish()
    refresh()
    void loadHistory(createdTrack, result.value.invalidation, null, false)
    return {
      summary: createdSummary,
      invalidation: result.value.invalidation,
    }
  }, [
    client,
    developmentMock,
    loadHistory,
    onMemberCreated,
    publish,
    refresh,
    refreshObjects,
  ])

  const save = useCallback(async (): Promise<boolean> => {
    const current = model.current
    if (!current.selected || !current.draft) return false
    const draft = trackDraft(current.draft)
    if (!draft) return false
    current.status = 'saving'
    current.failure = null
    publish()
    const result = await client.tracks.save({
      id: current.selected.id,
      expectedRevision: current.selected.revision,
      draft,
      nowMs: Date.now(),
    })
    if (result.status === 'failed') {
      current.failure = result.failure
      current.status = 'failed'
      publish()
      return false
    }
    if (result.value.outcome === 'conflict') {
      current.conflict = result.value.conflict
      current.status = 'conflicted'
      publish()
      return false
    }
    current.selected = result.value.track
    current.draft = fieldsFromTrack(result.value.track)
    current.invalidation = result.value.invalidation
    current.conflict = null
    current.status = developmentMock ? 'mock' : 'ready'
    publish()
    refresh()
    return true
  }, [client, developmentMock, publish, refresh])

  const retryCreateWithNewIds = useCallback(async (): Promise<boolean> => {
    const current = model.current
    if (!current.creating || !current.draft || !current.conflict) return false
    current.newTrackId = client.operations.newStableId()
    if (current.memberDraft) {
      current.newMemberId = client.operations.newStableId()
    }
    current.conflict = null
    current.status = 'creating'
    publish()
    return (await create()) !== null
  }, [client, create, publish])

  const useArchiveVersion = useCallback(() => {
    const current = model.current
    if (!current.conflict) return
    const track = conflictTrack(current.conflict)
    if (!track) return
    current.selected = track
    current.draft = fieldsFromTrack(track)
    current.conflict = null
    current.failure = null
    current.status = developmentMock ? 'mock' : 'ready'
    publish()
    refresh()
  }, [developmentMock, publish, refresh])

  const saveMine = useCallback(async (): Promise<boolean> => {
    const current = model.current
    if (!current.conflict) return false
    const track = conflictTrack(current.conflict)
    if (!track) return false
    current.selected = track
    current.conflict = null
    return save()
  }, [save])

  const deleteTrack = useCallback(
    async (detachMembers: boolean): Promise<boolean> => {
      const current = model.current
      if (!current.selected) return false
      current.status = 'saving'
      current.failure = null
      publish()
      const result = await client.tracks.delete({
        id: current.selected.id,
        expectedRevision: current.selected.revision,
        detachMembers,
        nowMs: Date.now(),
      })
      if (result.status === 'failed') {
        current.failure = result.failure
        current.status = 'failed'
        publish()
        return false
      }
      if (result.value.outcome === 'conflict') {
        current.conflict = result.value.conflict
        current.status = 'conflicted'
        publish()
        return false
      }
      current.tracks = current.tracks.filter(
        ({ track }) => track.id !== current.selected?.id,
      )
      clearSelection()
      refresh()
      refreshObjects()
      return true
    },
    [clearSelection, client, publish, refresh, refreshObjects],
  )

  const startAddMember = useCallback(
    (date: CivilDate) => {
      const current = model.current
      if (!current.selected || !current.draft) return
      current.addingMember = true
      current.memberDraft = emptyMemberDraft(date, current.draft)
      current.newMemberId = client.operations.newStableId()
      current.failure = null
      current.memberConflict = null
      publish()
    },
    [client, publish],
  )

  const cancelAddMember = useCallback(() => {
    const current = model.current
    current.addingMember = false
    current.memberDraft = null
    current.newMemberId = null
    current.failure = null
    current.memberConflict = null
    publish()
  }, [publish])

  const createMember = useCallback(async (): Promise<boolean> => {
    const current = model.current
    if (
      !current.selected ||
      !current.invalidation ||
      !current.memberDraft ||
      !current.newMemberId
    ) {
      return false
    }
    const draft = memberDraft(current.memberDraft)
    if (!draft) return false
    current.status = 'saving'
    current.failure = null
    current.memberConflict = null
    publish()
    const result = await client.tracks.createMember({
      trackId: current.selected.id,
      expectedTrackRevision: current.selected.revision,
      expectedInvalidation: current.invalidation,
      newMemberId: current.newMemberId,
      member: draft,
      tagStateOmitted: current.memberDraft.tagStateOmitted,
      nowMs: Date.now(),
    })
    if (result.status === 'failed') {
      current.failure = result.failure
      current.status = 'failed'
      publish()
      return false
    }
    if (result.value.outcome === 'conflict') {
      current.memberConflict = result.value.conflict
      current.status = 'failed'
      publish()
      return false
    }
    const object: StructuredObject = result.value.object
    current.addingMember = false
    current.memberDraft = null
    current.newMemberId = null
    current.invalidation = result.value.invalidation
    current.status = developmentMock ? 'mock' : 'ready'
    onMemberCreated(object.summary)
    refreshObjects()
    publish()
    refresh()
    void loadHistory(current.selected, result.value.invalidation, null, false)
    return true
  }, [
    client,
    developmentMock,
    loadHistory,
    onMemberCreated,
    publish,
    refresh,
    refreshObjects,
  ])

  const refreshMemberContext = useCallback(async (): Promise<boolean> => {
    const current = model.current
    if (!current.selected || !current.memberDraft) return false
    current.status = 'loading'
    current.failure = null
    publish()
    const result = await client.tracks.load(current.selected.id)
    if (result.status === 'failed') {
      current.failure = result.failure
      current.status = 'failed'
      publish()
      return false
    }
    if (result.value.presence !== 'present') {
      current.status = 'deleted'
      publish()
      return false
    }
    current.selected = result.value.track
    current.invalidation = result.value.invalidation
    current.memberConflict = null
    current.status = developmentMock ? 'mock' : 'ready'
    publish()
    return true
  }, [client, developmentMock, publish])

  const loadMore = useCallback(async () => {
    const current = model.current
    if (!current.selected || !current.invalidation || !current.nextCursor)
      return
    await loadHistory(
      current.selected,
      current.invalidation,
      current.nextCursor,
      true,
    )
  }, [loadHistory])

  const loadManagementList = useCallback(async () => {
    const result = await client.tracks.list({
      includeArchived: true,
      limit: LIST_LIMIT,
    })
    const current = model.current.tracks
    if (result.status === 'failed') return current
    const summaries = new Map<StableId, TrackSummary>()
    for (const summary of current) summaries.set(summary.track.id, summary)
    for (const summary of result.value.tracks) {
      summaries.set(summary.track.id, summary)
    }
    return [...summaries.values()]
  }, [client])

  const state = useMemo<TracksState>(() => ({ ...view }), [view])
  return {
    state,
    active: state.creating || state.selected !== null,
    setIncludeArchived: useCallback(
      (include: boolean) => {
        model.current.includeArchived = include
        publish()
      },
      [publish],
    ),
    loadManagementList,
    retry: refresh,
    select,
    clearSelection,
    startCreate,
    cancelCreate,
    updateTrack,
    updateMember,
    includeFirstMember,
    create,
    retryCreateWithNewIds,
    save,
    useArchiveVersion,
    saveMine,
    deleteTrack,
    startAddMember,
    cancelAddMember,
    createMember,
    refreshMemberContext,
    loadMore,
    refresh,
  }
}
