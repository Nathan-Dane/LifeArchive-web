import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type {
  LifeArchiveClient,
  PersonSnapshot,
  StableId,
} from '../../core/client'
import { useTranslate } from '../../i18n'
import { RecordControlIcon, RecordOverlay } from '../../ui/overlay'
import { PeopleManager } from './PeopleManager'
import { PersonAvatar } from './PersonAvatar'
import { PersonDetails } from './PersonDetails'
import { usePeople } from './usePeople'

export function PeopleChooser({
  client,
  value,
  triggerLabel,
  disabled = false,
  onChange,
}: {
  readonly client: LifeArchiveClient
  readonly value: readonly StableId[]
  readonly triggerLabel?: string
  readonly disabled?: boolean
  readonly onChange: (
    ids: readonly StableId[],
  ) => void | boolean | Promise<void | boolean>
}) {
  const t = useTranslate()
  const people = usePeople(client)
  const [menuOpen, setMenuOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const [taskClosing, setTaskClosing] = useState(false)
  const [managerScroll, setManagerScroll] = useState(0)
  const [managerArchived, setManagerArchived] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()
  const triggerId = useId()
  const summaryId = useId()
  const managerHeading = useId()
  const editorHeading = useId()
  const available = people.state.people.filter(
    ({ person }) => !person.isArchived,
  )
  const listPeople = people.list
  const listedQuery = people.state.listedQuery

  useEffect(() => {
    if (!menuOpen || pickerQuery === listedQuery) return
    const timer = globalThis.setTimeout(() => void listPeople(pickerQuery), 250)
    return () => globalThis.clearTimeout(timer)
  }, [listPeople, listedQuery, menuOpen, pickerQuery])

  const closeMenu = (restore = true) => {
    setMenuOpen(false)
    if (restore) globalThis.queueMicrotask(() => trigger.current?.focus())
  }
  const toggle = async (id: StableId) => {
    await onChange(
      value.includes(id)
        ? value.filter((current) => current !== id)
        : [...value, id],
    )
  }
  const moveFocus = (index: number) => {
    const candidates = items.current.filter(
      (item): item is HTMLButtonElement => item !== null,
    )
    const bounded = Math.max(0, Math.min(index, candidates.length - 1))
    candidates[bounded]?.focus()
  }
  const onMenuKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const candidates = items.current.filter(
      (item): item is HTMLButtonElement => item !== null,
    )
    const current = candidates.indexOf(
      document.activeElement as HTMLButtonElement,
    )
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
      return
    }
    if (current < 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight')
      moveFocus(current + 1)
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft')
      moveFocus(current - 1)
    else if (event.key === 'Home') moveFocus(0)
    else if (event.key === 'End') moveFocus(candidates.length - 1)
    else return
    event.preventDefault()
  }
  const closeTask = () => {
    setTaskClosing(true)
  }
  const back = () => {
    people.closeEditor()
    globalThis.queueMicrotask(() => close.current?.focus())
  }
  const openManager = () => {
    closeMenu(false)
    setManagerOpen(true)
  }
  const quickCreate = () => {
    closeMenu(false)
    people.startCreate()
  }
  const summary =
    value.length === 0
      ? t('record.people.count', { count: 0 })
      : t('record.people.count', { count: value.length })

  return (
    <>
      <button
        id={triggerId}
        ref={trigger}
        type="button"
        className="record-track-chooser people-chooser"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-describedby={summaryId}
        disabled={disabled}
        onClick={() => {
          setMenuOpen((open) => {
            if (!open) {
              setPickerQuery('')
              if (people.state.listedQuery !== '') void people.list('')
            }
            return !open
          })
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && menuOpen) {
            event.preventDefault()
            closeMenu()
          } else if (
            (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
            !menuOpen
          ) {
            event.preventDefault()
            setPickerQuery('')
            if (people.state.listedQuery !== '') void people.list('')
            setMenuOpen(true)
            globalThis.queueMicrotask(() =>
              moveFocus(
                event.key === 'ArrowDown' ? 0 : items.current.length - 1,
              ),
            )
          }
        }}
      >
        <span className="record-track-chooser__icon" aria-hidden="true">
          <RecordControlIcon name="manage" />
        </span>
        <span className="record-track-chooser__name">
          {triggerLabel ?? summary}
        </span>
        <span className="record-track-chooser__chevron" aria-hidden="true">
          <RecordControlIcon name="expand" />
        </span>
      </button>
      <span id={summaryId} className="visually-hidden">
        {summary}
      </span>
      <RecordOverlay
        id={menuId}
        open={menuOpen}
        kind="menu"
        labelledBy={triggerId}
        anchorRef={trigger}
        onClose={() => closeMenu()}
        className="record-menu record-track-menu people-menu"
      >
        <div
          className="record-menu__items record-track-menu__items"
          onKeyDown={onMenuKeyDown}
        >
          <div className="people-menu__search" role="none">
            <label>
              <span className="visually-hidden">{t('people.search')}</span>
              <input
                type="search"
                role="searchbox"
                value={pickerQuery}
                placeholder={t('people.search.placeholder')}
                onChange={(event) => setPickerQuery(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    closeMenu()
                  } else if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    moveFocus(0)
                  }
                }}
              />
            </label>
          </div>
          {available.map((snapshot, index) => {
            const checked = value.includes(snapshot.person.id)
            return (
              <button
                key={snapshot.person.id}
                ref={(element) => {
                  items.current[index] = element
                }}
                type="button"
                role="menuitemcheckbox"
                aria-checked={checked}
                className="record-menu__item"
                onClick={() => void toggle(snapshot.person.id)}
              >
                <PersonAvatar
                  client={client}
                  name={snapshot.person.displayName}
                  photo={snapshot.profilePhoto}
                  size="small"
                />
                <span>{snapshot.person.displayName}</span>
                <span
                  className="record-track-menu__selected"
                  aria-hidden="true"
                >
                  {checked ? <RecordControlIcon name="check" /> : null}
                </span>
              </button>
            )
          })}
          {people.state.hasMore ? (
            <button
              ref={(element) => {
                items.current[available.length] = element
              }}
              type="button"
              role="menuitem"
              className="record-menu__item record-track-menu__action"
              onClick={() => void people.loadMore()}
            >
              <RecordControlIcon name="expand" />
              <span>{t('people.loadMore')}</span>
            </button>
          ) : null}
          <span className="record-track-menu__separator" role="separator" />
          <button
            ref={(element) => {
              items.current[available.length + (people.state.hasMore ? 1 : 0)] =
                element
            }}
            type="button"
            role="menuitem"
            className="record-menu__item record-track-menu__action record-track-menu__action--primary"
            onClick={quickCreate}
          >
            <RecordControlIcon name="add" />
            <span>{t('people.new')}</span>
          </button>
          <button
            ref={(element) => {
              items.current[available.length + (people.state.hasMore ? 2 : 1)] =
                element
            }}
            type="button"
            role="menuitem"
            className="record-menu__item record-track-menu__action"
            onClick={openManager}
          >
            <RecordControlIcon name="manage" />
            <span>{t('people.manage')}</span>
          </button>
        </div>
      </RecordOverlay>
      <RecordOverlay
        open={!taskClosing && (managerOpen || people.active)}
        kind="modal"
        labelledBy={people.active ? editorHeading : managerHeading}
        anchorRef={trigger}
        initialFocusRef={close}
        onClose={closeTask}
        onClosed={() => {
          setManagerOpen(false)
          people.closeEditor()
          setTaskClosing(false)
        }}
        className={people.active ? 'person-editor' : 'people-manager'}
      >
        {people.active ? (
          <PersonDetails
            client={client}
            people={people}
            headingId={editorHeading}
            closeRef={close}
            onBack={managerOpen ? back : undefined}
            onClose={closeTask}
            onCreated={(snapshot) => {
              if (managerOpen) {
                back()
              } else {
                return Promise.resolve(
                  onChange([...value, snapshot.person.id]),
                ).then((accepted) => {
                  if (accepted !== false) closeTask()
                  return accepted
                })
              }
            }}
          />
        ) : (
          <PeopleManager
            client={client}
            people={people}
            headingId={managerHeading}
            closeRef={close}
            initialScroll={managerScroll}
            initialShowArchived={managerArchived}
            onScrollChange={setManagerScroll}
            onShowArchivedChange={setManagerArchived}
            onClose={closeTask}
            onCreate={people.startCreate}
            onSelect={(snapshot: PersonSnapshot) =>
              void people.select(snapshot)
            }
          />
        )}
      </RecordOverlay>
    </>
  )
}
