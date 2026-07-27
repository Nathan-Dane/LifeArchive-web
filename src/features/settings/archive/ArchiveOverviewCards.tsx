import type {
  ArchiveIdentityState,
  ArchiveOverview,
  LifeArchiveClient,
  PersistenceGrant,
  StorageDurability,
} from '../../../core/client'
import { archiveTitle } from '../../archive/archiveTitle'
import { useFormat, useTranslate } from '../../../i18n'
import type { StoragePersistence } from '../../../platform/storage'
import {
  useArchiveOverview,
  type ArchiveFact,
} from './archiveOverviewController'
import type { ArchiveStorageFacts } from './storageFactsAdapter'

const DURABILITY_MESSAGES = {
  durable: 'settings.archive.storage.durability.durable',
  'best-effort': 'settings.archive.storage.durability.bestEffort',
  unproven: 'settings.archive.storage.durability.unproven',
} as const satisfies Record<StorageDurability, string>

const GRANT_MESSAGES = {
  granted: 'settings.archive.storage.grant.granted',
  denied: 'settings.archive.storage.grant.denied',
  unknown: 'settings.archive.storage.grant.unknown',
  unsupported: 'settings.archive.storage.grant.unsupported',
} as const satisfies Record<PersistenceGrant, string>

export function ArchiveOverviewCards({
  client,
  persistence,
}: {
  readonly client: LifeArchiveClient
  readonly persistence?: StoragePersistence
}) {
  const { state, retry } = useArchiveOverview(client, persistence)
  return (
    <div className="settings-archive">
      <ArchiveHealthCard
        overview={state.overview}
        identity={state.identity}
        retry={retry}
      />
      <ArchiveStorageCard storage={state.storage} />
    </div>
  )
}

function ArchiveHealthCard({
  overview,
  identity,
  retry,
}: {
  readonly overview: ArchiveFact<ArchiveOverview>
  readonly identity: ArchiveFact<ArchiveIdentityState>
  readonly retry: () => void
}) {
  const t = useTranslate()
  const title =
    identity.status === 'available'
      ? archiveTitle(identity.value.identity, t)
      : t('settings.archive.title.fallback')

  return (
    <section
      className="archive-health-card"
      aria-labelledby="archive-overview-title"
      aria-busy={overview.status === 'loading' || undefined}
    >
      <header className="archive-health-card__header">
        <h2 id="archive-overview-title" className="display">
          {title}
        </h2>
        {overview.status === 'available' ? (
          <span className="archive-health-card__status">
            <CheckIcon />
            {t('settings.archive.health.healthy')}
          </span>
        ) : null}
      </header>

      {overview.status === 'loading' ? (
        <p className="archive-health-card__message">
          {t('settings.archive.overview.loading')}
        </p>
      ) : overview.status === 'unavailable' ? (
        <div className="archive-health-card__failure" role="status">
          <p>{t('settings.archive.overview.unavailable')}</p>
          <button type="button" className="button" onClick={retry}>
            {t('app.action.retry')}
          </button>
        </div>
      ) : (
        <OverviewFacts overview={overview.value} />
      )}
    </section>
  )
}

function OverviewFacts({ overview }: { readonly overview: ArchiveOverview }) {
  const t = useTranslate()
  const format = useFormat()
  const scales = [
    {
      key: 'day',
      count: overview.entryCounts.day,
      message: 'settings.archive.entries.days',
    },
    {
      key: 'week',
      count: overview.entryCounts.week,
      message: 'settings.archive.entries.weeks',
    },
    {
      key: 'month',
      count: overview.entryCounts.month,
      message: 'settings.archive.entries.months',
    },
    {
      key: 'year',
      count: overview.entryCounts.year,
      message: 'settings.archive.entries.years',
    },
  ] as const
  const visibleScales = scales.filter(({ count }) => count > 0)

  return (
    <dl className="archive-health-card__facts">
      <div>
        <dt>{t('settings.archive.health.label')}</dt>
        <dd>{t('settings.archive.health.verified')}</dd>
        <dd className="archive-health-card__secondary">
          {t('settings.archive.health.recoveryClean')}
        </dd>
      </div>
      <div>
        <dt>{t('settings.archive.entries.label')}</dt>
        <dd>
          {t('settings.archive.entries.total', {
            count: overview.visibleEntryCount,
          })}
        </dd>
        {visibleScales.length > 0 ? (
          <dd>
            <ul
              className="archive-health-card__breakdown"
              aria-label={t('settings.archive.entries.breakdown')}
            >
              {visibleScales.map(({ key, count, message }) => (
                <li key={key}>{t(message, { count })}</li>
              ))}
            </ul>
          </dd>
        ) : null}
      </div>
      <div>
        <dt>{t('settings.archive.media.label')}</dt>
        <dd>
          {t('settings.archive.media.summary', {
            count: overview.mediaCount,
            size: format.byteSize(overview.mediaByteTotal),
          })}
        </dd>
      </div>
    </dl>
  )
}

function ArchiveStorageCard({
  storage,
}: {
  readonly storage: ArchiveFact<ArchiveStorageFacts>
}) {
  const t = useTranslate()
  const format = useFormat()
  return (
    <section
      className="settings-group"
      aria-labelledby="archive-storage-title"
      aria-busy={storage.status === 'loading' || undefined}
    >
      <h2 id="archive-storage-title" className="eyebrow">
        {t('settings.archive.storage.title')}
      </h2>
      {storage.status === 'loading' ? (
        <p className="settings-group__message">
          {t('settings.archive.storage.loading')}
        </p>
      ) : storage.status === 'unavailable' ? (
        <p className="settings-group__message" role="status">
          {t('settings.archive.storage.unavailable')}
        </p>
      ) : (
        <>
          <dl className="settings-value-list">
            <StorageRow
              label={t('settings.archive.storage.persistence.label')}
              value={t(GRANT_MESSAGES[storage.value.grant])}
            />
            <StorageRow
              label={t('settings.archive.storage.estimate.label')}
              value={
                storage.value.estimate
                  ? t('settings.archive.storage.estimate.value', {
                      quota: format.byteSize(storage.value.estimate.quotaBytes),
                      used: format.byteSize(storage.value.estimate.usedBytes),
                    })
                  : t('settings.archive.storage.estimate.unavailable')
              }
            />
            <StorageRow
              label={t('settings.archive.storage.runtime.label')}
              value={
                storage.value.runtime
                  ? t(DURABILITY_MESSAGES[storage.value.runtime.durability])
                  : t('settings.archive.storage.runtime.unavailable')
              }
            />
          </dl>
          <p className="settings-group__footer">
            {storage.value.runtime?.archiveOpen
              ? t('settings.archive.storage.localOpen')
              : t('settings.archive.storage.localUnknown')}
          </p>
        </>
      )}
    </section>
  )
}

function StorageRow({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="m7.5 12 3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  )
}
