import { useId } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { LifeArchiveClient } from '../../core/client'
import { useTranslate } from '../../i18n'
import type { StoragePersistence } from '../../platform/storage'
import { ArchiveManagementPage, ArchiveOverviewCards } from './archive'
import { AboutSettingsPage } from './AboutSettingsPage'
import { LifeDetailsPage } from './LifeDetailsPage'
import {
  ACCENT_COLOURS,
  DATE_FORMAT_PREFERENCES,
  FONT_PREFERENCES,
  OPEN_APP_PREFERENCES,
  RECORD_INITIAL_SCALE_PREFERENCES,
  WEEK_START_PREFERENCES,
  useBrowserPreferences,
  type AccentColour,
} from './preferences'
import {
  SettingsContentPage,
  SettingsDisabledRow,
  SettingsSection,
  SettingsSelectRow,
  SettingsToggleRow,
} from './SettingsControls'

const SETTINGS_THEME_PREFERENCES = ['system', 'dark', 'light'] as const

const WEEK_START_LABELS = {
  system: 'settings.general.weekStartsOn.system',
  monday: 'settings.general.weekStartsOn.monday',
  sunday: 'settings.general.weekStartsOn.sunday',
} as const

const DATE_FORMAT_LABELS = {
  regional: 'settings.general.dateFormat.regional',
  'day-month-year': 'settings.general.dateFormat.dayMonthYear',
  'month-day-year': 'settings.general.dateFormat.monthDayYear',
} as const

const OPEN_APP_LABELS = {
  record: 'settings.general.openAppTo.record',
  timeline: 'settings.general.openAppTo.timeline',
  last: 'settings.general.openAppTo.last',
} as const

const SCALE_LABELS = {
  last: 'settings.record.initialScale.last',
  day: 'settings.record.initialScale.day',
  week: 'settings.record.initialScale.week',
  month: 'settings.record.initialScale.monthValue',
  year: 'settings.record.initialScale.year',
} as const

const THEME_LABELS = {
  system: 'app.appearance.system',
  light: 'app.appearance.light',
  dark: 'app.appearance.dark',
} as const

const ACCENT_LABELS = {
  gold: 'settings.appearance.accent.gold',
  copper: 'settings.appearance.accent.copper',
  sage: 'settings.appearance.accent.sage',
  blue: 'settings.appearance.accent.blue',
  plum: 'settings.appearance.accent.plum',
} as const

export function SettingsPage({
  client,
  persistence,
}: {
  readonly client: LifeArchiveClient
  readonly persistence?: StoragePersistence
}) {
  return (
    <Routes>
      <Route index element={<Navigate to="/settings/overview" replace />} />
      <Route
        path="overview"
        element={
          <SettingsOverviewPage client={client} persistence={persistence} />
        }
      />
      <Route
        path="life-details"
        element={<LifeDetailsPage client={client} />}
      />
      <Route path="general" element={<GeneralSettingsPage />} />
      <Route path="appearance" element={<AppearanceSettingsPage />} />
      <Route path="record" element={<RecordSettingsPage />} />
      <Route path="timeline" element={<TimelineSettingsPage />} />
      <Route
        path="archive"
        element={
          <ArchiveManagementPage client={client} persistence={persistence} />
        }
      />
      <Route path="about" element={<AboutSettingsPage client={client} />} />
      <Route path="*" element={<Navigate to="/settings/overview" replace />} />
    </Routes>
  )
}

function SettingsOverviewPage({
  client,
  persistence,
}: {
  readonly client: LifeArchiveClient
  readonly persistence?: StoragePersistence
}) {
  const t = useTranslate()
  return (
    <SettingsContentPage
      title={t('settings.overview.title')}
      detail={t('settings.overview.detail')}
    >
      <ArchiveOverviewCards client={client} persistence={persistence} />
    </SettingsContentPage>
  )
}

function GeneralSettingsPage() {
  const t = useTranslate()
  const { preferences, setPreference } = useBrowserPreferences()
  return (
    <SettingsContentPage
      title={t('settings.general.title')}
      detail={t('settings.general.detail')}
    >
      <SettingsSection title={t('settings.scope.browser')}>
        <SettingsSelectRow
          label={t('settings.general.dateFormat.label')}
          detail={t('settings.general.dateFormat.detail')}
          value={preferences.dateFormat}
          options={DATE_FORMAT_PREFERENCES.map((value) => ({
            value,
            label: t(DATE_FORMAT_LABELS[value]),
          }))}
          onChange={(value) => setPreference('dateFormat', value)}
        />
        <SettingsSelectRow
          label={t('settings.general.weekStartsOn.label')}
          detail={t('settings.general.weekStartsOn.detail')}
          unavailable={t('settings.general.weekStartsOn.unavailable')}
          value="monday"
          options={WEEK_START_PREFERENCES.map((value) => ({
            value,
            label: t(WEEK_START_LABELS[value]),
          }))}
          disabled
          onChange={() => undefined}
        />
        <SettingsSelectRow
          label={t('settings.general.openAppTo.label')}
          detail={t('settings.general.openAppTo.detail')}
          value={preferences.openAppTo}
          options={OPEN_APP_PREFERENCES.map((value) => ({
            value,
            label: t(OPEN_APP_LABELS[value]),
          }))}
          onChange={(value) => setPreference('openAppTo', value)}
        />
        <SettingsDisabledRow
          label={t('settings.general.language.label')}
          detail={t('settings.general.language.detail')}
          unavailable={t('settings.status.notAvailable')}
        />
      </SettingsSection>
    </SettingsContentPage>
  )
}

function AppearanceSettingsPage() {
  const t = useTranslate()
  const { preferences, setPreference } = useBrowserPreferences()
  return (
    <SettingsContentPage
      title={t('settings.appearance.title')}
      detail={t('settings.appearance.detail')}
    >
      <AppearancePreview />
      <SettingsSection title={t('settings.appearance.theme.section')}>
        <SettingsSelectRow
          label={t('settings.appearance.theme.label')}
          detail={t('settings.appearance.theme.detail')}
          value={preferences.theme}
          options={SETTINGS_THEME_PREFERENCES.map((value) => ({
            value,
            label: t(THEME_LABELS[value]),
          }))}
          onChange={(value) => setPreference('theme', value)}
        />
      </SettingsSection>
      <SettingsSection title={t('settings.appearance.typography.section')}>
        <SettingsSelectRow
          label={t('settings.appearance.headingFont.label')}
          detail={t('settings.appearance.headingFont.detail')}
          value={preferences.headingFont}
          options={FONT_PREFERENCES.map((value) => ({
            value,
            label: t(
              value === 'serif'
                ? 'settings.appearance.font.serif'
                : 'settings.appearance.font.system',
            ),
          }))}
          onChange={(value) => setPreference('headingFont', value)}
        />
        <SettingsSelectRow
          label={t('settings.appearance.writingFont.label')}
          detail={t('settings.appearance.writingFont.detail')}
          value={preferences.writingFont}
          options={FONT_PREFERENCES.map((value) => ({
            value,
            label: t(
              value === 'serif'
                ? 'settings.appearance.font.serif'
                : 'settings.appearance.font.system',
            ),
          }))}
          onChange={(value) => setPreference('writingFont', value)}
        />
      </SettingsSection>
      <SettingsSection title={t('settings.appearance.accent.section')}>
        <AccentColourPicker
          value={preferences.accentColour}
          onChange={(value) => setPreference('accentColour', value)}
        />
      </SettingsSection>
    </SettingsContentPage>
  )
}

function AppearancePreview() {
  const t = useTranslate()
  return (
    <section
      className="settings-preview"
      aria-labelledby="settings-preview-title"
    >
      <div className="settings-preview__meta">
        <span className="eyebrow">
          {t('settings.appearance.preview.label')}
        </span>
        <span className="settings-preview__status">
          <span aria-hidden="true" />
          {t('settings.appearance.preview.status')}
        </span>
      </div>
      <h2 id="settings-preview-title" className="settings-preview__heading">
        {t('settings.appearance.preview.heading')}
      </h2>
      <p className="settings-preview__writing reading">
        {t('settings.appearance.preview.writing')}
      </p>
      <p className="settings-preview__secondary">
        {t('settings.appearance.preview.secondary')}
      </p>
    </section>
  )
}

function AccentColourPicker({
  value,
  onChange,
}: {
  readonly value: AccentColour
  readonly onChange: (value: AccentColour) => void
}) {
  const t = useTranslate()
  const legendId = useId()
  return (
    <fieldset className="settings-accent" aria-describedby={legendId}>
      <legend>{t('settings.appearance.accent.label')}</legend>
      <p id={legendId}>{t('settings.appearance.accent.detail')}</p>
      <div className="settings-accent__options">
        {ACCENT_COLOURS.map((accent) => (
          <label
            key={accent}
            className="settings-accent__option"
            data-selected={accent === value}
          >
            <input
              type="radio"
              name="settings-accent-colour"
              value={accent}
              checked={accent === value}
              onChange={() => onChange(accent)}
            />
            <span
              className="settings-accent__swatch"
              data-accent-option={accent}
              aria-hidden="true"
            />
            <span>{t(ACCENT_LABELS[accent])}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function TimelineSettingsPage() {
  const t = useTranslate()
  const { preferences } = useBrowserPreferences()
  return (
    <SettingsContentPage
      title={t('settings.timeline.title')}
      detail={t('settings.timeline.detail')}
    >
      <SettingsSection title={t('settings.scope.browser')}>
        <SettingsToggleRow
          label={t('settings.timeline.limit.label')}
          detail={t('settings.timeline.limit.detail')}
          unavailable={t('settings.status.notAvailable')}
          checked={preferences.limitTimelineScrolling}
          disabled
          onChange={() => undefined}
        />
        <SettingsToggleRow
          label={t('settings.timeline.scaleButtons.label')}
          detail={t('settings.timeline.scaleButtons.detail')}
          unavailable={t('settings.status.notAvailable')}
          checked={false}
          disabled
          onChange={() => undefined}
        />
        <SettingsToggleRow
          label={t('settings.timeline.zoom.label')}
          detail={t('settings.timeline.zoom.detail')}
          unavailable={t('settings.status.notAvailable')}
          checked={false}
          disabled
          onChange={() => undefined}
        />
        <SettingsSelectRow
          label={t('settings.timeline.initialScale.label')}
          detail={t('settings.timeline.initialScale.detail')}
          unavailable={t('settings.status.notAvailable')}
          value="last"
          options={RECORD_INITIAL_SCALE_PREFERENCES.map((value) => ({
            value,
            label: t(SCALE_LABELS[value]),
          }))}
          disabled
          onChange={() => undefined}
        />
        <SettingsDisabledRow
          label={t('settings.timeline.motion.label')}
          detail={t('settings.timeline.motion.detail')}
          unavailable={t('settings.timeline.motion.system')}
        />
      </SettingsSection>
      <p className="settings-page__note">
        {t('settings.timeline.browserOnly')}
      </p>
    </SettingsContentPage>
  )
}

function RecordSettingsPage() {
  const t = useTranslate()
  const { preferences, setPreference } = useBrowserPreferences()
  return (
    <SettingsContentPage
      title={t('settings.record.title')}
      detail={t('settings.record.detail')}
    >
      <SettingsSection title={t('settings.scope.browser')}>
        <SettingsSelectRow
          label={t('settings.record.initialScale.label')}
          detail={t('settings.record.initialScale.detail')}
          value={preferences.recordInitialScale}
          options={RECORD_INITIAL_SCALE_PREFERENCES.map((value) => ({
            value,
            label: t(SCALE_LABELS[value]),
          }))}
          onChange={(value) => setPreference('recordInitialScale', value)}
        />
        <SettingsToggleRow
          label={t('settings.record.scaleButtons.label')}
          detail={t('settings.record.scaleButtons.detail')}
          unavailable={t('settings.record.scaleButtons.required')}
          checked
          disabled
          onChange={() => undefined}
        />
        <SettingsToggleRow
          label={t('settings.record.gestures.label')}
          detail={t('settings.record.gestures.detail')}
          unavailable={t('settings.status.notAvailable')}
          checked={false}
          disabled
          onChange={() => undefined}
        />
        <SettingsSelectRow
          label={t('settings.record.greeting.label')}
          detail={t('settings.record.greeting.detail')}
          unavailable={t('settings.status.notAvailable')}
          value="show"
          options={[
            { value: 'show', label: t('settings.record.greeting.show') },
            { value: 'hide', label: t('settings.record.greeting.hide') },
          ]}
          disabled
          onChange={() => undefined}
        />
        <SettingsToggleRow
          label={t('settings.record.navigationPanel.label')}
          detail={t('settings.record.navigationPanel.detail')}
          unavailable={t('settings.status.notAvailable')}
          checked={false}
          disabled
          onChange={() => undefined}
        />
      </SettingsSection>
    </SettingsContentPage>
  )
}
