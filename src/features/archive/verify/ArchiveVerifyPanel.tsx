import { useRef, type ChangeEvent } from 'react'
import { LiveStatus } from '../../../accessibility'
import type { LifeArchiveClient } from '../../../core/client'
import { failureMessage, useFormat, useLocalisation } from '../../../i18n'
import {
  ARCHIVE_TRANSPORT_EXTENSION,
  ARCHIVE_TRANSPORT_MIME_TYPE,
  type ArchiveTransportFailure,
} from '../../../platform/files/archiveTransfer'
import { useArchiveVerify } from './verifyController'

export function ArchiveVerifyPanel({
  client,
}: {
  readonly client: LifeArchiveClient
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const format = useFormat()
  const input = useRef<HTMLInputElement>(null)
  const { state, select, begin, retry, reset } = useArchiveVerify(client)
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
      className="archive-operation"
      aria-labelledby="archive-verify-title"
      aria-busy={state.phase === 'verifying' || undefined}
    >
      <div className="archive-operation__heading">
        <div>
          <p className="eyebrow">{t('archive.verify.eyebrow')}</p>
          <h2 id="archive-verify-title" className="display">
            {t('archive.verify.title')}
          </h2>
        </div>
        <p className="archive-operation__detail">
          {t('archive.verify.detail')}
        </p>
      </div>

      <label className="archive-operation__picker">
        <span>{t('archive.verify.file.label')}</span>
        <input
          ref={input}
          type="file"
          accept={`${ARCHIVE_TRANSPORT_EXTENSION},${ARCHIVE_TRANSPORT_MIME_TYPE},application/octet-stream`}
          disabled={state.phase === 'verifying'}
          onChange={selected}
        />
      </label>

      {state.selectionFailure ? (
        <p role="alert" className="archive-operation__message">
          {t(selectionFailureMessage(state.selectionFailure))}
        </p>
      ) : null}

      {state.phase === 'ready' && state.file ? (
        <>
          <p className="archive-operation__message">
            {t('archive.verify.file.selected', { name: state.file.name })}
          </p>
          <Actions>
            <button
              type="button"
              className="button button--primary"
              onClick={begin}
            >
              {t('archive.verify.action.verify')}
            </button>
          </Actions>
        </>
      ) : null}

      {state.phase === 'verifying' ? (
        <>
          <progress
            className="archive-operation__progress"
            aria-label={t('archive.verify.status.progress')}
          />
          <p className="archive-operation__message">
            {t('archive.verify.status.verifying')}
          </p>
        </>
      ) : null}

      {state.phase === 'failed' && state.failure ? (
        <>
          <h3 className="title">{t('archive.verify.failed.title')}</h3>
          <p role="alert" className="archive-operation__message">
            {state.failure.code === 'newerArchiveVersion'
              ? t('archive.verify.failed.newer')
              : failureMessage(localisation, state.failure)}
          </p>
          <p className="archive-operation__message">
            {t('archive.verify.readOnly')}
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
              {t('archive.verify.action.chooseAnother')}
            </button>
          </Actions>
        </>
      ) : null}

      {state.phase === 'complete' && state.result ? (
        <div className="archive-operation__result">
          <h3 className="title">
            {t(
              state.result.valid
                ? 'archive.verify.valid.title'
                : 'archive.verify.invalid.title',
            )}
          </h3>
          <p
            role={state.result.valid ? 'status' : 'alert'}
            className="archive-operation__message"
          >
            {t(
              state.result.valid
                ? 'archive.verify.valid.detail'
                : 'archive.verify.invalid.detail',
              state.result.valid
                ? { count: state.result.checkedFiles }
                : { count: state.result.issues.length },
            )}
          </p>
          <p className="archive-operation__message">
            {t('archive.verify.readOnly')}
          </p>
          <Actions>
            <button type="button" className="button" onClick={chooseAgain}>
              {t('archive.verify.action.chooseAnother')}
            </button>
          </Actions>
        </div>
      ) : null}

      <LiveStatus>
        {state.phase === 'verifying'
          ? t('archive.verify.status.verifying')
          : state.phase === 'complete' && state.result?.valid
            ? t('archive.verify.valid.announcement', {
                count: format.number(state.result.checkedFiles),
              })
            : ''}
      </LiveStatus>
    </section>
  )
}

function selectionFailureMessage(failure: ArchiveTransportFailure) {
  return {
    'invalid-extension': 'archive.verify.file.invalidExtension',
    'invalid-mime': 'archive.verify.file.invalidType',
    'empty-file': 'archive.verify.file.empty',
  }[failure] as
    | 'archive.verify.file.invalidExtension'
    | 'archive.verify.file.invalidType'
    | 'archive.verify.file.empty'
}

function Actions({ children }: { readonly children: React.ReactNode }) {
  return <div className="archive-operation__actions">{children}</div>
}
