import { Link } from 'react-router-dom'
import { useTranslate } from '../../i18n'

export function IndexBreadcrumbs({ current }: { readonly current: string }) {
  const t = useTranslate()
  return (
    <nav
      className="archive-index-breadcrumbs"
      aria-label={t('index.breadcrumb.label')}
    >
      <Link to="/index">{t('index.breadcrumb.index')}</Link>
      <span className="archive-index-breadcrumbs__separator" aria-hidden />
      <span aria-current="page">{current}</span>
    </nav>
  )
}
