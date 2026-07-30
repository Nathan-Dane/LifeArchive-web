import { useState } from 'react'
import packageMetadata from '../../../package.json'
import type { LifeArchiveClient } from '../../core/client'
import { resetRememberedRecordCursor } from '../record'
import { useTranslate } from '../../i18n'
import { useBrowserPreferences } from './preferences'
import {
  SettingsContentPage,
  SettingsDisabledRow,
  SettingsSection,
} from './SettingsControls'

const REPOSITORY_URL = 'https://github.com/Nathan-Dane/LifeArchive-web'
const LICENSE_URL =
  'https://github.com/Nathan-Dane/LifeArchive-web/blob/main/LICENSE'
const NOTICE_URL =
  'https://github.com/Nathan-Dane/LifeArchive-web/blob/main/NOTICE.md'

export function AboutSettingsPage({
  client,
}: {
  readonly client: LifeArchiveClient
}) {
  const t = useTranslate()
  const { resetPreferences } = useBrowserPreferences()
  const [reset, setReset] = useState(false)
  const status = client.runtime.status()
  const runtime = status.state === 'available' ? status.runtime : null

  const resetInterface = () => {
    resetPreferences()
    resetRememberedRecordCursor()
    setReset(true)
  }

  return (
    <SettingsContentPage
      title={t('settings.about.title')}
      detail={t('settings.about.detail')}
    >
      <SettingsSection title={t('settings.about.version.section')}>
        <AboutValueRow
          label={t('settings.about.webVersion.label')}
          value={packageMetadata.version}
        />
        <AboutValueRow
          label={t('settings.about.runtimeVersion.label')}
          value={
            runtime?.runtimeVersion ??
            t('settings.about.runtimeVersion.unavailable')
          }
        />
        <AboutValueRow
          label={t('settings.about.runtimeBuild.label')}
          value={
            runtime?.buildId ?? t('settings.about.runtimeVersion.unavailable')
          }
        />
        <SettingsDisabledRow
          label={t('settings.about.buildVersion.label')}
          detail={t('settings.about.buildVersion.detail')}
          unavailable={t('settings.status.notAvailable')}
        />
        <SettingsDisabledRow
          label={t('settings.about.archiveFormat.label')}
          detail={t('settings.about.archiveFormat.detail')}
          unavailable={t('settings.status.notAvailable')}
        />
      </SettingsSection>
      <section className="settings-about-copy">
        <p className="eyebrow">{t('settings.about.privacy.section')}</p>
        <h2>{t('settings.about.privacy.title')}</h2>
        <p>{t('settings.about.privacy.detail')}</p>
      </section>
      <SettingsSection title={t('settings.about.openSource.section')}>
        <div className="settings-link-row">
          <div className="settings-row__copy">
            <strong>{t('settings.about.openSource.label')}</strong>
            <span>{t('settings.about.openSource.detail')}</span>
          </div>
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            {t('settings.about.openSource.action')}
          </a>
        </div>
        <div className="settings-link-row">
          <div className="settings-row__copy">
            <strong>{t('settings.about.licences.label')}</strong>
            <span>{t('settings.about.licences.detail')}</span>
          </div>
          <span className="settings-link-row__actions">
            <a href={LICENSE_URL} target="_blank" rel="noreferrer">
              {t('settings.about.licences.license')}
            </a>
            <a href={NOTICE_URL} target="_blank" rel="noreferrer">
              {t('settings.about.licences.notice')}
            </a>
          </span>
        </div>
      </SettingsSection>
      <SettingsSection title={t('settings.about.reset.section')}>
        <div className="settings-action-row">
          <div className="settings-row__copy">
            <strong>{t('settings.about.reset.label')}</strong>
            <span>{t('settings.about.reset.detail')}</span>
          </div>
          <button type="button" className="button" onClick={resetInterface}>
            {t('settings.about.reset.action')}
          </button>
        </div>
      </SettingsSection>
      {reset ? (
        <p className="settings-page__note" role="status">
          {t('settings.about.reset.complete')}
        </p>
      ) : null}
    </SettingsContentPage>
  )
}

function AboutValueRow({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="settings-row settings-row--value">
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  )
}
