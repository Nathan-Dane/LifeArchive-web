import { useState } from 'react'
import type { LifeArchiveClient, PersistenceGrant } from '../../../core/client'
import { useFormat, useTranslate } from '../../../i18n'
import {
  browserStoragePersistence,
  type StoragePersistence,
} from '../../../platform/storage'
import { ArchiveErasePanel } from '../../archive/erase'
import { ArchiveExportPanel } from '../../archive/export'
import { ArchiveImportPanel } from '../../archive/import'
import { ArchiveVerifyPanel } from '../../archive/verify'
import { SettingsSection } from '../SettingsControls'
import { useSharedArchiveOverview } from './archiveOverviewContext'

const GRANT_MESSAGES = {
  granted: 'settings.archive.storage.grant.granted',
  denied: 'settings.archive.storage.grant.denied',
  unknown: 'settings.archive.storage.grant.unknown',
  unsupported: 'settings.archive.storage.grant.unsupported',
} as const satisfies Record<PersistenceGrant, string>

export function ArchiveManagementPage({
  client,
  persistence = browserStoragePersistence,
}: {
  readonly client: LifeArchiveClient
  readonly persistence?: StoragePersistence
}) {
  const t = useTranslate()
  return (
    <div className="settings-page settings-page--management">
      <div className="settings-page__heading">
        <h1 className="display-large">{t('settings.archive.manage.title')}</h1>
        <p>{t('settings.archive.manage.intro')}</p>
      </div>
      <ArchiveStorageManagement persistence={persistence} />
      <section className="archive-management__section">
        <h2 className="eyebrow">
          {t('settings.archive.manage.tools.section')}
        </h2>
        <div className="archive-management__tools">
          <ArchiveExportPanel client={client} compact />
          <ArchiveVerifyPanel client={client} compact />
          <ArchiveImportPanel client={client} compact />
        </div>
      </section>
      <section className="archive-management__section archive-management__danger">
        <h2 className="eyebrow">
          {t('settings.archive.manage.danger.section')}
        </h2>
        <ArchiveErasePanel client={client} compact />
      </section>
    </div>
  )
}

function ArchiveStorageManagement({
  persistence,
}: {
  readonly persistence: StoragePersistence
}) {
  const t = useTranslate()
  const format = useFormat()
  const overview = useSharedArchiveOverview()
  const available =
    overview?.state.storage.status === 'available'
      ? overview.state.storage.value
      : null
  const archive =
    overview?.state.overview.status === 'available'
      ? overview.state.overview.value
      : null
  const [requesting, setRequesting] = useState(false)
  const [requestResult, setRequestResult] = useState<PersistenceGrant | null>(
    null,
  )
  const grant = requestResult ?? available?.grant ?? 'unknown'

  const requestPersistence = async () => {
    setRequesting(true)
    setRequestResult(await persistence.request())
    setRequesting(false)
    overview?.retry()
  }

  return (
    <>
      <SettingsSection title={t('settings.archive.manage.storage.section')}>
        <ArchiveValueRow
          label={t('settings.archive.storage.browserStatus.label')}
          value={t(
            available?.runtime?.archiveOpen
              ? 'settings.archive.storage.browserStatus.confirmed'
              : 'settings.archive.storage.browserStatus.unconfirmed',
          )}
        />
        <div className="settings-action-row">
          <div className="settings-row__copy">
            <strong>
              {t('settings.archive.storage.persistencePermission.label')}
            </strong>
            <span role="status">{t(GRANT_MESSAGES[grant])}</span>
          </div>
          <button
            type="button"
            className="button"
            disabled={
              requesting || grant === 'granted' || grant === 'unsupported'
            }
            onClick={requestPersistence}
          >
            {t(
              requesting
                ? 'settings.archive.storage.persistencePermission.requesting'
                : grant === 'granted'
                  ? 'settings.archive.storage.persistencePermission.granted'
                  : grant === 'unsupported'
                    ? 'settings.archive.storage.persistencePermission.unsupported'
                    : 'settings.archive.storage.persistencePermission.action',
            )}
          </button>
        </div>
        <ArchiveValueRow
          label={t('settings.archive.storage.entries.label')}
          value={t('settings.status.notAvailable')}
          disabled
        />
        <ArchiveValueRow
          label={t('settings.archive.storage.media.label')}
          value={
            archive
              ? format.byteSize(archive.mediaByteTotal)
              : t('settings.archive.storage.unavailableValue')
          }
        />
        <ArchiveValueRow
          label={t('settings.archive.storage.total.label')}
          value={t('settings.status.notAvailable')}
          disabled
        />
      </SettingsSection>
      <SettingsSection title={t('settings.archive.history.section')}>
        <ArchiveValueRow
          label={t('settings.archive.lastExport.label')}
          value={t('settings.archive.history.unavailable')}
          disabled
        />
        <ArchiveValueRow
          label={t('settings.archive.lastImport.label')}
          value={t('settings.archive.history.unavailable')}
          disabled
        />
        <ArchiveValueRow
          label={t('settings.archive.lastVerification.label')}
          value={t('settings.archive.history.unavailable')}
          disabled
        />
      </SettingsSection>
    </>
  )
}

function ArchiveValueRow({
  label,
  value,
  disabled = false,
}: {
  readonly label: string
  readonly value: string
  readonly disabled?: boolean
}) {
  return (
    <div
      className="settings-row settings-row--value"
      data-disabled={disabled || undefined}
      aria-disabled={disabled || undefined}
    >
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  )
}
