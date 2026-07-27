import { Link } from 'react-router-dom'
import type { LifeArchiveClient } from '../../../core/client'
import { useTranslate } from '../../../i18n'
import { ArchiveExportPanel } from '../../archive/export'
import { ArchiveImportPanel } from '../../archive/import'
import { ArchiveVerifyPanel } from '../../archive/verify'

export function ArchiveManagementPage({
  client,
}: {
  readonly client: LifeArchiveClient
}) {
  const t = useTranslate()
  return (
    <div className="settings-page settings-page--management">
      <Link className="settings-back-link" to="/settings">
        {t('settings.archive.manage.back')}
      </Link>
      <div className="settings-page__heading">
        <p className="eyebrow">{t('settings.page.title')}</p>
        <h1 className="display-large">{t('settings.archive.manage.title')}</h1>
        <p>{t('settings.archive.manage.intro')}</p>
      </div>
      <ArchiveExportPanel client={client} />
      <ArchiveVerifyPanel client={client} />
      <ArchiveImportPanel client={client} />
    </div>
  )
}
