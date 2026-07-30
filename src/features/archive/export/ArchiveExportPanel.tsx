import { LiveStatus } from '../../../accessibility'
import type {
  ArchiveExportResult,
  LifeArchiveClient,
} from '../../../core/client'
import { failureMessage, useFormat, useLocalisation } from '../../../i18n'
import { useArchiveExport } from './exportController'

export function ArchiveExportPanel({
  client,
  compact = false,
}: {
  readonly client: LifeArchiveClient
  readonly compact?: boolean
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const { state, begin, cancel, retry, retryDelivery, reset } =
    useArchiveExport(client)
  const busy =
    state.phase === 'exporting' ||
    state.phase === 'cancelling' ||
    state.phase === 'delivering'

  return (
    <section
      className={
        compact
          ? 'archive-operation archive-operation--compact'
          : 'archive-operation'
      }
      aria-labelledby="archive-export-title"
      aria-busy={busy || undefined}
    >
      <div className="archive-operation__heading">
        <div>
          {!compact ? (
            <p className="eyebrow">{t('archive.export.eyebrow')}</p>
          ) : null}
          <h2 id="archive-export-title" className="display">
            {t(
              compact ? 'archive.export.compactTitle' : 'archive.export.title',
            )}
          </h2>
        </div>
        <p className="archive-operation__detail">
          {t(
            compact ? 'archive.export.compactDetail' : 'archive.export.detail',
          )}
        </p>
      </div>

      {state.phase === 'ready' ? (
        <Actions>
          <button
            type="button"
            className="button button--primary"
            onClick={begin}
          >
            {t('archive.export.action.export')}
          </button>
        </Actions>
      ) : null}

      {busy ? (
        <>
          <progress
            className="archive-operation__progress"
            aria-label={t('archive.export.status.progress')}
          />
          <p className="archive-operation__message">
            {t(
              state.phase === 'cancelling'
                ? 'archive.export.status.cancelling'
                : state.phase === 'delivering'
                  ? 'archive.export.status.delivering'
                  : 'archive.export.status.exporting',
            )}
          </p>
          {state.phase !== 'delivering' ? (
            <Actions>
              <button
                type="button"
                className="button"
                disabled={state.phase === 'cancelling'}
                onClick={cancel}
              >
                {t('archive.export.action.cancel')}
              </button>
            </Actions>
          ) : null}
        </>
      ) : null}

      {state.phase === 'failed' && state.failure ? (
        <>
          <h3 className="title">{t('archive.export.failed.title')}</h3>
          <p role="alert" className="archive-operation__message">
            {failureMessage(localisation, state.failure)}
          </p>
          <p className="archive-operation__message">
            {t('archive.export.failed.noOutput')}
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
            <button type="button" className="button" onClick={reset}>
              {t('archive.export.action.startOver')}
            </button>
          </Actions>
        </>
      ) : null}

      {state.phase === 'cancelled' ? (
        <>
          <h3 className="title">{t('archive.export.cancelled.title')}</h3>
          <p role="status" className="archive-operation__message">
            {t('archive.export.cancelled.detail')}
          </p>
          <Actions>
            <button type="button" className="button" onClick={reset}>
              {t('archive.export.action.startOver')}
            </button>
          </Actions>
        </>
      ) : null}

      {state.phase === 'delivery-failed' ? (
        <>
          <h3 className="title">{t('archive.export.deliveryFailed.title')}</h3>
          <p role="alert" className="archive-operation__message">
            {t('archive.export.deliveryFailed.detail')}
          </p>
          <Actions>
            <button
              type="button"
              className="button button--primary"
              onClick={retryDelivery}
            >
              {t('archive.export.action.tryDownloadAgain')}
            </button>
            <button type="button" className="button" onClick={reset}>
              {t('archive.export.action.startOver')}
            </button>
          </Actions>
        </>
      ) : null}

      {state.phase === 'complete' && state.result ? (
        <ExportResultView result={state.result} reset={reset} />
      ) : null}

      <LiveStatus>
        {state.phase === 'exporting'
          ? t('archive.export.status.exporting')
          : state.phase === 'cancelling'
            ? t('archive.export.status.cancelling')
            : state.phase === 'complete'
              ? t('archive.export.complete.announcement')
              : state.phase === 'cancelled'
                ? t('archive.export.cancelled.announcement')
                : ''}
      </LiveStatus>
    </section>
  )
}

function ExportResultView({
  result,
  reset,
}: {
  readonly result: ArchiveExportResult
  readonly reset: () => void
}) {
  const t = useLocalisation().t
  const format = useFormat()
  return (
    <div className="archive-operation__result">
      <h3 className="title">{t('archive.export.complete.title')}</h3>
      <p className="archive-operation__message">
        {t('archive.export.complete.detail', { name: result.archive.name })}
      </p>
      <dl className="archive-operation__counts">
        <Count
          label={t('archive.export.count.entries')}
          value={format.number(result.counts.entries)}
        />
        <Count
          label={t('archive.export.count.media')}
          value={format.number(result.counts.media)}
        />
        <Count
          label={t('archive.export.count.filesChecked')}
          value={format.number(result.checkedFiles)}
        />
      </dl>
      <p className="archive-operation__message">
        {t('archive.export.complete.browserDestination')}
      </p>
      <Actions>
        <button type="button" className="button" onClick={reset}>
          {t('archive.export.action.exportAnother')}
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
  return <div className="archive-operation__actions">{children}</div>
}
