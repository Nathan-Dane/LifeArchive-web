import { useState, type RefObject } from 'react'
import type { PersonSnapshot } from '../../core/client'
import { useLocalisation } from '../../i18n'
import { RecordControlIcon } from '../../ui/overlay'
import { PersonEditorFeedback, PersonEditorFields } from './PersonEditorFields'
import { PersonInsights } from './PersonInsights'
import { PersonManagementActions } from './PersonManagementActions'
import type { People } from './usePeople'

/**
 * Legacy modal host for the shared Person editor. Routed People pages use
 * `PersonEditorPage`; chooser flows keep this wrapper until their routes are
 * migrated.
 */
export function PersonDetails({
  people,
  headingId,
  closeRef,
  onBack,
  onClose,
  onCreated,
  onChanged,
}: {
  readonly people: People
  readonly headingId: string
  readonly closeRef: RefObject<HTMLButtonElement | null>
  readonly onBack?: () => void
  readonly onClose: () => void
  readonly onCreated?: (
    snapshot: PersonSnapshot,
  ) => void | boolean | Promise<void | boolean>
  readonly onChanged?: () => void
}) {
  const t = useLocalisation().t
  const [createdHandoffFailed, setCreatedHandoffFailed] = useState(false)
  const draft = people.state.draft
  const selected = people.state.selected
  if (!draft) return null
  const busy = people.state.status === 'saving'
  const valid = /\S/u.test(draft.displayName)

  const save = async () => {
    if (people.state.creating) {
      const created = await people.create()
      if (created) {
        const accepted = await onCreated?.(created.snapshot)
        setCreatedHandoffFailed(accepted === false)
      }
      return
    }
    if (await people.save()) onChanged?.()
  }

  return (
    <>
      <header className="record-overlay__header person-editor__header">
        {onBack ? (
          <button
            type="button"
            className="record-overlay__back"
            aria-label={t('people.back')}
            onClick={onBack}
          >
            <RecordControlIcon name="back" />
          </button>
        ) : null}
        <div>
          <h2 id={headingId} className="ui-heading">
            {t(
              people.state.creating
                ? 'people.create.heading'
                : 'people.edit.heading',
            )}
          </h2>
          <p className="meta-text">
            {t(
              people.state.creating
                ? 'people.create.detail'
                : 'people.edit.detail',
            )}
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="record-overlay__close"
          aria-label={t('people.close.editor')}
          onClick={onClose}
        >
          <RecordControlIcon name="close" />
        </button>
      </header>

      <div className="person-editor__body">
        <PersonEditorFeedback
          people={people}
          createdHandoffFailed={createdHandoffFailed}
        />
        <PersonEditorFields people={people} />
        {!people.state.creating && selected ? (
          <PersonInsights people={people} />
        ) : null}
        {!people.state.creating && selected ? (
          <PersonManagementActions
            people={people}
            selected={selected}
            busy={busy}
          />
        ) : null}
      </div>

      <footer className="record-overlay__footer person-editor__footer">
        <button
          type="button"
          className="button button--primary"
          disabled={!valid || busy}
          onClick={() => void save()}
        >
          {t(busy ? 'people.saving' : 'people.save')}
        </button>
      </footer>
    </>
  )
}
