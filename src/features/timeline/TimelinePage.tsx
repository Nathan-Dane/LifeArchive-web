import { useTranslate } from '../../i18n'

export function TimelinePage() {
  const t = useTranslate()
  return <h1 className="display-large">{t('timeline.page.title')}</h1>
}
