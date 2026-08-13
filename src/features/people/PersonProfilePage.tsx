import type { LifeArchiveClient } from '../../core/client'
import { useLocalisation } from '../../i18n'
import '../../styles/person-pages.css'
import { PersonInsights } from './PersonInsights'
import {
  PersonIdentityRail,
  PersonPageBreadcrumb,
  PersonProfileDetails,
} from './PersonPageLayout'
import { PersonProfileActions } from './PersonPageActions'
import type { People } from './usePeople'

export interface PersonProfilePageProps {
  readonly client: LifeArchiveClient
  readonly people: People
  readonly onBack: () => void
  readonly onEdit: () => void
  readonly onArchived?: () => void
  readonly onDeleted: () => void
}

/** Read-only canonical Person presentation. Routing remains owned by the app. */
export function PersonProfilePage({
  client,
  people,
  onBack,
  onEdit,
  onArchived,
  onDeleted,
}: PersonProfilePageProps) {
  const t = useLocalisation().t
  const selected = people.state.selected

  if (!selected) {
    return people.state.status === 'loading' ? (
      <div className="person-page person-page--state" role="status">
        {t('people.loading')}
      </div>
    ) : null
  }

  return (
    <article className="person-page" data-page="profile">
      <PersonPageBreadcrumb onBack={onBack} />
      <div className="person-page__layout">
        <PersonIdentityRail client={client} selected={selected}>
          <PersonProfileActions
            people={people}
            selected={selected}
            onEdit={onEdit}
            onArchived={onArchived}
            onDeleted={onDeleted}
          />
        </PersonIdentityRail>
        <div className="person-page__content">
          <PersonProfileDetails selected={selected} />
          <PersonInsights people={people} />
        </div>
      </div>
    </article>
  )
}
