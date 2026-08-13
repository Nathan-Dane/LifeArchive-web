import type { LifeArchiveClient } from '../../core/client'
import { useLocalisation } from '../../i18n'
import '../../styles/person-pages.css'
import { PersonEditorFeedback, PersonEditorFields } from './PersonEditorFields'
import { PersonIdentityRail, PersonPageBreadcrumb } from './PersonPageLayout'
import { PersonEditorActions } from './PersonPageActions'
import type { People } from './usePeople'

export interface PersonEditorPageProps {
  readonly client: LifeArchiveClient
  readonly people: People
  readonly onBack: () => void
  readonly onViewProfile: () => void
  readonly backToRecord?: boolean
  readonly onSaved?: () => void
  readonly onArchived?: () => void
  readonly onDeleted: () => void
}

/** Full routed editor using the same durable draft and fields as modal flows. */
export function PersonEditorPage({
  client,
  people,
  onBack,
  onViewProfile,
  backToRecord = false,
  onSaved,
  onArchived,
  onDeleted,
}: PersonEditorPageProps) {
  const t = useLocalisation().t
  const selected = people.state.selected
  const draft = people.state.draft

  if (!selected || !draft) {
    return people.state.status === 'loading' ? (
      <div className="person-page person-page--state" role="status">
        {t('people.loading')}
      </div>
    ) : null
  }

  return (
    <article className="person-page" data-page="editor">
      <PersonPageBreadcrumb
        onBack={onBack}
        backToRecord={backToRecord}
        displayName={selected.person.displayName}
        editing
        onPerson={onViewProfile}
      />
      <div className="person-page__layout">
        <PersonIdentityRail
          client={client}
          selected={selected}
          displayName={draft.displayName || selected.person.displayName}
          editing
        >
          <PersonEditorActions
            people={people}
            selected={selected}
            onViewProfile={onViewProfile}
            onSaved={onSaved}
            onArchived={onArchived}
            onDeleted={onDeleted}
          />
        </PersonIdentityRail>
        <div className="person-page__content person-page__editor-content">
          <PersonEditorFeedback people={people} />
          <PersonEditorFields client={client} people={people} />
        </div>
      </div>
    </article>
  )
}
