import type { LifeArchiveClient } from '../../core/client'
import { ArchiveImportPanel } from '../archive/import'
import { useTranslate } from '../../i18n'

export function SettingsPage({
  client,
}: {
  readonly client: LifeArchiveClient
}) {
  const t = useTranslate()
  return (
    <div className="settings-page">
      <h1 className="display-large">{t('settings.page.title')}</h1>
      <ArchiveImportPanel client={client} />
    </div>
  )
}
