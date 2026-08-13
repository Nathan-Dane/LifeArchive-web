import { useId, useRef, useState, type ReactNode } from 'react'
import { RecordControlIcon, RecordOverlay } from '../overlay'
import { useMenuRovingFocus } from './useMenuRovingFocus'

export interface SelectionMenuOption<Value extends string> {
  readonly value: Value
  readonly label: string
}

export interface SelectionMenuMainAction {
  readonly label: string
  readonly accessibleLabel: string
}

export interface SelectionMenuProps<Value extends string> {
  readonly options: readonly SelectionMenuOption<Value>[]
  readonly selected: readonly Value[]
  readonly primary?: Value | null
  readonly multiple?: boolean
  readonly allowPrimary?: boolean
  readonly disableCurrentPrimary?: boolean
  readonly disabled?: boolean
  readonly menuLabel: string
  readonly triggerLabel: string
  readonly className?: string
  readonly assignedClassName?: string
  readonly menuClassName?: string
  readonly listClassName?: string
  readonly rowClassName?: (
    option: SelectionMenuOption<Value>,
  ) => string | undefined
  readonly renderAssigned: (
    option: SelectionMenuOption<Value>,
    primary: boolean,
  ) => ReactNode
  readonly renderOption: (
    option: SelectionMenuOption<Value>,
    selected: boolean,
  ) => ReactNode
  readonly mainAction?: (
    option: SelectionMenuOption<Value>,
    primary: boolean,
  ) => SelectionMenuMainAction
  readonly footer?: ReactNode
  readonly onOpen?: () => void
  readonly onSelectionChange: (selected: readonly Value[]) => void
  readonly onPrimaryChange?: (value: Value) => void
}

/**
 * Shared anchored selection surface for small app-owned taxonomies.
 *
 * Features supply only their item rendering and optional footer. Selection,
 * primary-item choice, opener handling, keyboard movement, and menu semantics
 * remain identical whether the values are tags, Person connections, or a
 * future single-choice collection.
 */
export function SelectionMenu<Value extends string>({
  options,
  selected,
  primary = null,
  multiple = false,
  allowPrimary = false,
  disableCurrentPrimary = false,
  disabled = false,
  menuLabel,
  triggerLabel,
  className,
  assignedClassName,
  menuClassName,
  listClassName,
  rowClassName,
  renderAssigned,
  renderOption,
  mainAction,
  footer,
  onOpen,
  onSelectionChange,
  onPrimaryChange,
}: SelectionMenuProps<Value>) {
  const [open, setOpen] = useState(false)
  const [keyboardNavigation, setKeyboardNavigation] = useState(false)
  const assigned = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  const menuId = useId()
  const menuLabelId = useId()
  const menuFocus = useMenuRovingFocus({
    wrap: true,
    onNavigate: () => setKeyboardNavigation(true),
  })
  const optionByValue = new Map(options.map((option) => [option.value, option]))
  const assignedValues = [
    ...(primary && selected.includes(primary) ? [primary] : []),
    ...selected.filter((value) => value !== primary),
  ]

  const focusFirstMenuItem = () => {
    setKeyboardNavigation(true)
    globalThis.queueMicrotask(() => menuFocus.focus(0))
  }
  const openMenu = (nextOpener: HTMLButtonElement, focusFirst: boolean) => {
    opener.current = nextOpener
    onOpen?.()
    setOpen(true)
    setKeyboardNavigation(focusFirst)
    if (focusFirst) focusFirstMenuItem()
  }
  const closeMenu = (restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) {
      const focusTarget = opener.current
      globalThis.queueMicrotask(() => focusTarget?.focus())
    }
  }
  const toggle = (value: Value) => {
    const isSelected = selected.includes(value)
    if (multiple) {
      onSelectionChange(
        isSelected
          ? selected.filter((candidate) => candidate !== value)
          : [...selected, value],
      )
      return
    }
    onSelectionChange(isSelected ? [] : [value])
    closeMenu(false)
  }

  return (
    <div className={['selection-picker', className].filter(Boolean).join(' ')}>
      <span id={menuLabelId} className="visually-hidden">
        {menuLabel}
      </span>
      <div
        ref={assigned}
        className={['selection-picker__assigned', assignedClassName]
          .filter(Boolean)
          .join(' ')}
      >
        {assignedValues.map((value) => {
          const option = optionByValue.get(value)
          if (!option) return null
          return (
            <button
              key={value}
              type="button"
              className="selection-picker__assigned-trigger"
              disabled={disabled}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={menuId}
              onClick={(event) =>
                openMenu(event.currentTarget, event.detail === 0)
              }
            >
              {renderAssigned(option, value === primary)}
            </button>
          )
        })}
        <button
          type="button"
          className="selection-picker__trigger"
          disabled={disabled}
          aria-label={triggerLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={(event) => openMenu(event.currentTarget, event.detail === 0)}
          onKeyDown={(event) => {
            if (
              open &&
              (event.key === 'ArrowDown' || event.key === 'ArrowUp')
            ) {
              event.preventDefault()
              focusFirstMenuItem()
            }
          }}
        >
          <RecordControlIcon name="add" />
        </button>
      </div>
      <RecordOverlay
        id={menuId}
        open={open}
        kind="menu"
        labelledBy={menuLabelId}
        anchorRef={assigned}
        onClose={closeMenu}
        className={['record-menu', 'selection-menu', menuClassName]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          className={[
            'record-menu__items',
            'selection-menu__list',
            listClassName,
          ]
            .filter(Boolean)
            .join(' ')}
          data-keyboard-navigation={keyboardNavigation}
          onKeyDown={menuFocus.onKeyDown}
          onPointerMove={() => setKeyboardNavigation(false)}
        >
          {options.map((option, index) => {
            const isSelected = selected.includes(option.value)
            const isPrimary = primary === option.value
            const action = mainAction?.(option, isPrimary)
            return (
              <div
                key={option.value}
                className={['selection-menu__row', rowClassName?.(option)]
                  .filter(Boolean)
                  .join(' ')}
                data-selected={isSelected || undefined}
                data-primary={isPrimary || undefined}
              >
                <button
                  ref={menuFocus.itemRef(index)}
                  type="button"
                  className="selection-menu__select"
                  role={multiple ? 'menuitemcheckbox' : 'menuitemradio'}
                  aria-checked={isSelected}
                  aria-label={option.label}
                  onPointerDown={() => setKeyboardNavigation(false)}
                  onClick={() => toggle(option.value)}
                >
                  {renderOption(option, isSelected)}
                  <span className="selection-menu__check" aria-hidden="true">
                    {isSelected ? <RecordControlIcon name="check" /> : null}
                  </span>
                </button>
                {allowPrimary && isSelected && action && onPrimaryChange ? (
                  <button
                    type="button"
                    className="selection-menu__main"
                    role="menuitem"
                    aria-label={action.accessibleLabel}
                    aria-pressed={isPrimary}
                    disabled={disableCurrentPrimary && isPrimary}
                    onPointerDown={() => setKeyboardNavigation(false)}
                    onClick={() => onPrimaryChange(option.value)}
                  >
                    {action.label}
                  </button>
                ) : null}
              </div>
            )
          })}
          {footer}
        </div>
      </RecordOverlay>
    </div>
  )
}
