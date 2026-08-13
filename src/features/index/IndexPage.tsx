import { Link } from 'react-router-dom'
import { useTranslate } from '../../i18n'
import { ShellIcon } from '../../app/shell/ShellIcon'

export function IndexPage() {
  const t = useTranslate()
  return (
    <section className="archive-index" aria-labelledby="index-heading">
      <header className="archive-index__header">
        <div>
          <p className="eyebrow">{t('index.page.eyebrow')}</p>
          <h1 id="index-heading" className="display-large" tabIndex={-1}>
            {t('index.page.title')}
          </h1>
          <p>{t('index.page.detail')}</p>
        </div>
      </header>
      <div className="archive-index__grid">
        <IndexLink
          to="/index/people"
          icon="people"
          title={t('index.people.title')}
          detail={t('index.people.detail')}
          action={t('index.people.action')}
        />
        <IndexLink
          to="/index/tracks"
          icon="track"
          title={t('index.tracks.title')}
          detail={t('index.tracks.detail')}
          action={t('index.tracks.action')}
        />
        <div
          className="archive-index-card archive-index-card--deferred"
          role="group"
          aria-label={t('index.media.accessible')}
        >
          <span className="archive-index-card__icon" aria-hidden="true">
            <ShellIcon name="media" />
          </span>
          <span>
            <span className="archive-index-card__title">
              {t('index.media.title')}
            </span>
            <span className="archive-index-card__detail">
              {t('index.media.detail')}
            </span>
          </span>
          <span className="archive-index-card__footer">
            <span className="archive-index-card__badge">
              {t('index.media.planned')}
            </span>
            <span>{t('index.media.unavailable')}</span>
          </span>
        </div>
      </div>
    </section>
  )
}

function IndexLink({
  to,
  icon,
  title,
  detail,
  action,
}: {
  readonly to: string
  readonly icon: 'people' | 'track'
  readonly title: string
  readonly detail: string
  readonly action: string
}) {
  return (
    <Link className="archive-index-card" to={to}>
      <span className="archive-index-card__icon" aria-hidden="true">
        <ShellIcon name={icon} />
      </span>
      <span>
        <span className="archive-index-card__title">{title}</span>
        <span className="archive-index-card__detail">{detail}</span>
      </span>
      <span className="archive-index-card__footer">
        <span>{action}</span>
        <span className="archive-index-card__next" aria-hidden />
      </span>
    </Link>
  )
}
