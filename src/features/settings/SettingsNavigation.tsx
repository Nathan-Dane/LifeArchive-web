import { NavLink } from 'react-router-dom'
import { useWorkspacePanels } from '../../app/shell'
import type { LifeArchiveClient } from '../../core/client'
import { useTranslate } from '../../i18n'
import { archiveTitle } from '../archive/archiveTitle'
import { useArchiveOverview } from './archive/archiveOverviewController'
import { useSharedArchiveOverview } from './archive/archiveOverviewContext'

const SETTINGS_DESTINATIONS = [
  {
    group: 'settings.navigation.yourArchive',
    items: [
      {
        path: '/settings/overview',
        label: 'settings.overview.title',
      },
      {
        path: '/settings/life-details',
        label: 'settings.lifeDetails.title',
      },
      {
        path: '/settings/archive',
        label: 'settings.archive.manage.title',
      },
    ],
  },
  {
    group: 'settings.navigation.thisBrowser',
    items: [
      { path: '/settings/general', label: 'settings.general.title' },
      { path: '/settings/appearance', label: 'settings.appearance.title' },
      { path: '/settings/record', label: 'settings.record.title' },
      { path: '/settings/timeline', label: 'settings.timeline.title' },
    ],
  },
  {
    group: 'settings.navigation.about',
    items: [{ path: '/settings/about', label: 'settings.about.title' }],
  },
] as const

export function SettingsNavigationRegion({
  client,
}: {
  readonly client: LifeArchiveClient
}) {
  const shared = useSharedArchiveOverview()
  return shared ? (
    <SettingsNavigationContent state={shared.state} />
  ) : (
    <SettingsNavigationLoader client={client} />
  )
}

function SettingsNavigationLoader({
  client,
}: {
  readonly client: LifeArchiveClient
}) {
  const { state } = useArchiveOverview(client)
  return <SettingsNavigationContent state={state} />
}

function SettingsNavigationContent({
  state,
}: {
  readonly state: ReturnType<typeof useArchiveOverview>['state']
}) {
  const t = useTranslate()
  const { close } = useWorkspacePanels()
  const title =
    state.identity.status === 'available'
      ? archiveTitle(state.identity.value.identity, t)
      : t('settings.archive.title.fallback')
  const archiveAccessConfirmed =
    state.storage.status === 'available' &&
    state.storage.value.runtime?.archiveOpen === true
  const healthy = state.overview.status === 'available'

  const finishNavigation = () => {
    close()
    globalThis.queueMicrotask(() =>
      document.getElementById('main-content')?.focus(),
    )
  }

  return (
    <div className="settings-navigation-region">
      <header
        className="settings-navigation__archive"
        aria-busy={
          state.identity.status === 'loading' ||
          state.storage.status === 'loading' ||
          undefined
        }
      >
        <strong>{title}</strong>
        <span>
          {t(
            archiveAccessConfirmed
              ? 'settings.navigation.storage.local'
              : 'settings.navigation.storage.unavailable',
          )}
        </span>
        {healthy ? (
          <span className="settings-navigation__health">
            <span aria-hidden="true" />
            {t('settings.archive.health.healthy')}
          </span>
        ) : null}
      </header>
      <nav
        className="settings-navigation"
        aria-label={t('settings.navigation.label')}
      >
        {SETTINGS_DESTINATIONS.map((group) => (
          <section key={group.group} className="settings-navigation__group">
            <h2 className="eyebrow">{t(group.group)}</h2>
            <ul>
              {group.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className="settings-navigation__item"
                    onClick={finishNavigation}
                  >
                    <span>{t(item.label)}</span>
                    <SettingsNavigationChevron />
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </div>
  )
}

function SettingsNavigationChevron() {
  return (
    <svg
      className="settings-navigation__chevron"
      viewBox="0 0 16 24"
      width="8"
      height="14"
      aria-hidden="true"
    >
      <path
        d="m4 4 8 8-8 8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}
