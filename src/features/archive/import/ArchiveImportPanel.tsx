import { useEffect, useId, useRef, type ChangeEvent } from 'react'
import { LiveStatus } from '../../../accessibility'
import type {
  ArchiveImportIdentityOutcome,
  ArchiveImportInspection,
  ArchiveImportInspectionContext,
  ArchiveImportInspectionCounts,
  ArchiveImportInspectionIssue,
  ArchiveImportIssue,
  ArchiveImportResult,
  ClientFailure,
  LifeArchiveClient,
} from '../../../core/client'
import {
  failureMessage,
  useFormat,
  useLocalisation,
  type AppLocalisation,
} from '../../../i18n'
import {
  ARCHIVE_TRANSPORT_EXTENSION,
  ARCHIVE_TRANSPORT_MIME_TYPE,
  type ArchiveTransportFailure,
} from '../../../platform/files/archiveTransfer'
import { useArchiveImport, type ImportPhase } from './importController'

export function ArchiveImportPanel({
  client,
  compact = false,
}: {
  readonly client: LifeArchiveClient
  readonly compact?: boolean
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const format = useFormat()
  const input = useRef<HTMLInputElement>(null)
  const stageHeading = useRef<HTMLHeadingElement>(null)
  const titleId = useId()
  const {
    state,
    canApply,
    select,
    selectResolution,
    apply,
    cancel,
    retry,
    reset,
  } = useArchiveImport(client)
  const busy =
    state.phase === 'inspecting' ||
    state.phase === 'applying' ||
    state.phase === 'cancelling'

  useEffect(() => {
    if (
      state.phase === 'reviewing' ||
      state.phase === 'complete' ||
      state.phase === 'failed'
    ) {
      stageHeading.current?.focus()
    }
  }, [state.phase])

  const selected = (event: ChangeEvent<HTMLInputElement>) => {
    select(event.currentTarget.files?.[0] ?? null)
  }
  const chooseAgain = () => {
    reset()
    if (input.current) {
      input.current.value = ''
      queueMicrotask(() => input.current?.click())
    }
  }

  return (
    <section
      className={
        compact ? 'archive-import archive-operation--compact' : 'archive-import'
      }
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      data-phase={state.phase}
    >
      <div className="archive-import__heading">
        <div>
          {!compact ? (
            <p className="eyebrow">{t('archive.import.eyebrow')}</p>
          ) : null}
          <h2 id={titleId} className="display">
            {t(
              compact ? 'archive.import.compactTitle' : 'archive.import.title',
            )}
          </h2>
        </div>
        <p className="archive-import__detail">
          {t(
            compact ? 'archive.import.compactDetail' : 'archive.import.detail',
          )}
        </p>
      </div>

      <ImportSteps phase={state.phase} failureStage={state.failureStage} />

      <label
        className="archive-import__picker"
        hidden={state.file !== null && state.phase !== 'selecting'}
      >
        <span>{t('archive.import.file.label')}</span>
        <input
          ref={input}
          type="file"
          accept={`${ARCHIVE_TRANSPORT_EXTENSION},${ARCHIVE_TRANSPORT_MIME_TYPE},application/octet-stream`}
          disabled={busy}
          onChange={selected}
        />
      </label>

      {state.selectionFailure ? (
        <p role="alert" className="archive-import__message">
          {t(selectionFailureMessage(state.selectionFailure))}
        </p>
      ) : null}

      {state.file && state.phase !== 'selecting' ? (
        <div
          className="archive-import__file"
          aria-label={t('archive.import.file.summary')}
        >
          <strong>{state.file.name}</strong>
          <span>{format.byteSize(state.file.size)}</span>
        </div>
      ) : null}

      {state.phase === 'inspecting' ? (
        <BusyState
          message={t('archive.import.status.inspecting')}
          progressLabel={t('archive.import.status.inspectionProgress')}
        />
      ) : null}

      {state.phase === 'reviewing' && state.inspection ? (
        <InspectionView
          headingRef={stageHeading}
          inspection={state.inspection}
          selections={state.selections}
          canApply={canApply}
          selectResolution={selectResolution}
          apply={apply}
          chooseAnother={chooseAgain}
        />
      ) : null}

      {state.phase === 'applying' || state.phase === 'cancelling' ? (
        <>
          <BusyState
            message={t(
              state.phase === 'cancelling'
                ? 'archive.import.status.cancelling'
                : 'archive.import.status.applying',
            )}
            progressLabel={t('archive.import.status.applyProgress')}
          />
          <Actions>
            <button
              type="button"
              className="button"
              disabled={state.phase === 'cancelling'}
              onClick={cancel}
            >
              {t('archive.import.action.cancel')}
            </button>
          </Actions>
        </>
      ) : null}

      {state.phase === 'failed' && state.failure ? (
        <FailureView
          headingRef={stageHeading}
          failure={state.failure}
          inspectionFailed={state.failureStage === 'inspection'}
          retry={retry}
          chooseAnother={chooseAgain}
        />
      ) : null}

      {state.phase === 'complete' && state.result ? (
        <ImportResultView
          headingRef={stageHeading}
          result={state.result}
          formatNumber={format.number}
          chooseAnother={chooseAgain}
        />
      ) : null}

      <LiveStatus>{liveMessage(localisation, state.phase)}</LiveStatus>
    </section>
  )
}

function ImportSteps({
  phase,
  failureStage,
}: {
  readonly phase: ImportPhase
  readonly failureStage: 'inspection' | 'application' | null
}) {
  const t = useLocalisation().t
  const current =
    phase === 'reviewing'
      ? 2
      : phase === 'applying' ||
          phase === 'cancelling' ||
          phase === 'complete' ||
          (phase === 'failed' && failureStage === 'application')
        ? 3
        : 1
  return (
    <ol
      className="archive-import__steps"
      aria-label={t('archive.import.steps.label')}
    >
      {[
        t('archive.import.steps.choose'),
        t('archive.import.steps.review'),
        t('archive.import.steps.apply'),
      ].map((label, index) => {
        const step = index + 1
        return (
          <li key={label} aria-current={step === current ? 'step' : undefined}>
            <span aria-hidden="true">{step}</span>
            {label}
          </li>
        )
      })}
    </ol>
  )
}

function BusyState({
  message,
  progressLabel,
}: {
  readonly message: string
  readonly progressLabel: string
}) {
  return (
    <div className="archive-import__busy">
      <progress
        className="archive-import__progress"
        aria-label={progressLabel}
      />
      <p className="archive-import__message">{message}</p>
    </div>
  )
}

function InspectionView({
  headingRef,
  inspection,
  selections,
  canApply,
  selectResolution,
  apply,
  chooseAnother,
}: {
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>
  readonly inspection: ArchiveImportInspection
  readonly selections: Readonly<Record<string, string>>
  readonly canApply: boolean
  readonly selectResolution: (issueId: string, optionId: string) => void
  readonly apply: () => void
  readonly chooseAnother: () => void
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const format = useFormat()
  const blocked = inspection.outcome === 'blocked'
  const needsResolution = inspection.outcome === 'needsResolution'

  return (
    <div className="archive-import__review">
      <header
        className="archive-import__verdict"
        data-outcome={inspection.outcome}
      >
        <span className="archive-import__verdict-icon" aria-hidden="true">
          {blocked ? '×' : needsResolution ? '!' : '✓'}
        </span>
        <div>
          <h3 ref={headingRef} className="title" tabIndex={-1}>
            {t(
              blocked
                ? 'archive.import.review.blocked.title'
                : needsResolution
                  ? 'archive.import.review.needsResolution.title'
                  : 'archive.import.review.ready.title',
            )}
          </h3>
          <p>
            {blocked
              ? t('archive.import.review.blocked.detail')
              : needsResolution
                ? t('archive.import.review.needsResolution.detail')
                : t('archive.import.review.ready.detail')}
          </p>
        </div>
      </header>

      {inspection.source ? (
        <div className="archive-import__source">
          <span className="eyebrow">{t('archive.import.source.label')}</span>
          <strong>
            {inspection.source.archiveName ??
              inspection.source.subjectName ??
              t('archive.import.source.unnamed')}
          </strong>
          {inspection.source.subjectName && inspection.source.archiveName ? (
            <span>{inspection.source.subjectName}</span>
          ) : null}
          <span>
            {t('archive.import.source.format', {
              version: inspection.source.formatVersion,
            })}
          </span>
        </div>
      ) : null}

      <dl className="archive-import__inspection-counts">
        <InspectionCount
          label={t('archive.import.review.count.entries')}
          counts={inspection.counts.entries}
          formatNumber={format.number}
        />
        <InspectionCount
          label={t('archive.import.review.count.media')}
          counts={inspection.counts.media}
          formatNumber={format.number}
        />
        <InspectionCount
          label={t('archive.import.review.count.tracks')}
          counts={inspection.counts.tracks}
          formatNumber={format.number}
        />
      </dl>

      {inspection.issues.length > 0 ? (
        <div className="archive-import__issues">
          <h4 className="title">{t('archive.import.review.issues.title')}</h4>
          <div className="archive-import__issue-list">
            {inspection.issues.map((issue) => (
              <InspectionIssue
                key={issue.issueId}
                issue={issue}
                context={inspection.context}
                selected={selections[issue.issueId] ?? null}
                onSelect={(optionId) =>
                  selectResolution(issue.issueId, optionId)
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      <Actions>
        <button
          type="button"
          className="button button--primary"
          disabled={!canApply}
          onClick={apply}
        >
          {t('archive.import.action.applyReviewed')}
        </button>
        <button type="button" className="button" onClick={chooseAnother}>
          {t('archive.import.action.chooseAnother')}
        </button>
      </Actions>
    </div>
  )
}

function InspectionCount({
  label,
  counts,
  formatNumber,
}: {
  readonly label: string
  readonly counts: ArchiveImportInspectionCounts
  readonly formatNumber: (value: number) => string
}) {
  const t = useLocalisation().t
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <strong className="title">{formatNumber(counts.importable)}</strong>
        <span>
          {t('archive.import.review.count.ofTotal', {
            total: counts.total,
          })}
        </span>
        {counts.alreadyPresent > 0 ? (
          <span>
            {t('archive.import.review.count.alreadyPresent', {
              count: counts.alreadyPresent,
            })}
          </span>
        ) : null}
        {counts.needsDecision > 0 ? (
          <span>
            {t('archive.import.review.count.needsDecision', {
              count: counts.needsDecision,
            })}
          </span>
        ) : null}
      </dd>
    </div>
  )
}

function InspectionIssue({
  issue,
  context,
  selected,
  onSelect,
}: {
  readonly issue: ArchiveImportInspectionIssue
  readonly context: ArchiveImportInspectionContext
  readonly selected: string | null
  readonly onSelect: (optionId: string) => void
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const title = issueTitle(localisation, issue)
  const detail = issueMessage(localisation, issue, context)
  return (
    <article className="archive-import__issue" data-severity={issue.severity}>
      <header>
        <span className="archive-import__issue-mark" aria-hidden="true" />
        <div>
          <h5>{title}</h5>
          <p>{detail}</p>
        </div>
      </header>
      {issue.allowedResolutions.length > 0 ? (
        <fieldset>
          <legend>{t('archive.import.resolution.legend')}</legend>
          {issue.allowedResolutions.map((optionId, index) => (
            <label key={optionId}>
              <input
                type="radio"
                name={`archive-import-resolution-${issue.issueId}`}
                value={optionId}
                checked={selected === optionId}
                onChange={() => onSelect(optionId)}
              />
              <span>{resolutionLabel(localisation, optionId, index)}</span>
            </label>
          ))}
        </fieldset>
      ) : issue.disposition !== 'automatic' ? (
        <p className="archive-import__issue-blocked">
          {t('archive.import.resolution.unavailable')}
        </p>
      ) : (
        <p>{t('archive.import.resolution.automatic')}</p>
      )}
      {issue.causeCode ||
      issue.path ||
      issue.field ||
      issue.line !== null ||
      issue.id ? (
        <details>
          <summary>{t('archive.import.issue.details')}</summary>
          <dl>
            {issue.line !== null ? (
              <div>
                <dt>{t('archive.import.issue.line')}</dt>
                <dd>{issue.line}</dd>
              </div>
            ) : null}
            {issue.path ? (
              <div>
                <dt>{t('archive.import.issue.path')}</dt>
                <dd>{issue.path}</dd>
              </div>
            ) : null}
            {issue.field ? (
              <div>
                <dt>{t('archive.import.issue.field')}</dt>
                <dd>{issue.field}</dd>
              </div>
            ) : null}
            {issue.causeCode ? (
              <div>
                <dt>{t('archive.import.issue.reference')}</dt>
                <dd>{issue.causeCode}</dd>
              </div>
            ) : null}
            {issue.id ? (
              <div>
                <dt>{t('archive.import.issue.itemId')}</dt>
                <dd>{issue.id}</dd>
              </div>
            ) : null}
          </dl>
        </details>
      ) : null}
    </article>
  )
}

function FailureView({
  headingRef,
  failure,
  inspectionFailed,
  retry,
  chooseAnother,
}: {
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>
  readonly failure: ClientFailure
  readonly inspectionFailed: boolean
  readonly retry: () => void
  readonly chooseAnother: () => void
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const unknown = failure.durableOutcome === 'unknown'
  return (
    <div className="archive-import__failure">
      <h3 ref={headingRef} className="title" tabIndex={-1}>
        {t(
          unknown
            ? 'archive.import.failed.unknownTitle'
            : inspectionFailed
              ? 'archive.import.failed.inspectionTitle'
              : 'archive.import.failed.title',
        )}
      </h3>
      <p role="alert" className="archive-import__message">
        {failureMessage(localisation, failure)}
      </p>
      <p className="archive-import__message">
        {t(
          unknown
            ? 'archive.import.failed.unknownOutcome'
            : inspectionFailed
              ? 'archive.import.failed.inspectionReadOnly'
              : 'archive.import.failed.unchanged',
        )}
      </p>
      {!unknown ? (
        <Actions>
          {failure.retryable ? (
            <button
              type="button"
              className="button button--primary"
              onClick={retry}
            >
              {t('app.action.retry')}
            </button>
          ) : null}
          <button type="button" className="button" onClick={chooseAnother}>
            {t('archive.import.action.chooseAnother')}
          </button>
        </Actions>
      ) : null}
    </div>
  )
}

function ImportResultView({
  headingRef,
  result,
  formatNumber,
  chooseAnother,
}: {
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>
  readonly result: ArchiveImportResult
  readonly formatNumber: (value: number) => string
  readonly chooseAnother: () => void
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const noOp = !result.changed
  const withIssues = result.issues.length > 0

  return (
    <div className="archive-import__result">
      <h3 ref={headingRef} className="title" tabIndex={-1}>
        {t(
          noOp
            ? 'archive.import.noOp.title'
            : withIssues
              ? 'archive.import.completeWithIssues.title'
              : 'archive.import.complete.title',
        )}
      </h3>
      {noOp ? (
        <p className="archive-import__message">
          {t('archive.import.noOp.detail')}
        </p>
      ) : null}
      <dl className="archive-import__counts">
        <Count
          label={t('archive.import.count.importedEntries')}
          value={formatNumber(result.importedEntries)}
        />
        <Count
          label={t('archive.import.count.importedMedia')}
          value={formatNumber(result.importedMedia)}
        />
        <Count
          label={t('archive.import.count.importedTracks')}
          value={formatNumber(result.importedTracks)}
        />
        <Count
          label={t('archive.import.count.skippedEntries')}
          value={formatNumber(result.skippedEntries)}
        />
        <Count
          label={t('archive.import.count.skippedMedia')}
          value={formatNumber(result.skippedMedia)}
        />
        <Count
          label={t('archive.import.count.skippedTracks')}
          value={formatNumber(result.skippedTracks)}
        />
      </dl>
      {withIssues ? <ImportReportIssues issues={result.issues} /> : null}
      {result.recovery === 'pending' ? (
        <p className="archive-import__message">
          {t('archive.import.recovery.pending')}
        </p>
      ) : null}
      <p className="archive-import__message">
        {identityMessage(localisation, result.identity)}
      </p>
      <Actions>
        <button type="button" className="button" onClick={chooseAnother}>
          {t('archive.import.action.chooseAnother')}
        </button>
      </Actions>
    </div>
  )
}

function ImportReportIssues({
  issues,
}: {
  readonly issues: readonly ArchiveImportIssue[]
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  return (
    <details className="archive-import__report-issues">
      <summary>
        {t('archive.import.report.issues', { count: issues.length })}
      </summary>
      <ul>
        {issues.map((issue, index) => (
          <li key={`${issue.code}:${issue.id ?? index}`}>
            <strong>
              {issue.path ??
                issue.field ??
                recordKindLabel(localisation, issue.recordKind)}
            </strong>
            <span>{resultIssueMessage(localisation, issue)}</span>
            {issue.line !== null && issue.line !== undefined ? (
              <span>
                {t('archive.import.report.line', { line: issue.line })}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  )
}

function Count({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="title">{value}</dd>
    </div>
  )
}

function Actions({ children }: { readonly children: React.ReactNode }) {
  return <div className="archive-import__actions">{children}</div>
}

function selectionFailureMessage(failure: ArchiveTransportFailure) {
  return {
    'invalid-extension': 'archive.import.file.invalidExtension',
    'invalid-mime': 'archive.import.file.invalidType',
    'empty-file': 'archive.import.file.empty',
  }[failure] as
    | 'archive.import.file.invalidExtension'
    | 'archive.import.file.invalidType'
    | 'archive.import.file.empty'
}

function liveMessage(
  localisation: AppLocalisation,
  phase: ImportPhase,
): string {
  const t = localisation.t
  switch (phase) {
    case 'inspecting':
      return t('archive.import.status.inspecting')
    case 'reviewing':
      return t('archive.import.status.reviewReady')
    case 'applying':
      return t('archive.import.status.applying')
    case 'cancelling':
      return t('archive.import.status.cancelling')
    case 'complete':
      return t('archive.import.complete.announcement')
    default:
      return ''
  }
}

function issueMessage(
  localisation: AppLocalisation,
  issue: ArchiveImportInspectionIssue,
  context: ArchiveImportInspectionContext,
): string {
  if (issue.causeCode === 'unsupportedVersion') {
    return formatCompatibilityMessage(localisation, context)
  }
  if (issue.code === 'differentArchive') {
    return identityMismatchMessage(localisation, context)
  }
  return (
    localisation.resolve(`archive.import.issue.${issue.code}`) ??
    (issue.causeCode
      ? localisation.resolve(`archive.import.issue.${issue.causeCode}`)
      : null) ??
    localisation.resolve(`archive.import.issue.category.${issue.category}`) ??
    localisation.t('archive.import.issue.unknown')
  )
}

function formatCompatibilityMessage(
  localisation: AppLocalisation,
  context: ArchiveImportInspectionContext,
): string {
  const values = {
    archiveVersion:
      context.archiveFormatVersion ??
      localisation.t('archive.import.version.unknown'),
    supportedVersion: context.supportedFormatVersion,
  }
  switch (context.formatRelation) {
    case 'older':
      return localisation.t('archive.import.version.older', values)
    case 'newer':
      return localisation.t('archive.import.version.newer', values)
    default:
      return localisation.t('archive.import.version.unsupported', values)
  }
}

function identityMismatchMessage(
  localisation: AppLocalisation,
  context: ArchiveImportInspectionContext,
): string {
  const source = context.sourceSubjectName
  const destination = context.destinationSubjectName
  if (source && destination) {
    return localisation.t('archive.import.identity.differentBoth', {
      source,
      destination,
    })
  }
  if (source) {
    return localisation.t('archive.import.identity.differentSource', {
      source,
    })
  }
  if (destination) {
    return localisation.t('archive.import.identity.differentDestination', {
      destination,
    })
  }
  return localisation.t('archive.import.issue.differentArchive')
}

function issueTitle(
  localisation: AppLocalisation,
  issue: ArchiveImportInspectionIssue,
): string {
  return (
    localisation.resolve(`archive.import.issueTitle.${issue.code}`) ??
    (issue.causeCode
      ? localisation.resolve(`archive.import.issueTitle.${issue.causeCode}`)
      : null) ??
    recordKindLabel(localisation, issue.recordKind)
  )
}

function resultIssueMessage(
  localisation: AppLocalisation,
  issue: ArchiveImportIssue,
): string {
  return (
    localisation.resolve(`archive.import.issue.${issue.code}`) ??
    localisation.t('archive.import.issue.reportUnknown')
  )
}

function resolutionLabel(
  localisation: AppLocalisation,
  optionId: string,
  index: number,
): string {
  return (
    localisation.resolve(`archive.import.resolution.${optionId}`) ??
    localisation.t('archive.import.resolution.unknown', {
      number: index + 1,
    })
  )
}

function recordKindLabel(
  localisation: AppLocalisation,
  recordKind: string | null,
): string {
  return (
    (recordKind
      ? localisation.resolve(`archive.import.recordKind.${recordKind}`)
      : null) ?? localisation.t('archive.import.recordKind.package')
  )
}

function identityMessage(
  localisation: AppLocalisation,
  identity: ArchiveImportIdentityOutcome,
): string {
  const t = localisation.t
  switch (identity.outcome) {
    case 'preserved':
      return t('archive.import.identity.preserved')
    case 'adopted':
      return t('archive.import.identity.adopted')
    case 'matched':
      return t('archive.import.identity.matched')
    case 'merged':
      return identity.filledFields.length > 0 &&
        identity.conflictingFields.length > 0
        ? t('archive.import.identity.conflicts', {
            count: identity.conflictingFields.length,
          })
        : identity.filledFields.length > 0
          ? t('archive.import.identity.filled')
          : t('archive.import.identity.conflictsOnly', {
              count: identity.conflictingFields.length,
            })
  }
}
