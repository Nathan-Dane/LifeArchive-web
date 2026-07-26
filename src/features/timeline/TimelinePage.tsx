import { useTranslate } from '../../i18n'

export function TimelinePage() {
  const t = useTranslate()
  return <h1>{t('timeline.page.title')}</h1>
}
