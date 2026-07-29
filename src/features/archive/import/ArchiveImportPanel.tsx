import { useRef, type ChangeEvent } from 'react'
import { LiveStatus } from '../../../accessibility'
import type {
  ArchiveImportIdentityOutcome,
  ArchiveImportResult,
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
import { useArchiveImport } from './importController'

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
  const { state, select, begin, cancel, retry, reset } =
    useArchiveImport(client)
  const busy = state.phase === 'importing' || state.phase === 'cancelling'

  const selected = (event: ChangeEvent<HTMLInputElement>) => {
    select(event.currentTarget.files?.[0] ?? null)
  }
  const chooseAgain = () => {
    reset()
    if (input.current) {
      input.current.value = ''
      input.current.click()
    }
  }

  return (
    <section
      className={
        compact ? 'archive-import archive-operation--compact' : 'archive-import'
      }
      aria-labelledby="archive-import-title"
      aria-busy={busy || undefined}
    >
      <div className="archive-import__heading">
        <div>
          {!compact ? (
            <p className="eyebrow">{t('archive.import.eyebrow')}</p>
          ) : null}
          <h2 id="archive-import-title" className="display">
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

      <label className="archive-import__picker">
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

      {state.phase === 'ready' && state.file ? (
        <>
          <p className="archive-import__message">
            {t('archive.import.file.selected', { name: state.file.name })}
          </p>
          <Actions>
            <button
              type="button"
              className="button button--primary"
              onClick={begin}
            >
              {t('archive.import.action.import')}
            </button>
          </Actions>
        </>
      ) : null}

      {busy ? (
        <>
          <progress
            className="archive-import__progress"
            aria-label={t('archive.import.status.progress')}
          />
          <p className="archive-import__message">
            {t(
              state.phase === 'cancelling'
                ? 'archive.import.status.cancelling'
                : 'archive.import.status.importing',
            )}
          </p>
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
        <>
          <h3 className="title">{t('archive.import.failed.title')}</h3>
          <p role="alert" className="archive-import__message">
            {failureSentence(localisation, state.failure.code, state.failure)}
          </p>
          <p className="archive-import__message">
            {t('archive.import.failed.unchanged')}
          </p>
          <Actions>
            {state.failure.retryable ? (
              <button
                type="button"
                className="button button--primary"
                onClick={retry}
              >
                {t('app.action.retry')}
              </button>
            ) : null}
            <button type="button" className="button" onClick={chooseAgain}>
              {t('archive.import.action.chooseAnother')}
            </button>
          </Actions>
        </>
      ) : null}

      {state.phase === 'complete' && state.result ? (
        <ImportResultView
          result={state.result}
          formatNumber={format.number}
          chooseAnother={chooseAgain}
        />
      ) : null}

      <LiveStatus>
        {state.phase === 'importing'
          ? t('archive.import.status.importing')
          : state.phase === 'cancelling'
            ? t('archive.import.status.cancelling')
            : state.phase === 'complete'
              ? t('archive.import.complete.announcement')
              : ''}
      </LiveStatus>
    </section>
  )
}

function ImportResultView({
  result,
  formatNumber,
  chooseAnother,
}: {
  readonly result: ArchiveImportResult
  readonly formatNumber: (value: number) => string
  readonly chooseAnother: () => void
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const noOp = !result.changed

  return (
    <div className="archive-import__result">
      <h3 className="title">
        {t(
          noOp ? 'archive.import.noOp.title' : 'archive.import.complete.title',
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
      {result.issues.length > 0 ? (
        <p className="archive-import__message">
          {t('archive.import.issues', { count: result.issues.length })}
        </p>
      ) : null}
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

function failureSentence(
  localisation: AppLocalisation,
  code: string,
  failure: Parameters<typeof failureMessage>[1],
): string {
  return code === 'differentArchive'
    ? localisation.t('archive.import.failed.differentArchive')
    : failureMessage(localisation, failure)
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
