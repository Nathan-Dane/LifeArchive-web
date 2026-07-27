import { useTranslate } from '../../i18n'

export function RecordPage() {
  const t = useTranslate()
  return <h1 className="display-large">{t('record.page.title')}</h1>
}
