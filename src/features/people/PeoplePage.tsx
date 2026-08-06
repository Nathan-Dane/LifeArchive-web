import { useId, useRef, useState } from 'react'
import type { LifeArchiveClient } from '../../core/client'
import { useTranslate } from '../../i18n'
import { RecordOverlay } from '../record/overlays'
import { PeopleManager } from './PeopleManager'
import { PersonDetails } from './PersonDetails'
import { usePeople } from './usePeople'

export function PeoplePage({ client }: { readonly client: LifeArchiveClient }) {
  const t = useTranslate()
  const people = usePeople(client)
  const managerHeading = useId()
  const editorHeading = useId()
  const opener = useRef<HTMLElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const [scroll, setScroll] = useState(0)
  const [showArchived, setShowArchived] = useState(false)

  const rememberOpener = () => {
    if (document.activeElement instanceof HTMLElement) {
      opener.current = document.activeElement
    }
  }
  const closeEditor = () => {
    people.closeEditor()
    globalThis.queueMicrotask(() => opener.current?.focus())
  }

  return (
    <div className="people-page">
      <h1 className="visually-hidden">{t('people.page.title')}</h1>
      <PeopleManager
        client={client}
        people={people}
        headingId={managerHeading}
        showClose={false}
        initialScroll={scroll}
        initialShowArchived={showArchived}
        onScrollChange={setScroll}
        onShowArchivedChange={setShowArchived}
        onCreate={() => {
          rememberOpener()
          people.startCreate()
        }}
        onSelect={(snapshot) => {
          rememberOpener()
          void people.select(snapshot)
        }}
      />
      <RecordOverlay
        open={people.active}
        kind="modal"
        labelledBy={editorHeading}
        anchorRef={opener}
        initialFocusRef={close}
        onClose={closeEditor}
        className="person-editor"
      >
        <PersonDetails
          client={client}
          people={people}
          headingId={editorHeading}
          closeRef={close}
          onBack={closeEditor}
          onClose={closeEditor}
          onCreated={() => {
            closeEditor()
          }}
        />
      </RecordOverlay>
    </div>
  )
}
