import { useId, useState, type FormEvent } from 'react'
import {
  civilDate,
  type ArchiveIdentity,
  type LifeArchiveClient,
  type LifeStatus,
} from '../../core/client'
import { useTranslate } from '../../i18n'
import { archiveTitle } from '../archive/archiveTitle'
import { useArchiveOverview } from './archive/archiveOverviewController'
import {
  useSharedArchiveOverview,
  type ArchiveOverviewController,
} from './archive/archiveOverviewContext'
import {
  SettingsContentPage,
  SettingsSection,
  SettingsToggleRow,
} from './SettingsControls'

interface IdentityDraft {
  readonly archiveName: string
  readonly displayName: string
  readonly shortName: string
  readonly lifeStatus: LifeStatus
  readonly dateOfBirth: string
  readonly dateOfDeath: string
}

const LIFE_STATUSES = ['unspecified', 'living', 'deceased'] as const

const LIFE_STATUS_LABELS = {
  unspecified: 'settings.lifeDetails.status.unspecified',
  living: 'settings.lifeDetails.status.living',
  deceased: 'settings.lifeDetails.status.deceased',
} as const

function identityDraft(identity: ArchiveIdentity): IdentityDraft {
  return {
    archiveName: identity.title ?? '',
    displayName: identity.subject.displayName ?? '',
    shortName: identity.subject.shortName ?? '',
    lifeStatus: identity.subject.lifeStatus,
    dateOfBirth: identity.subject.dateOfBirth ?? '',
    dateOfDeath: identity.subject.dateOfDeath ?? '',
  }
}

function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function LifeDetailsPage({
  client,
}: {
  readonly client: LifeArchiveClient
}) {
  const shared = useSharedArchiveOverview()
  return shared ? (
    <LifeDetailsContent client={client} controller={shared} />
  ) : (
    <LifeDetailsLoader client={client} />
  )
}

function LifeDetailsLoader({ client }: { readonly client: LifeArchiveClient }) {
  const controller = useArchiveOverview(client)
  return <LifeDetailsContent client={client} controller={controller} />
}

function LifeDetailsContent({
  client,
  controller,
}: {
  readonly client: LifeArchiveClient
  readonly controller: ArchiveOverviewController
}) {
  const t = useTranslate()
  const identity =
    controller.state.identity.status === 'available'
      ? controller.state.identity.value.identity
      : null
  const [editedDraft, setEditedDraft] = useState<IdentityDraft | null>(null)
  const draft = editedDraft ?? (identity ? identityDraft(identity) : null)
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'failed'>(
    'idle',
  )
  const [pendingStatus, setPendingStatus] = useState<LifeStatus | null>(null)

  const update = <Key extends keyof IdentityDraft>(
    key: Key,
    value: IdentityDraft[Key],
  ) => {
    if (!identity) return
    setSaveState('idle')
    setEditedDraft((current) => ({
      ...(current ?? identityDraft(identity)),
      [key]: value,
    }))
  }

  const chooseLifeStatus = (next: LifeStatus) => {
    if (!draft) return
    if (
      draft.lifeStatus === 'deceased' &&
      next !== 'deceased' &&
      draft.dateOfDeath
    ) {
      setPendingStatus(next)
      return
    }
    update('lifeStatus', next)
  }

  const confirmStatusChange = () => {
    if (!pendingStatus) return
    if (!identity) return
    setEditedDraft((current) => ({
      ...(current ?? identityDraft(identity)),
      lifeStatus: pendingStatus,
      dateOfDeath: '',
    }))
    setPendingStatus(null)
    setSaveState('idle')
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!identity || !draft || saving) return
    setSaving(true)
    setSaveState('idle')
    const result = await client.identity.save({
      id: identity.id,
      title: optionalText(draft.archiveName),
      subject: {
        id: identity.subject.id,
        displayName: optionalText(draft.displayName),
        shortName: optionalText(draft.shortName),
        lifeStatus: draft.lifeStatus,
        dateOfBirth: draft.dateOfBirth ? civilDate(draft.dateOfBirth) : null,
        dateOfDeath:
          draft.lifeStatus === 'deceased' && draft.dateOfDeath
            ? civilDate(draft.dateOfDeath)
            : null,
      },
    })
    setSaving(false)
    if (result.status !== 'ok') {
      setSaveState('failed')
      return
    }
    setEditedDraft(identityDraft(result.value.identity))
    setSaveState('saved')
    controller.retry()
  }

  return (
    <SettingsContentPage
      title={t('settings.lifeDetails.title')}
      detail={t('settings.lifeDetails.detail')}
    >
      {controller.state.identity.status === 'loading' ? (
        <p className="settings-page__note">
          {t('settings.lifeDetails.loading')}
        </p>
      ) : controller.state.identity.status === 'unavailable' ||
        !identity ||
        !draft ? (
        <div className="settings-inline-failure" role="status">
          <p>{t('settings.lifeDetails.unavailable')}</p>
          <button type="button" className="button" onClick={controller.retry}>
            {t('app.action.retry')}
          </button>
        </div>
      ) : (
        <form className="settings-form" onSubmit={save}>
          <SettingsSection title={t('settings.lifeDetails.archive.section')}>
            <SettingsTextField
              label={t('settings.lifeDetails.archiveName.label')}
              detail={t('settings.lifeDetails.archiveName.detail')}
              value={draft.archiveName}
              placeholder={archiveTitle(
                {
                  ...identity,
                  title: null,
                  subject: {
                    ...identity.subject,
                    displayName: optionalText(draft.displayName),
                    shortName: optionalText(draft.shortName),
                  },
                },
                t,
              )}
              onChange={(value) => update('archiveName', value)}
            />
            <SettingsToggleRow
              label={t('settings.lifeDetails.myLife.label')}
              detail={t('settings.lifeDetails.myLife.detail')}
              unavailable={t('settings.status.notAvailable')}
              checked={false}
              disabled
              onChange={() => undefined}
            />
          </SettingsSection>
          <SettingsSection title={t('settings.lifeDetails.person.section')}>
            <SettingsTextField
              label={t('settings.lifeDetails.displayName.label')}
              detail={t('settings.lifeDetails.displayName.detail')}
              value={draft.displayName}
              onChange={(value) => update('displayName', value)}
            />
            <SettingsTextField
              label={t('settings.lifeDetails.shortName.label')}
              detail={t('settings.lifeDetails.shortName.detail')}
              value={draft.shortName}
              onChange={(value) => update('shortName', value)}
            />
            <SettingsSelectField
              label={t('settings.lifeDetails.status.label')}
              detail={t('settings.lifeDetails.status.detail')}
              value={draft.lifeStatus}
              onChange={chooseLifeStatus}
            />
            <SettingsDateField
              label={t('settings.lifeDetails.birth.label')}
              detail={t('settings.lifeDetails.birth.detail')}
              value={draft.dateOfBirth}
              onChange={(value) => update('dateOfBirth', value)}
            />
            {draft.lifeStatus === 'deceased' ? (
              <SettingsDateField
                label={t('settings.lifeDetails.death.label')}
                detail={t('settings.lifeDetails.death.detail')}
                value={draft.dateOfDeath}
                onChange={(value) => update('dateOfDeath', value)}
              />
            ) : null}
          </SettingsSection>
          {pendingStatus ? (
            <section
              className="settings-confirmation"
              aria-labelledby="life-status-confirmation-title"
            >
              <h2 id="life-status-confirmation-title">
                {t('settings.lifeDetails.clearDeath.title')}
              </h2>
              <p>{t('settings.lifeDetails.clearDeath.detail')}</p>
              <div className="settings-form__actions">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={confirmStatusChange}
                >
                  {t('settings.lifeDetails.clearDeath.confirm')}
                </button>
                <button
                  type="button"
                  className="button"
                  onClick={() => setPendingStatus(null)}
                >
                  {t('settings.lifeDetails.clearDeath.cancel')}
                </button>
              </div>
            </section>
          ) : null}
          <div className="settings-form__footer">
            <button
              type="submit"
              className="button button--primary"
              disabled={saving || pendingStatus !== null}
            >
              {t(
                saving
                  ? 'settings.lifeDetails.saving'
                  : 'settings.lifeDetails.save',
              )}
            </button>
            {saveState === 'saved' ? (
              <p role="status">{t('settings.lifeDetails.saved')}</p>
            ) : saveState === 'failed' ? (
              <p role="alert">{t('settings.lifeDetails.saveFailed')}</p>
            ) : null}
          </div>
        </form>
      )}
    </SettingsContentPage>
  )
}

function SettingsTextField({
  label,
  detail,
  value,
  placeholder,
  onChange,
}: {
  readonly label: string
  readonly detail: string
  readonly value: string
  readonly placeholder?: string
  readonly onChange: (value: string) => void
}) {
  const id = useId()
  const detailId = useId()
  return (
    <div className="settings-row">
      <div className="settings-row__copy">
        <label htmlFor={id}>{label}</label>
        <span id={detailId}>{detail}</span>
      </div>
      <input
        id={id}
        className="settings-input"
        value={value}
        placeholder={placeholder}
        aria-describedby={detailId}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  )
}

function SettingsDateField({
  label,
  detail,
  value,
  onChange,
}: {
  readonly label: string
  readonly detail: string
  readonly value: string
  readonly onChange: (value: string) => void
}) {
  const id = useId()
  const detailId = useId()
  return (
    <div className="settings-row">
      <div className="settings-row__copy">
        <label htmlFor={id}>{label}</label>
        <span id={detailId}>{detail}</span>
      </div>
      <input
        id={id}
        className="settings-input"
        type="date"
        value={value}
        aria-describedby={detailId}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  )
}

function SettingsSelectField({
  label,
  detail,
  value,
  onChange,
}: {
  readonly label: string
  readonly detail: string
  readonly value: LifeStatus
  readonly onChange: (value: LifeStatus) => void
}) {
  const t = useTranslate()
  const id = useId()
  const detailId = useId()
  return (
    <div className="settings-row">
      <div className="settings-row__copy">
        <label htmlFor={id}>{label}</label>
        <span id={detailId}>{detail}</span>
      </div>
      <select
        id={id}
        className="settings-select"
        value={value}
        aria-describedby={detailId}
        onChange={(event) => onChange(event.currentTarget.value as LifeStatus)}
      >
        {LIFE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {t(LIFE_STATUS_LABELS[status])}
          </option>
        ))}
      </select>
    </div>
  )
}
