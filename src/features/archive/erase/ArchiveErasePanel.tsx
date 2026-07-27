import { useLayoutEffect, useRef } from 'react'
import { LiveStatus, useFocusTrap } from '../../../accessibility'
import type {
  ArchiveIdentityState,
  ArchiveOverview,
  ClientFailure,
  LifeArchiveClient,
} from '../../../core/client'
import {
  failureMessage,
  useFormat,
  useLocalisation,
  useTranslate,
} from '../../../i18n'
import { useArchiveErase } from './eraseController'

export function ArchiveErasePanel({
  client,
}: {
  readonly client: LifeArchiveClient
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const {
    state,
    requestConfirmation,
    cancelConfirmation,
    confirm,
    retryRefresh,
  } = useArchiveErase(client)
  const requestButton = useRef<HTMLButtonElement>(null)
  const confirmation = useRef<HTMLDialogElement>(null)
  useFocusTrap(confirmation, {
    active: state.phase === 'confirming',
    onEscape: cancelConfirmation,
    returnFocusRef: requestButton,
  })
  useLayoutEffect(() => {
    if (state.phase !== 'confirming') return
    const dialog = confirmation.current
    if (!dialog) return
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal()
    } else {
      dialog.setAttribute('open', '')
    }
    return () => {
      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close()
      } else {
        dialog.removeAttribute('open')
      }
    }
  }, [state.phase])

  const recoveryRequired =
    state.phase === 'failed' &&
    (state.failure.durableOutcome === 'unknown' ||
      state.failure.code === 'recoveryIncomplete' ||
      state.failure.cleanup === 'incomplete')

  return (
    <section
      className="archive-erase"
      aria-labelledby="archive-erase-title"
      aria-busy={
        state.phase === 'erasing' || state.phase === 'refreshing' || undefined
      }
    >
      <div className="archive-operation__heading">
        <div>
          <p className="eyebrow">{t('archive.erase.eyebrow')}</p>
          <h2 id="archive-erase-title" className="display">
            {t('archive.erase.title')}
          </h2>
        </div>
        <p className="archive-operation__detail">{t('archive.erase.detail')}</p>
      </div>

      <div
        className="archive-operation__actions"
        hidden={state.phase !== 'ready'}
      >
        <button
          ref={requestButton}
          type="button"
          className="button button--destructive"
          onClick={requestConfirmation}
        >
          {t('archive.erase.action.request')}
        </button>
      </div>

      {state.phase === 'confirming' ? (
        <dialog
          ref={confirmation}
          className="archive-erase__confirmation"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="archive-erase-confirm-title"
          aria-describedby="archive-erase-confirm-detail archive-erase-confirm-exports"
          tabIndex={-1}
          onCancel={(event) => {
            event.preventDefault()
            cancelConfirmation()
          }}
        >
          <h3 id="archive-erase-confirm-title" className="title">
            {t('archive.erase.confirm.title')}
          </h3>
          <p id="archive-erase-confirm-detail">
            {t('archive.erase.confirm.detail')}
          </p>
          <p id="archive-erase-confirm-exports">
            {t('archive.erase.exportsPreserved')}
          </p>
          <Actions>
            <button
              type="button"
              className="button"
              onClick={cancelConfirmation}
            >
              {t('archive.erase.action.cancel')}
            </button>
            <button
              type="button"
              className="button button--destructive"
              onClick={() => void confirm()}
            >
              {t('archive.erase.action.confirm')}
            </button>
          </Actions>
        </dialog>
      ) : null}

      {state.phase === 'erasing' || state.phase === 'refreshing' ? (
        <>
          <progress
            className="archive-operation__progress"
            aria-label={t('archive.erase.status.progress')}
          />
          <p className="archive-operation__message">
            {t(
              state.phase === 'erasing'
                ? 'archive.erase.status.erasing'
                : 'archive.erase.status.refreshing',
            )}
          </p>
        </>
      ) : null}

      {state.phase === 'failed' ? (
        <EraseFailure
          failure={state.failure}
          recoveryRequired={recoveryRequired}
          tryAgain={requestConfirmation}
        />
      ) : null}

      {state.phase === 'refresh-failed' ? (
        <>
          <h3 className="title">{t('archive.erase.refreshFailed.title')}</h3>
          <p role="status" className="archive-operation__message">
            {t('archive.erase.refreshFailed.detail')}
          </p>
          <p className="archive-operation__message">
            {t('archive.erase.exportsPreserved')}
          </p>
          <Actions>
            <button
              type="button"
              className="button button--primary"
              onClick={retryRefresh}
            >
              {t('archive.erase.action.checkFresh')}
            </button>
          </Actions>
        </>
      ) : null}

      {state.phase === 'complete' ? (
        <FreshArchiveView overview={state.overview} identity={state.identity} />
      ) : null}

      <LiveStatus>
        {state.phase === 'erasing'
          ? t('archive.erase.status.erasing')
          : state.phase === 'refreshing'
            ? t('archive.erase.status.refreshing')
            : state.phase === 'complete'
              ? t('archive.erase.complete.announcement')
              : ''}
      </LiveStatus>
    </section>
  )
}

function EraseFailure({
  failure,
  recoveryRequired,
  tryAgain,
}: {
  readonly failure: ClientFailure
  readonly recoveryRequired: boolean
  readonly tryAgain: () => void
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  return (
    <>
      <h3 className="title">
        {t(
          recoveryRequired
            ? 'archive.erase.recovery.title'
            : 'archive.erase.failed.title',
        )}
      </h3>
      <p role="alert" className="archive-operation__message">
        {recoveryRequired
          ? t('archive.erase.recovery.failure')
          : failureMessage(localisation, failure)}
      </p>
      <p className="archive-operation__message">
        {t(
          recoveryRequired
            ? 'archive.erase.recovery.detail'
            : 'archive.erase.failed.priorPreserved',
        )}
      </p>
      <p className="archive-operation__message">
        {t('archive.erase.exportsPreserved')}
      </p>
      <Actions>
        {recoveryRequired ? (
          <button
            type="button"
            className="button button--primary"
            onClick={() => globalThis.location.reload()}
          >
            {t('archive.erase.action.reload')}
          </button>
        ) : (
          <button type="button" className="button" onClick={tryAgain}>
            {t('archive.erase.action.tryAgain')}
          </button>
        )}
      </Actions>
    </>
  )
}

function FreshArchiveView({
  overview,
  identity,
}: {
  readonly overview: ArchiveOverview
  readonly identity: ArchiveIdentityState
}) {
  const t = useTranslate()
  const format = useFormat()
  const name =
    identity.identity.title?.trim() ||
    identity.identity.subject.displayName?.trim() ||
    identity.identity.subject.shortName?.trim() ||
    t('settings.archive.title.fallback')
  return (
    <div className="archive-operation__result">
      <h3 className="title">{t('archive.erase.complete.title')}</h3>
      <p role="status" className="archive-operation__message">
        {t('archive.erase.complete.detail', { name })}
      </p>
      <dl className="archive-operation__counts">
        <Count
          label={t('archive.erase.complete.entries')}
          value={format.number(overview.visibleEntryCount)}
        />
        <Count
          label={t('archive.erase.complete.media')}
          value={format.number(overview.mediaCount)}
        />
      </dl>
      <p className="archive-operation__message">
        {t('archive.erase.exportsPreserved')}
      </p>
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
  return <div className="archive-operation__actions">{children}</div>
}
