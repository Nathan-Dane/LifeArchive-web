import { Link } from 'react-router-dom'
import type { LifeArchiveClient } from '../../core/client'
import { useTranslate } from '../../i18n'
import type { StoragePersistence } from '../../platform/storage'
import { ArchiveOverviewCards } from './archive'

export function SettingsPage({
  client,
  persistence,
}: {
  readonly client: LifeArchiveClient
  readonly persistence?: StoragePersistence
}) {
  const t = useTranslate()
  return (
    <div className="settings-page">
      <h1 className="display-large">{t('settings.page.title')}</h1>
      <ArchiveOverviewCards client={client} persistence={persistence} />
      <Link className="settings-category-row" to="/settings/archive">
        <span className="settings-category-row__icon" aria-hidden="true">
          <ArchiveIcon />
        </span>
        <span className="settings-category-row__copy">
          <strong>{t('settings.archive.manage.title')}</strong>
          <span>{t('settings.archive.manage.detail')}</span>
        </span>
        <span className="settings-category-row__chevron" aria-hidden="true">
          <svg viewBox="0 0 16 24" width="10" height="18" aria-hidden="true">
            <path
              d="m4 4 8 8-8 8"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </span>
      </Link>
    </div>
  )
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M4 7.5h16v12H4zM3 4.5h18v3H3zM9 11.5h6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}
