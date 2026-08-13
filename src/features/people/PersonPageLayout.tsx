import type {
  LifeArchiveClient,
  PersonDate,
  PersonSnapshot,
} from '../../core/client'
import type { ReactNode } from 'react'
import { useFormat, useLocalisation } from '../../i18n'
import { RecordControlIcon } from '../../ui/overlay'
import { PersonAvatar } from './PersonAvatar'

export function PersonPageBreadcrumb({
  onBack,
}: {
  readonly onBack: () => void
}) {
  const t = useLocalisation().t
  return (
    <button
      type="button"
      className="person-page__back"
      aria-label={t('people.profile.back')}
      onClick={onBack}
    >
      <RecordControlIcon name="back" />
      <span>{t('people.page.title')}</span>
    </button>
  )
}

export function PersonIdentityRail({
  client,
  selected,
  displayName = selected.person.displayName,
  editing = false,
  children,
}: {
  readonly client: LifeArchiveClient
  readonly selected: PersonSnapshot
  readonly displayName?: string
  readonly editing?: boolean
  readonly children: ReactNode
}) {
  const t = useLocalisation().t
  const person = selected.person

  return (
    <aside className="person-page__rail">
      <section className="person-page__identity">
        <PersonAvatar
          client={client}
          name={displayName}
          photo={selected.profilePhoto}
          size="large"
        />
        <div className="person-page__identity-copy">
          <h1>{displayName}</h1>
          {person.connectionLabels[0] ? (
            <p>{person.connectionLabels[0]}</p>
          ) : null}
          {person.pronouns ? (
            <p className="meta-text">{person.pronouns}</p>
          ) : null}
          {editing ? (
            <span className="person-page__status">
              {t('people.profile.editing')}
            </span>
          ) : person.isArchived ? (
            <span className="person-page__status">
              {t('people.archived.label')}
            </span>
          ) : null}
        </div>
        {person.connectionLabels.length > 1 ? (
          <ul className="person-page__connections">
            {person.connectionLabels.slice(1).map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        ) : null}
        {children}
      </section>
    </aside>
  )
}

export function PersonProfileDetails({
  selected,
}: {
  readonly selected: PersonSnapshot
}) {
  const t = useLocalisation().t
  const format = useFormat()
  const person = selected.person

  return (
    <>
      <section className="person-card person-profile-card">
        <h2>{t('people.about')}</h2>
        <p>{person.about ?? t('people.profile.notRecorded')}</p>
      </section>

      <section className="person-card person-profile-card">
        <h2>{t('people.names')}</h2>
        <dl className="person-profile-list">
          <ProfileValue
            label={t('people.pronunciation')}
            value={person.pronunciation}
          />
          <ProfileValue label={t('people.pronouns')} value={person.pronouns} />
          {person.otherNames.map((name, index) => (
            <ProfileValue
              key={`${name.kindId}-${index}`}
              label={otherNameKind(name.kindId, t)}
              value={name.value}
            />
          ))}
        </dl>
      </section>

      <section className="person-card person-profile-card">
        <h2>{t('people.life')}</h2>
        <dl className="person-profile-list">
          <ProfileValue
            label={t('people.life.status')}
            value={t(`people.life.status.${person.lifeStatus}`)}
          />
          <ProfileValue
            label={t('people.birth')}
            value={formatPartialDate(person.birthDate, format, t)}
          />
          <ProfileValue
            label={t('people.death')}
            value={formatPartialDate(person.deathDate, format, t)}
          />
        </dl>
      </section>

      <section className="person-card person-profile-card">
        <h2>{t('people.references')}</h2>
        {person.references.length === 0 ? (
          <p>{t('people.profile.notRecorded')}</p>
        ) : (
          <ul className="person-profile-references">
            {person.references.map((reference, index) => (
              <li key={`${reference.kindId}-${reference.url}-${index}`}>
                <span className="meta-text">
                  {referenceKind(reference.kindId, t)}
                </span>
                {safeExternalHref(reference.url) ? (
                  <a
                    href={safeExternalHref(reference.url) ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {reference.label ?? reference.url}
                  </a>
                ) : (
                  <span>{reference.label ?? reference.url}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function ProfileValue({
  label,
  value,
}: {
  readonly label: string
  readonly value: string | null
}) {
  const t = useLocalisation().t
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value ?? t('people.profile.notRecorded')}</dd>
    </div>
  )
}

function formatPartialDate(
  date: PersonDate | null,
  format: ReturnType<typeof useFormat>,
  t: ReturnType<typeof useLocalisation>['t'],
): string | null {
  if (!date) return null
  const year = String(date.year).padStart(4, '0')
  const month = String(date.month ?? 1).padStart(2, '0')
  const day = String(date.day ?? 1).padStart(2, '0')
  const civil = `${year}-${month}-${day}`
  const value =
    date.precision === 'year'
      ? format.civilYear(civil)
      : date.precision === 'month'
        ? format.civilMonthAndYear(civil)
        : format.civilDate(civil, 'medium')
  return date.approximate
    ? t('people.profile.approximateDate', { date: value })
    : value
}

function otherNameKind(
  kindId: string,
  t: ReturnType<typeof useLocalisation>['t'],
): string {
  const known = [
    'nickname',
    'formerName',
    'birthName',
    'alternateSpelling',
    'anotherScript',
    'other',
  ] as const
  return known.includes(kindId as (typeof known)[number])
    ? t(`people.otherNames.kind.${kindId as (typeof known)[number]}`)
    : kindId
}

function referenceKind(
  kindId: string,
  t: ReturnType<typeof useLocalisation>['t'],
): string {
  const known = [
    'personalWebsite',
    'socialProfile',
    'professionalProfile',
    'memorial',
    'other',
  ] as const
  return known.includes(kindId as (typeof known)[number])
    ? t(`people.references.kind.${kindId as (typeof known)[number]}`)
    : kindId
}

function safeExternalHref(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : null
  } catch {
    return null
  }
}
