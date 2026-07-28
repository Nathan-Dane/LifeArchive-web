import { useCallback, useEffect, useRef, useState } from 'react'
import {
  civilDate,
  isCivilDate,
  isStableId,
  stableId,
  type CivilDate,
  type ClientFailure,
  type InvalidationToken,
  type LifeArchiveClient,
  type PrivacyLevel,
  type Revision,
  type RevisionConflict,
  type StableId,
  type StructuredConflictState,
  type StructuredDraft,
  type StructuredObject,
  type StructuredSummary,
} from '../../../core/client'
import type { RecordDraftRegistration } from '../recordDraftSession'

const AUTOSAVE_DELAY_MS = 500

/*
 * This is a core semantic ID, not a web-icon choice. RecordSemanticIcon is the
 * deliberately separate adapter where the later catalogue-to-glyph mapping
 * belongs.
 */
const EVENT_DEFAULT_ICON_ID = 'life-event'

export type EventEditorStatus =
  | 'idle'
  | 'creating'
  | 'loading'
  | 'ready'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'failed'
  | 'conflicted'
  | 'missing'
  | 'mock'

export interface EventDraftFields {
  readonly title: string
  readonly markdown: string
  readonly date: string
  readonly iconId: string
  readonly tagIds: readonly string[]
  readonly displayTagId: string
  readonly trackId: string
  readonly privacy: PrivacyLevel
}

interface EventModel {
  readonly key: string
  readonly newObjectId: StableId | null
  object: StructuredObject | null
  draft: EventDraftFields
  saved: EventDraftFields
  status: EventEditorStatus
  failure: ClientFailure | null
  conflict: RevisionConflict<StructuredConflictState> | null
  invalidation: InvalidationToken | null
  generation: number
  activeSave: Promise<void> | null
}

export interface EventEditor {
  readonly status: EventEditorStatus
  readonly draft: EventDraftFields | null
  readonly object: StructuredObject | null
  readonly failure: ClientFailure | null
  readonly conflict: RevisionConflict<StructuredConflictState> | null
  readonly invalidation: InvalidationToken | null
  readonly creating: boolean
  readonly update: (change: Partial<EventDraftFields>) => void
  readonly startCreate: (date: CivilDate) => void
  readonly cancelCreate: () => void
  readonly create: () => Promise<void>
  readonly retryLoad: () => void
  readonly retrySave: () => void
  readonly saveMine: () => void
  readonly useArchiveVersion: () => void
  readonly changeTrack: (trackId: StableId | null) => Promise<boolean>
  readonly deleteEvent: () => Promise<boolean>
  readonly adoptMediaRevision: (revision: Revision) => void
}

interface EventEditorOptions {
  readonly selected: StructuredSummary | null
  readonly developmentMock: boolean
  readonly register: (
    draft: RecordDraftRegistration,
  ) => (() => void) | undefined
  readonly onCreated: (summary: StructuredSummary) => void
  readonly onChanged: (summary: StructuredSummary) => void
  readonly onDeleted: (id: StableId) => void
  readonly refreshObjects: () => void
}

function fieldsFromObject(object: StructuredObject): EventDraftFields {
  const placement = object.summary.placement
  if (placement.kind !== 'event') {
    throw new TypeError('The Event editor received a Span')
  }
  return {
    title: object.summary.title,
    markdown: object.markdown,
    date: placement.date,
    iconId: object.summary.iconId,
    tagIds: object.summary.tags.ordered,
    displayTagId: object.summary.tags.display ?? '',
    trackId: object.summary.trackId ?? '',
    privacy: object.privacy,
  }
}

function newFields(date: CivilDate): EventDraftFields {
  return {
    title: '',
    markdown: '',
    date,
    iconId: EVENT_DEFAULT_ICON_ID,
    tagIds: [],
    displayTagId: '',
    trackId: '',
    privacy: 'normal',
  }
}

function equalFields(left: EventDraftFields, right: EventDraftFields): boolean {
  return (
    left.title === right.title &&
    left.markdown === right.markdown &&
    left.date === right.date &&
    left.iconId === right.iconId &&
    left.displayTagId === right.displayTagId &&
    left.trackId === right.trackId &&
    left.privacy === right.privacy &&
    left.tagIds.length === right.tagIds.length &&
    left.tagIds.every((tag, index) => tag === right.tagIds[index])
  )
}

/**
 * Syntax-only shaping for the ergonomic client. Actual title, date, semantic,
 * membership, and uniqueness validation remains a structured core result.
 */
function structuredDraft(fields: EventDraftFields): StructuredDraft | null {
  if (
    !isCivilDate(fields.date) ||
    fields.iconId.length === 0 ||
    (fields.trackId.length > 0 && !isStableId(fields.trackId))
  ) {
    return null
  }
  const ordered = [...fields.tagIds]
  const display =
    fields.displayTagId.length > 0 && ordered.includes(fields.displayTagId)
      ? fields.displayTagId
      : (ordered[0] ?? null)
  return {
    title: fields.title,
    markdown: fields.markdown,
    placement: { kind: 'event', date: civilDate(fields.date) },
    iconId: fields.iconId,
    tags: { ordered, display },
    trackId: fields.trackId.length > 0 ? stableId(fields.trackId) : null,
    privacy: fields.privacy,
  }
}

function conflictObject(
  conflict: RevisionConflict<StructuredConflictState>,
): StructuredObject | null {
  return conflict.current.presence === 'present'
    ? conflict.current.object
    : null
}

export function useEventEditor(
  client: LifeArchiveClient,
  {
    selected,
    developmentMock,
    register,
    onCreated,
    onChanged,
    onDeleted,
    refreshObjects,
  }: EventEditorOptions,
): EventEditor {
  const models = useRef(new Map<string, EventModel>())
  const loadGeneration = useRef(0)
  const [creationKey, setCreationKey] = useState<string | null>(null)
  const [view, setView] = useState<EventModel | null>(null)
  const [retryGeneration, setRetryGeneration] = useState(0)
  const selectedEvent = selected?.placement.kind === 'event' ? selected : null
  const activeKey = creationKey ?? selectedEvent?.id ?? null
  const publish = useCallback(
    (model: EventModel | null) => setView(model ? { ...model } : null),
    [],
  )

  const saveModel = useCallback(
    async (model: EventModel, drain: boolean, force = false): Promise<void> => {
      let forceAttempt = force
      while (true) {
        if (!model.object || model.newObjectId || model.conflict) return
        if (model.activeSave) {
          await model.activeSave
          forceAttempt = false
          continue
        }
        if (equalFields(model.draft, model.saved) && !forceAttempt) return
        const draft = structuredDraft(model.draft)
        if (!draft) {
          model.status = 'dirty'
          publish(model)
          return
        }

        const savedDraft = model.draft
        const expectedRevision = model.object.summary.revision
        const requested = (model.generation += 1)
        model.status = 'saving'
        model.failure = null
        publish(model)

        const operation = client.structured
          .save({
            id: model.object.summary.id,
            expectedRevision,
            draft,
            nowMs: Date.now(),
          })
          .then((result) => {
            if (requested !== model.generation) return
            if (result.status === 'failed') {
              model.failure = result.failure
              model.status = 'failed'
              return
            }
            if (result.value.outcome === 'conflict') {
              model.conflict = result.value.conflict
              model.status = 'conflicted'
              return
            }
            model.object = result.value.object
            model.invalidation = result.value.invalidation
            model.saved = savedDraft
            model.status = developmentMock
              ? 'mock'
              : equalFields(model.draft, savedDraft)
                ? 'saved'
                : 'dirty'
            onChanged(result.value.object.summary)
            refreshObjects()
          })
          .finally(() => {
            if (model.activeSave === operation) model.activeSave = null
            publish(model)
          })
        model.activeSave = operation
        await operation
        forceAttempt = false

        if (
          !drain ||
          model.conflict ||
          model.failure ||
          equalFields(model.draft, model.saved)
        ) {
          return
        }
      }
    },
    [client, developmentMock, onChanged, publish, refreshObjects],
  )

  const hasPendingWriting = useCallback(
    () =>
      [...models.current.values()].some(
        (model) =>
          model.newObjectId === null &&
          (model.activeSave !== null ||
            model.conflict !== null ||
            !equalFields(model.draft, model.saved)),
      ),
    [],
  )

  const flush = useCallback(
    () =>
      Promise.all(
        [...models.current.values()].map((model) => saveModel(model, true)),
      ).then(() => undefined),
    [saveModel],
  )

  useEffect(
    () => register({ hasPendingWriting, flush }),
    [flush, hasPendingWriting, register],
  )

  useEffect(() => {
    if (!selectedEvent || creationKey) return
    const key = selectedEvent.id
    const eventPlacement = selectedEvent.placement
    if (eventPlacement.kind !== 'event') return
    const requested = (loadGeneration.current += 1)
    void Promise.resolve().then(async () => {
      const existing = models.current.get(key)
      if (
        existing &&
        existing.status !== 'failed' &&
        existing.status !== 'missing'
      ) {
        publish(existing)
        return
      }
      const placeholder: EventModel = existing ?? {
        key,
        newObjectId: null,
        object: null,
        draft: {
          title: selectedEvent.title,
          markdown: '',
          date: eventPlacement.date,
          iconId: selectedEvent.iconId,
          tagIds: selectedEvent.tags.ordered,
          displayTagId: selectedEvent.tags.display ?? '',
          trackId: selectedEvent.trackId ?? '',
          privacy: 'normal',
        },
        saved: {
          title: selectedEvent.title,
          markdown: '',
          date: eventPlacement.date,
          iconId: selectedEvent.iconId,
          tagIds: selectedEvent.tags.ordered,
          displayTagId: selectedEvent.tags.display ?? '',
          trackId: selectedEvent.trackId ?? '',
          privacy: 'normal',
        },
        status: 'loading',
        failure: null,
        conflict: null,
        invalidation: null,
        generation: 0,
        activeSave: null,
      }
      placeholder.status = 'loading'
      placeholder.failure = null
      models.current.set(key, placeholder)
      publish(placeholder)

      const result = await client.structured.load({
        id: selectedEvent.id,
        includeDeleted: false,
      })
      if (requested !== loadGeneration.current) return
      if (result.status === 'failed') {
        placeholder.status = 'failed'
        placeholder.failure = result.failure
        publish(placeholder)
        return
      }
      if (result.value.presence !== 'present') {
        placeholder.status = 'missing'
        publish(placeholder)
        return
      }
      const object = result.value.object
      if (object.summary.placement.kind !== 'event') {
        placeholder.status = 'missing'
        publish(placeholder)
        return
      }
      const fields = fieldsFromObject(object)
      placeholder.object = object
      placeholder.invalidation = result.value.invalidation
      placeholder.draft = fields
      placeholder.saved = fields
      placeholder.status = developmentMock ? 'mock' : 'ready'
      publish(placeholder)
    })
  }, [
    client,
    creationKey,
    developmentMock,
    publish,
    retryGeneration,
    selectedEvent,
  ])

  useEffect(() => {
    const model = activeKey ? models.current.get(activeKey) : null
    if (!model || model.status !== 'dirty' || model.newObjectId) return
    const timer = globalThis.window.setTimeout(
      () => void saveModel(model, false),
      AUTOSAVE_DELAY_MS,
    )
    return () => globalThis.window.clearTimeout(timer)
  }, [activeKey, saveModel, view])

  const update = useCallback(
    (change: Partial<EventDraftFields>) => {
      const key = creationKey ?? selectedEvent?.id ?? null
      if (!key) return
      const model = models.current.get(key)
      if (!model) return
      model.draft = { ...model.draft, ...change }
      model.failure = null
      if (!model.newObjectId && !model.conflict) {
        model.status = equalFields(model.draft, model.saved)
          ? developmentMock
            ? 'mock'
            : 'ready'
          : 'dirty'
      }
      publish(model)
    },
    [creationKey, developmentMock, publish, selectedEvent?.id],
  )

  const startCreate = useCallback(
    (date: CivilDate) => {
      const id = client.operations.newStableId()
      const key = `new:${id}`
      const fields = newFields(date)
      const model: EventModel = {
        key,
        newObjectId: id,
        object: null,
        draft: fields,
        saved: fields,
        status: 'creating',
        failure: null,
        conflict: null,
        invalidation: null,
        generation: 0,
        activeSave: null,
      }
      models.current.set(key, model)
      setCreationKey(key)
      publish(model)
    },
    [client, publish],
  )

  const cancelCreate = useCallback(() => {
    const key = creationKey
    if (!key) return
    models.current.delete(key)
    setCreationKey(null)
    publish(
      selectedEvent ? (models.current.get(selectedEvent.id) ?? null) : null,
    )
  }, [creationKey, publish, selectedEvent])

  const create = useCallback(async () => {
    const key = creationKey
    const model = key ? models.current.get(key) : null
    if (!key || !model?.newObjectId) return
    const draft = structuredDraft(model.draft)
    if (!draft) {
      model.status = 'creating'
      publish(model)
      return
    }
    model.status = 'saving'
    model.failure = null
    publish(model)
    const result = await client.structured.create({
      newObjectId: model.newObjectId,
      draft,
      nowMs: Date.now(),
    })
    if (models.current.get(key) !== model) return
    if (result.status === 'failed') {
      model.status = 'failed'
      model.failure = result.failure
      publish(model)
      return
    }
    if (result.value.outcome === 'conflict') {
      model.status = 'conflicted'
      model.conflict = result.value.conflict
      publish(model)
      return
    }
    const object = result.value.object
    const fields = fieldsFromObject(object)
    const persisted: EventModel = {
      ...model,
      key: object.summary.id,
      newObjectId: null,
      object,
      draft: fields,
      saved: fields,
      status: developmentMock ? 'mock' : 'saved',
      failure: null,
      conflict: null,
      invalidation: result.value.invalidation,
      activeSave: null,
    }
    models.current.delete(key)
    models.current.set(object.summary.id, persisted)
    setCreationKey(null)
    onCreated(object.summary)
    refreshObjects()
    publish(persisted)
  }, [client, creationKey, developmentMock, onCreated, publish, refreshObjects])

  const retrySave = useCallback(() => {
    const model = activeKey ? models.current.get(activeKey) : null
    if (!model || model.newObjectId) return
    model.failure = null
    model.status = 'dirty'
    publish(model)
    void saveModel(model, true, true)
  }, [activeKey, publish, saveModel])

  const saveMine = useCallback(() => {
    const model = activeKey ? models.current.get(activeKey) : null
    if (!model?.conflict) return
    const current = conflictObject(model.conflict)
    if (!current) return
    model.object = current
    model.conflict = null
    model.status = 'dirty'
    model.generation += 1
    publish(model)
    void saveModel(model, true, true)
  }, [activeKey, publish, saveModel])

  const useArchiveVersion = useCallback(() => {
    const model = activeKey ? models.current.get(activeKey) : null
    if (!model?.conflict) return
    const current = conflictObject(model.conflict)
    if (!current || current.summary.placement.kind !== 'event') return
    const fields = fieldsFromObject(current)
    model.object = current
    model.draft = fields
    model.saved = fields
    model.conflict = null
    model.failure = null
    model.status = developmentMock ? 'mock' : 'ready'
    model.generation += 1
    onChanged(current.summary)
    publish(model)
  }, [activeKey, developmentMock, onChanged, publish])

  const deleteEvent = useCallback(async (): Promise<boolean> => {
    const model = activeKey ? models.current.get(activeKey) : null
    if (!model?.object || model.newObjectId) return false
    await saveModel(model, true)
    if (
      model.conflict ||
      model.failure ||
      !equalFields(model.draft, model.saved)
    ) {
      publish(model)
      return false
    }
    const result = await client.structured.delete({
      id: model.object.summary.id,
      expectedRevision: model.object.summary.revision,
      nowMs: Date.now(),
    })
    if (result.status === 'failed') {
      model.failure = result.failure
      model.status = 'failed'
      publish(model)
      return false
    }
    if (result.value.outcome === 'conflict') {
      model.conflict = result.value.conflict
      model.status = 'conflicted'
      publish(model)
      return false
    }
    models.current.delete(model.key)
    onDeleted(result.value.deletedId)
    refreshObjects()
    publish(null)
    return true
  }, [activeKey, client, onDeleted, publish, refreshObjects, saveModel])

  const changeTrack = useCallback(
    async (trackId: StableId | null): Promise<boolean> => {
      const model = activeKey ? models.current.get(activeKey) : null
      if (
        !model?.object ||
        !model.invalidation ||
        model.newObjectId ||
        model.object.summary.trackId === trackId
      ) {
        return model?.object?.summary.trackId === trackId
      }
      await saveModel(model, true)
      if (
        !model.object ||
        !model.invalidation ||
        model.conflict ||
        model.failure ||
        !equalFields(model.draft, model.saved)
      ) {
        publish(model)
        return false
      }
      model.status = 'saving'
      model.failure = null
      publish(model)
      const request = {
        memberId: model.object.summary.id,
        memberKind: 'event' as const,
        expectedMemberRevision: model.object.summary.revision,
        expectedInvalidation: model.invalidation,
        nowMs: Date.now(),
      }
      const result = trackId
        ? await client.tracks.attachMember({ ...request, trackId })
        : await client.tracks.detachMember(request)
      if (result.status === 'failed') {
        model.failure = result.failure
        model.status = 'failed'
        publish(model)
        return false
      }
      if (result.value.outcome === 'conflict') {
        model.conflict = result.value.conflict
        model.status = 'conflicted'
        publish(model)
        return false
      }
      if (result.value.object.summary.placement.kind !== 'event') return false
      const fields = fieldsFromObject(result.value.object)
      model.object = result.value.object
      model.invalidation = result.value.invalidation
      model.draft = fields
      model.saved = fields
      model.status = developmentMock ? 'mock' : 'saved'
      onChanged(result.value.object.summary)
      refreshObjects()
      publish(model)
      return true
    },
    [
      activeKey,
      client,
      developmentMock,
      onChanged,
      publish,
      refreshObjects,
      saveModel,
    ],
  )

  const displayedView = view?.key === activeKey ? view : null
  const adoptMediaRevision = useCallback(
    (revision: Revision) => {
      const model = activeKey ? models.current.get(activeKey) : null
      if (
        !model?.object ||
        model.object.summary.revision === revision ||
        model.newObjectId
      ) {
        return
      }
      model.object = {
        ...model.object,
        summary: { ...model.object.summary, revision },
      }
      onChanged(model.object.summary)
      publish(model)
    },
    [activeKey, onChanged, publish],
  )
  return {
    status: displayedView?.status ?? 'idle',
    draft: displayedView?.draft ?? null,
    object: displayedView?.object ?? null,
    failure: displayedView?.failure ?? null,
    conflict: displayedView?.conflict ?? null,
    invalidation: displayedView?.invalidation ?? null,
    creating: displayedView?.newObjectId !== null && displayedView !== null,
    update,
    startCreate,
    cancelCreate,
    create,
    retryLoad: useCallback(() => {
      if (selectedEvent) models.current.delete(selectedEvent.id)
      publish(null)
      setRetryGeneration((value) => value + 1)
    }, [publish, selectedEvent]),
    retrySave,
    saveMine,
    useArchiveVersion,
    changeTrack,
    deleteEvent,
    adoptMediaRevision,
  }
}
