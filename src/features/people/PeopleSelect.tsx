import { useId, useRef, useState } from 'react'
import { useMenuRovingFocus } from '../../ui/menu'
import { RecordControlIcon, RecordOverlay } from '../../ui/overlay'

export interface PeopleSelectOption<Value extends string> {
  readonly value: Value
  readonly label: string
}

/** Compact app-menu select used by People forms instead of a native popup. */
export function PeopleSelect<Value extends string>({
  value,
  options,
  ariaLabel,
  disabled = false,
  onChange,
}: {
  readonly value: Value
  readonly options: readonly PeopleSelectOption<Value>[]
  readonly ariaLabel: string
  readonly disabled?: boolean
  readonly onChange: (value: Value) => void
}) {
  const menuId = useId()
  const triggerId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)
  const close = () => {
    setOpen(false)
    globalThis.queueMicrotask(() => trigger.current?.focus())
  }
  const menuFocus = useMenuRovingFocus({ onEscape: close, wrap: true })
  const openFromKeyboard = (index: number) => {
    setOpen(true)
    globalThis.queueMicrotask(() => menuFocus.focus(index))
  }

  return (
    <>
      <button
        id={triggerId}
        ref={trigger}
        type="button"
        className="person-select"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault()
            openFromKeyboard(
              event.key === 'ArrowDown'
                ? Math.max(
                    0,
                    options.findIndex((option) => option.value === value),
                  )
                : options.length - 1,
            )
          }
        }}
      >
        <span>{selected?.label ?? value}</span>
        <RecordControlIcon name="expand" />
      </button>
      <RecordOverlay
        id={menuId}
        open={open}
        kind="menu"
        labelledBy={triggerId}
        anchorRef={trigger}
        onClose={close}
        className="record-menu person-select-menu"
      >
        <div className="record-menu__items" onKeyDown={menuFocus.onKeyDown}>
          {options.map((option, index) => {
            const checked = option.value === value
            return (
              <button
                key={option.value}
                ref={menuFocus.itemRef(index)}
                type="button"
                className="record-menu__item person-select-menu__option"
                role="menuitemradio"
                aria-checked={checked}
                onClick={() => {
                  onChange(option.value)
                  close()
                }}
              >
                <span>{option.label}</span>
                <span className="person-select-menu__check" aria-hidden="true">
                  {checked ? <RecordControlIcon name="check" /> : null}
                </span>
              </button>
            )
          })}
        </div>
      </RecordOverlay>
    </>
  )
}
