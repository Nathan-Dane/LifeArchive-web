import { useId, useRef, useState, type RefObject } from 'react'
import type { PersonSnapshot } from '../../core/client'
import { failureMessage, useLocalisation } from '../../i18n'
import { RecordOverlay } from '../../ui/overlay'
import { PeopleSelect } from './PeopleSelect'
import { PeopleTaskHeader } from './PeopleTaskHeader'
import { STANDARD_CONNECTION_LABELS } from './connectionLabels'
import type { People } from './usePeople'

export function PersonQuickCreateDialog({
  people,
  open,
  anchorRef,
  externallyBusy = false,
  onClose,
  onCreated,
}: {
  readonly people: People
  readonly open: boolean
  readonly anchorRef: RefObject<HTMLElement | null>
  readonly externallyBusy?: boolean
  readonly onClose: () => void
  readonly onCreated: (
    snapshot: PersonSnapshot,
  ) => void | boolean | Promise<void | boolean>
}) {
  const localisation = useLocalisation()
  const t = localisation.t
  const headingId = useId()
  const nameInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [connection, setConnection] = useState('')
  const [created, setCreated] = useState<PersonSnapshot | null>(null)
  const [handingOff, setHandingOff] = useState(false)
  const [handoffFailed, setHandoffFailed] = useState(false)
  const busy =
    people.state.quickCreateStatus === 'saving' || handingOff || externallyBusy
  const valid = /\S/u.test(name)

  const reset = () => {
    setName('')
    setConnection('')
    setCreated(null)
    setHandoffFailed(false)
    people.resetQuickCreate()
  }
  const close = () => {
    if (busy) return
    reset()
    onClose()
  }
  const create = async () => {
    const snapshot =
      created ?? (await people.quickCreate(name, connection || null))
    if (!snapshot) return
    setCreated(snapshot)
    setHandingOff(true)
    setHandoffFailed(false)
    try {
      const accepted = await onCreated(snapshot)
      if (accepted === false) {
        setHandoffFailed(true)
        return
      }
      reset()
    } catch {
      setHandoffFailed(true)
    } finally {
      setHandingOff(false)
    }
  }

  return (
    <RecordOverlay
      open={open}
      kind="modal"
      modalPlacement="center"
      labelledBy={headingId}
      anchorRef={anchorRef}
      initialFocusRef={nameInput}
      onClose={close}
      className="people-quick-create"
    >
      <PeopleTaskHeader
        headingId={headingId}
        title={t('people.create.heading')}
        closeLabel={t('people.cancel')}
        disabled={busy}
        onClose={close}
      />
      <div className="people-quick-create__body">
        <p className="meta-text people-task-detail">
          {t('people.create.quick.detail')}
        </p>
        {people.state.quickCreateFailure ? (
          <p role="alert" className="record-details__failure">
            {failureMessage(localisation, people.state.quickCreateFailure)}
          </p>
        ) : null}
        {handoffFailed ? (
          <p role="alert" className="record-details__failure">
            {t('people.created.linkFailed')}
          </p>
        ) : null}
        <label className="person-field">
          <span>{t('people.name')}</span>
          <input
            ref={nameInput}
            value={name}
            disabled={busy || created !== null}
            required
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </label>
        <div className="person-field">
          <span>{t('people.connections.optional')}</span>
          <PeopleSelect
            value={connection}
            ariaLabel={t('people.connections.optional')}
            disabled={busy || created !== null}
            options={[
              { value: '', label: t('people.connections.none') },
              ...STANDARD_CONNECTION_LABELS.map(({ value, message }) => ({
                value,
                label: t(message),
              })),
            ]}
            onChange={setConnection}
          />
        </div>
      </div>
      <footer className="record-overlay__footer people-quick-create__footer">
        <button
          type="button"
          className="button button--secondary"
          disabled={busy}
          onClick={close}
        >
          {t('people.cancel')}
        </button>
        <button
          type="button"
          className="button button--primary"
          disabled={!valid || busy}
          onClick={() => void create()}
        >
          {t(
            busy
              ? 'people.saving'
              : people.state.quickCreateFailure || handoffFailed
                ? 'people.retry'
                : 'people.create.continue',
          )}
        </button>
      </footer>
    </RecordOverlay>
  )
}
