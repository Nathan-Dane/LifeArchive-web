import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ArchiveImportInspection,
  ArchiveImportResult,
  ArchiveImportResolutionSelection,
  ClientFailure,
  LifeArchiveClient,
  OperationId,
} from '../../../core/client'
import {
  selectArchiveTransport,
  type ArchiveTransportFailure,
} from '../../../platform/files/archiveTransfer'

export type ImportPhase =
  | 'selecting'
  | 'inspecting'
  | 'reviewing'
  | 'applying'
  | 'cancelling'
  | 'complete'
  | 'failed'

export type ImportFailureStage = 'inspection' | 'application'

export interface ArchiveImportState {
  readonly phase: ImportPhase
  readonly file: File | null
  readonly selectionFailure: ArchiveTransportFailure | null
  readonly failure: ClientFailure | null
  readonly failureStage: ImportFailureStage | null
  readonly inspection: ArchiveImportInspection | null
  readonly selections: Readonly<Record<string, string>>
  readonly result: ArchiveImportResult | null
}

export interface ArchiveImportController {
  readonly state: ArchiveImportState
  readonly unresolvedIssueIds: readonly string[]
  readonly canApply: boolean
  readonly select: (file: File | null) => void
  readonly selectResolution: (issueId: string, optionId: string) => void
  readonly apply: () => void
  readonly cancel: () => void
  readonly retry: () => void
  readonly reset: () => void
}

const INITIAL_STATE: ArchiveImportState = {
  phase: 'selecting',
  file: null,
  selectionFailure: null,
  failure: null,
  failureStage: null,
  inspection: null,
  selections: {},
  result: null,
}

/**
 * Coordinates one inspect → resolve → apply workflow over an opaque package.
 * It never opens the package, interprets an issue, chooses a resolution, or
 * decides whether applying is safe: those answers come from the core plan.
 */
export function useArchiveImport(
  client: LifeArchiveClient,
): ArchiveImportController {
  const [state, setState] = useState<ArchiveImportState>(INITIAL_STATE)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  const operation = useRef<OperationId | null>(null)
  const running = useRef(false)

  const inspect = useCallback(
    async (file: File): Promise<void> => {
      if (running.current) return
      running.current = true
      setState({
        phase: 'inspecting',
        file,
        selectionFailure: null,
        failure: null,
        failureStage: null,
        inspection: null,
        selections: {},
        result: null,
      })
      try {
        const result = await client.archive.inspectImport({ archive: file })
        setState(
          result.status === 'ok'
            ? {
                phase: 'reviewing',
                file,
                selectionFailure: null,
                failure: null,
                failureStage: null,
                inspection: result.value,
                selections: {},
                result: null,
              }
            : {
                phase: 'failed',
                file,
                selectionFailure: null,
                failure: result.failure,
                failureStage: 'inspection',
                inspection: null,
                selections: {},
                result: null,
              },
        )
      } finally {
        running.current = false
      }
    },
    [client],
  )

  const select = useCallback(
    (file: File | null) => {
      if (running.current) return
      if (!file) {
        setState(INITIAL_STATE)
        return
      }
      const selected = selectArchiveTransport(file)
      if (selected.outcome === 'rejected') {
        setState({
          ...INITIAL_STATE,
          selectionFailure: selected.failure,
        })
        return
      }
      void inspect(selected.file)
    },
    [inspect],
  )

  const selectResolution = useCallback((issueId: string, optionId: string) => {
    if (running.current || stateRef.current.phase !== 'reviewing') return
    const issue = stateRef.current.inspection?.issues.find(
      (candidate) => candidate.issueId === issueId,
    )
    if (!issue?.allowedResolutions.includes(optionId)) return
    setState((current) => ({
      ...current,
      selections: { ...current.selections, [issueId]: optionId },
    }))
  }, [])

  const runApply = useCallback(async (): Promise<void> => {
    const current = stateRef.current
    const inspection = current.inspection
    const file = current.file
    if (
      running.current ||
      !file ||
      !inspection?.planId ||
      inspection.outcome === 'blocked'
    ) {
      return
    }
    const requiredIssues =
      inspection.outcome === 'needsResolution'
        ? inspection.issues.filter(
            (issue) => issue.disposition === 'requiresDecision',
          )
        : []
    if (
      inspection.outcome === 'needsResolution' &&
      (requiredIssues.length === 0 ||
        requiredIssues.some((issue) => !current.selections[issue.issueId]))
    ) {
      return
    }

    const selections: ArchiveImportResolutionSelection[] = requiredIssues.map(
      (issue) => ({
        issueId: issue.issueId,
        optionId: current.selections[issue.issueId] as string,
      }),
    )
    running.current = true
    const operationId = client.operations.newOperationId()
    operation.current = operationId
    setState((prior) => ({
      ...prior,
      phase: 'applying',
      failure: null,
      failureStage: null,
      result: null,
    }))
    try {
      const result = await client.archive.import({
        operationId,
        archive: file,
        expectedPlanId: inspection.planId,
        resolutions: { selections },
      })
      setState((prior) =>
        result.status === 'ok'
          ? {
              ...prior,
              phase: 'complete',
              failure: null,
              failureStage: null,
              result: result.value,
            }
          : {
              ...prior,
              phase: 'failed',
              failure: result.failure,
              failureStage: 'application',
              result: null,
            },
      )
    } finally {
      operation.current = null
      running.current = false
    }
  }, [client])

  const apply = useCallback(() => {
    void runApply()
  }, [runApply])

  const cancel = useCallback(() => {
    const operationId = operation.current
    if (!operationId || stateRef.current.phase !== 'applying') return
    setState((current) => ({ ...current, phase: 'cancelling' }))
    void client.operations.requestCancel(operationId)
  }, [client])

  const retry = useCallback(() => {
    const current = stateRef.current
    if (!current.file || current.failure?.durableOutcome === 'unknown') return
    if (current.failureStage === 'inspection') {
      void inspect(current.file)
    } else if (current.failureStage === 'application') {
      void runApply()
    }
  }, [inspect, runApply])

  const reset = useCallback(() => {
    if (!running.current) setState(INITIAL_STATE)
  }, [])

  const unresolvedIssueIds = useMemo(() => {
    const inspection = state.inspection
    if (!inspection || inspection.outcome !== 'needsResolution') return []
    return inspection.issues
      .filter(
        (issue) =>
          issue.disposition === 'requiresDecision' &&
          (issue.allowedResolutions.length === 0 ||
            !state.selections[issue.issueId]),
      )
      .map((issue) => issue.issueId)
  }, [state.inspection, state.selections])

  const canApply = Boolean(
    state.phase === 'reviewing' &&
    state.inspection?.planId &&
    state.inspection.outcome !== 'blocked' &&
    (state.inspection.outcome === 'ready' || unresolvedIssueIds.length === 0),
  )

  return {
    state,
    unresolvedIssueIds,
    canApply,
    select,
    selectResolution,
    apply,
    cancel,
    retry,
    reset,
  }
}
