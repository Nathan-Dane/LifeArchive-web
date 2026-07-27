import { useTranslate } from '../../i18n'

export function SettingsPage() {
  const t = useTranslate()
  return <h1 className="display-large">{t('settings.page.title')}</h1>
}
