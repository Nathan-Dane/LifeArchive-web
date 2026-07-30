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
import { useSharedArchiveOverview } from './archiveOverviewContext'

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
  const shared = useSharedArchiveOverview()
  return shared ? (
    <ArchiveOverviewCardsContent state={shared.state} retry={shared.retry} />
  ) : (
    <ArchiveOverviewCardsLoader client={client} persistence={persistence} />
  )
}

function ArchiveOverviewCardsLoader({
  client,
  persistence,
}: {
  readonly client: LifeArchiveClient
  readonly persistence?: StoragePersistence
}) {
  const controller = useArchiveOverview(client, persistence)
  return (
    <ArchiveOverviewCardsContent
      state={controller.state}
      retry={controller.retry}
    />
  )
}

function ArchiveOverviewCardsContent({
  state,
  retry,
}: ReturnType<typeof useArchiveOverview>) {
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

  return (
    <dl className="settings-value-list settings-overview-list">
      <div>
        <dt>{t('settings.archive.health.label')}</dt>
        <dd>{t('settings.archive.health.verified')}</dd>
      </div>
      <div>
        <dt>{t('settings.archive.entries.label')}</dt>
        <dd className="settings-counts">
          {t('settings.archive.entries.total', {
            count: overview.visibleEntryCount,
          })}
          <span>
            {[
              t('settings.archive.entries.days', {
                count: overview.entryCounts.day,
              }),
              t('settings.archive.entries.weeks', {
                count: overview.entryCounts.week,
              }),
              t('settings.archive.entries.months', {
                count: overview.entryCounts.month,
              }),
              t('settings.archive.entries.years', {
                count: overview.entryCounts.year,
              }),
              t('settings.archive.entries.events', {
                count: overview.structuredCounts.events,
              }),
              t('settings.archive.entries.spans', {
                count: overview.structuredCounts.spans,
              }),
            ].join(' · ')}
          </span>
        </dd>
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
      <UnavailableOverviewRow
        label={t('settings.archive.lastExport.label')}
        value={t('settings.archive.history.unavailable')}
      />
      <UnavailableOverviewRow
        label={t('settings.archive.lastVerification.label')}
        value={t('settings.archive.history.unavailable')}
      />
      <UnavailableOverviewRow
        label={t('settings.archive.format.label')}
        value={t('settings.status.notAvailable')}
      />
    </dl>
  )
}

function UnavailableOverviewRow({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="settings-value-list__disabled" aria-disabled="true">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
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
              label={t('settings.archive.storage.runtime.label')}
              value={
                storage.value.runtime
                  ? t(DURABILITY_MESSAGES[storage.value.runtime.durability])
                  : t('settings.archive.storage.runtime.unavailable')
              }
            />
            {storage.value.estimate ? (
              <StorageRow
                label={t('settings.archive.storage.estimate.label')}
                value={t('settings.archive.storage.estimate.value', {
                  used: format.byteSize(storage.value.estimate.usedBytes),
                  quota: format.byteSize(storage.value.estimate.quotaBytes),
                })}
              />
            ) : null}
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
