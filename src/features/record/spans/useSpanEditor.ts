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
import { SPAN_DEFAULT_ICON_ID } from '../metadata/semanticCatalog'

const AUTOSAVE_DELAY_MS = 500

export type SpanEditorStatus =
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

export interface SpanDraftFields {
  readonly title: string
  readonly markdown: string
  readonly startDate: string
  readonly endDate: string
  readonly ongoing: boolean
  readonly beginMarkerEnabled: boolean
  readonly beginMarkerTitle: string
  readonly endMarkerEnabled: boolean
  readonly endMarkerTitle: string
  readonly iconId: string
  readonly tagIds: readonly string[]
  readonly displayTagId: string
  readonly trackId: string
  readonly privacy: PrivacyLevel
}

interface SpanModel {
  readonly key: string
  readonly newObjectId: StableId | null
  object: StructuredObject | null
  draft: SpanDraftFields
  saved: SpanDraftFields
  status: SpanEditorStatus
  failure: ClientFailure | null
  conflict: RevisionConflict<StructuredConflictState> | null
  invalidation: InvalidationToken | null
  generation: number
  activeSave: Promise<void> | null
  movedRange: boolean
}

export interface SpanEditor {
  readonly status: SpanEditorStatus
  readonly draft: SpanDraftFields | null
  readonly object: StructuredObject | null
  readonly failure: ClientFailure | null
  readonly conflict: RevisionConflict<StructuredConflictState> | null
  readonly invalidation: InvalidationToken | null
  readonly creating: boolean
  readonly movedRange: boolean
  readonly update: (change: Partial<SpanDraftFields>) => void
  readonly resetMarkerTitle: (boundary: 'begin' | 'end') => void
  readonly dismissMovedRange: () => void
  readonly startCreate: (date: CivilDate) => void
  readonly cancelCreate: () => void
  readonly create: () => Promise<void>
  readonly retryLoad: () => void
  readonly retrySave: () => void
  readonly saveMine: () => void
  readonly useArchiveVersion: () => void
  readonly changeTrack: (trackId: StableId | null) => Promise<boolean>
  readonly convertToEvent: (date: string) => Promise<boolean>
  readonly deleteSpan: () => Promise<boolean>
  readonly adoptMediaRevision: (revision: Revision) => void
}

interface SpanEditorOptions {
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

function fieldsFromObject(object: StructuredObject): SpanDraftFields {
  const placement = object.summary.placement
  if (placement.kind !== 'span') {
    throw new TypeError('The Span editor received an Event')
  }
  return {
    title: object.summary.title,
    markdown: object.markdown,
    startDate: placement.startDate,
    endDate: placement.endDate ?? '',
    ongoing: placement.endDate === null,
    beginMarkerEnabled: placement.beginMarker.enabled,
    beginMarkerTitle: placement.beginMarker.titleOverride ?? '',
    endMarkerEnabled: placement.endMarker.enabled,
    endMarkerTitle: placement.endMarker.titleOverride ?? '',
    iconId: object.summary.iconId,
    tagIds: object.summary.tags.ordered,
    displayTagId: object.summary.tags.display ?? '',
    trackId: object.summary.trackId ?? '',
    privacy: object.privacy,
  }
}

function fieldsFromSummary(summary: StructuredSummary): SpanDraftFields {
  const placement = summary.placement
  if (placement.kind !== 'span') {
    throw new TypeError('The Span editor received an Event')
  }
  return {
    title: summary.title,
    markdown: '',
    startDate: placement.startDate,
    endDate: placement.endDate ?? '',
    ongoing: placement.endDate === null,
    beginMarkerEnabled: placement.beginMarker.enabled,
    beginMarkerTitle: placement.beginMarker.titleOverride ?? '',
    endMarkerEnabled: placement.endMarker.enabled,
    endMarkerTitle: placement.endMarker.titleOverride ?? '',
    iconId: summary.iconId,
    tagIds: summary.tags.ordered,
    displayTagId: summary.tags.display ?? '',
    trackId: summary.trackId ?? '',
    privacy: 'normal',
  }
}

function newFields(date: CivilDate): SpanDraftFields {
  return {
    title: '',
    markdown: '',
    startDate: date,
    endDate: '',
    ongoing: true,
    beginMarkerEnabled: false,
    beginMarkerTitle: '',
    endMarkerEnabled: false,
    endMarkerTitle: '',
    iconId: SPAN_DEFAULT_ICON_ID,
    tagIds: ['personal'],
    displayTagId: 'personal',
    trackId: '',
    privacy: 'normal',
  }
}

function equalFields(left: SpanDraftFields, right: SpanDraftFields): boolean {
  return (
    left.title === right.title &&
    left.markdown === right.markdown &&
    left.startDate === right.startDate &&
    left.endDate === right.endDate &&
    left.ongoing === right.ongoing &&
    left.beginMarkerEnabled === right.beginMarkerEnabled &&
    left.beginMarkerTitle === right.beginMarkerTitle &&
    left.endMarkerEnabled === right.endMarkerEnabled &&
    left.endMarkerTitle === right.endMarkerTitle &&
    left.iconId === right.iconId &&
    left.displayTagId === right.displayTagId &&
    left.trackId === right.trackId &&
    left.privacy === right.privacy &&
    left.tagIds.length === right.tagIds.length &&
    left.tagIds.every((tag, index) => tag === right.tagIds[index])
  )
}

function structuredDraft(fields: SpanDraftFields): StructuredDraft | null {
  if (
    !isCivilDate(fields.startDate) ||
    (!fields.ongoing && !isCivilDate(fields.endDate)) ||
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
    placement: {
      kind: 'span',
      startDate: civilDate(fields.startDate),
      endDate: fields.ongoing ? null : civilDate(fields.endDate),
      beginMarker: {
        enabled: fields.beginMarkerEnabled,
        titleOverride:
          fields.beginMarkerEnabled && fields.beginMarkerTitle.length > 0
            ? fields.beginMarkerTitle
            : null,
      },
      endMarker: {
        enabled: fields.endMarkerEnabled,
        titleOverride:
          fields.endMarkerEnabled && fields.endMarkerTitle.length > 0
            ? fields.endMarkerTitle
            : null,
      },
    },
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

function rangeChanged(
  before: StructuredObject,
  after: StructuredObject,
): boolean {
  const oldPlacement = before.summary.placement
  const newPlacement = after.summary.placement
  return (
    oldPlacement.kind === 'span' &&
    newPlacement.kind === 'span' &&
    (oldPlacement.startDate !== newPlacement.startDate ||
      oldPlacement.endDate !== newPlacement.endDate)
  )
}

export function useSpanEditor(
  client: LifeArchiveClient,
  {
    selected,
    developmentMock,
    register,
    onCreated,
    onChanged,
    onDeleted,
    refreshObjects,
  }: SpanEditorOptions,
): SpanEditor {
  const models = useRef(new Map<string, SpanModel>())
  const loadGeneration = useRef(0)
  const loadSelection = useRef<string | null>(null)
  const [creationKey, setCreationKey] = useState<string | null>(null)
  const [view, setView] = useState<SpanModel | null>(null)
  const [retryGeneration, setRetryGeneration] = useState(0)
  const selectedSpan = selected?.placement.kind === 'span' ? selected : null
  const activeKey = creationKey ?? selectedSpan?.id ?? null
  const publish = useCallback(
    (model: SpanModel | null) => setView(model ? { ...model } : null),
    [],
  )

  const saveModel = useCallback(
    async (model: SpanModel, drain: boolean, force = false): Promise<void> => {
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
        const priorObject = model.object
        const requested = (model.generation += 1)
        model.status = 'saving'
        model.failure = null
        publish(model)
        const operation = client.structured
          .save({
            id: priorObject.summary.id,
            expectedRevision: priorObject.summary.revision,
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
            if (result.value.object.summary.placement.kind !== 'span') {
              model.status = 'failed'
              return
            }
            model.movedRange =
              model.movedRange || rangeChanged(priorObject, result.value.object)
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
    const selection = creationKey ?? selectedSpan?.id ?? null
    const selectionChanged = loadSelection.current !== selection
    if (selectionChanged) {
      loadSelection.current = selection
      loadGeneration.current += 1
    }
    if (!selectedSpan || creationKey) return
    const key = selectedSpan.id
    const existing = models.current.get(key)
    if (
      existing &&
      existing.status !== 'failed' &&
      existing.status !== 'missing'
    ) {
      publish(existing)
      return
    }

    const requested = selectionChanged
      ? loadGeneration.current
      : (loadGeneration.current += 1)
    void (async () => {
      const fields = fieldsFromSummary(selectedSpan)
      const placeholder: SpanModel = existing ?? {
        key,
        newObjectId: null,
        object: null,
        draft: fields,
        saved: fields,
        status: 'loading',
        failure: null,
        conflict: null,
        invalidation: null,
        generation: 0,
        activeSave: null,
        movedRange: false,
      }
      placeholder.status = 'loading'
      placeholder.failure = null
      models.current.set(key, placeholder)
      publish(placeholder)

      const result = await client.structured.load({
        id: selectedSpan.id,
        includeDeleted: false,
      })
      if (requested !== loadGeneration.current) return
      if (result.status === 'failed') {
        placeholder.status = 'failed'
        placeholder.failure = result.failure
        publish(placeholder)
        return
      }
      if (
        result.value.presence !== 'present' ||
        result.value.object.summary.placement.kind !== 'span'
      ) {
        placeholder.status = 'missing'
        publish(placeholder)
        return
      }
      const object = result.value.object
      const loadedFields = fieldsFromObject(object)
      placeholder.object = object
      placeholder.invalidation = result.value.invalidation
      placeholder.draft = loadedFields
      placeholder.saved = loadedFields
      placeholder.status = developmentMock ? 'mock' : 'ready'
      publish(placeholder)
    })()
  }, [
    client,
    creationKey,
    developmentMock,
    publish,
    retryGeneration,
    selectedSpan,
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
    (change: Partial<SpanDraftFields>) => {
      const key = creationKey ?? selectedSpan?.id ?? null
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
    [creationKey, developmentMock, publish, selectedSpan?.id],
  )

  const startCreate = useCallback(
    (date: CivilDate) => {
      const id = client.operations.newStableId()
      const key = `new:${id}`
      const fields = newFields(date)
      const model: SpanModel = {
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
        movedRange: false,
      }
      models.current.set(key, model)
      setCreationKey(key)
      publish(model)
    },
    [client, publish],
  )

  const cancelCreate = useCallback(() => {
    if (!creationKey) return
    models.current.delete(creationKey)
    setCreationKey(null)
    publish(selectedSpan ? (models.current.get(selectedSpan.id) ?? null) : null)
  }, [creationKey, publish, selectedSpan])

  const create = useCallback(async () => {
    const key = creationKey
    const model = key ? models.current.get(key) : null
    if (!key || !model?.newObjectId) return
    const draft = structuredDraft(model.draft)
    if (!draft) return
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
    if (object.summary.placement.kind !== 'span') {
      model.status = 'failed'
      publish(model)
      return
    }
    const fields = fieldsFromObject(object)
    const persisted: SpanModel = {
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
    if (!current || current.summary.placement.kind !== 'span') return
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
    if (!current || current.summary.placement.kind !== 'span') return
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

  const convertToEvent = useCallback(
    async (date: string): Promise<boolean> => {
      const model = activeKey ? models.current.get(activeKey) : null
      if (!model?.object || model.newObjectId || !isCivilDate(date))
        return false
      await saveModel(model, true)
      if (
        model.conflict ||
        model.failure ||
        !equalFields(model.draft, model.saved)
      ) {
        publish(model)
        return false
      }
      const result = await client.structured.convertSpanToEvent({
        spanId: model.object.summary.id,
        expectedRevision: model.object.summary.revision,
        requestedStartDate: civilDate(date),
        requestedEndDate: civilDate(date),
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
      if (result.value.object.summary.id !== model.object.summary.id) {
        model.status = 'failed'
        publish(model)
        return false
      }
      models.current.delete(model.key)
      onChanged(result.value.object.summary)
      refreshObjects()
      publish(null)
      return true
    },
    [activeKey, client, onChanged, publish, refreshObjects, saveModel],
  )

  const deleteSpan = useCallback(async (): Promise<boolean> => {
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
        memberKind: 'span' as const,
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
      if (result.value.object.summary.placement.kind !== 'span') return false
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
    movedRange: displayedView?.movedRange ?? false,
    update,
    resetMarkerTitle: useCallback(
      (boundary: 'begin' | 'end') =>
        update(
          boundary === 'begin'
            ? { beginMarkerTitle: '' }
            : { endMarkerTitle: '' },
        ),
      [update],
    ),
    dismissMovedRange: useCallback(() => {
      const model = activeKey ? models.current.get(activeKey) : null
      if (!model) return
      model.movedRange = false
      publish(model)
    }, [activeKey, publish]),
    startCreate,
    cancelCreate,
    create,
    retryLoad: useCallback(() => {
      if (selectedSpan) models.current.delete(selectedSpan.id)
      publish(null)
      setRetryGeneration((value) => value + 1)
    }, [publish, selectedSpan]),
    retrySave,
    saveMine,
    useArchiveVersion,
    changeTrack,
    convertToEvent,
    deleteSpan,
    adoptMediaRevision,
  }
}
