import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { useFormat, useTranslate } from '../../../i18n'
import { RecordControlIcon, RecordOverlay } from '../overlays'

interface DateParts {
  readonly year: number
  readonly month: number
  readonly day: number
}

interface CalendarMonth {
  readonly year: number
  readonly month: number
}

const CALENDAR_CELL_COUNT = 42

function utcDate({ year, month, day }: DateParts): Date {
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  return date
}

function parseDate(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
  const date = utcDate(parts)
  return date.getUTCFullYear() === parts.year &&
    date.getUTCMonth() + 1 === parts.month &&
    date.getUTCDate() === parts.day
    ? parts
    : null
}

function canonicalDate(parts: DateParts): string {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function todayParts(): DateParts {
  const today = new Date()
  return {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  }
}

function monthFor(value: string): CalendarMonth {
  const parts = parseDate(value) ?? todayParts()
  return { year: parts.year, month: parts.month }
}

function shiftMonth(current: CalendarMonth, amount: number): CalendarMonth {
  const shifted = utcDate({
    year: current.year,
    month: current.month + amount,
    day: 1,
  })
  return {
    year: Math.min(Math.max(shifted.getUTCFullYear(), 1), 9999),
    month: shifted.getUTCMonth() + 1,
  }
}

function monthDays(month: CalendarMonth): readonly string[] {
  const first = utcDate({ ...month, day: 1 })
  const leadingDays = (first.getUTCDay() + 6) % 7
  return Array.from({ length: CALENDAR_CELL_COUNT }, (_, index) => {
    const date = utcDate({
      ...month,
      day: index - leadingDays + 1,
    })
    return canonicalDate({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    })
  })
}

export function RecordDatePicker({
  value,
  label,
  disabled = false,
  invalid = false,
  widthRef,
  onChange,
}: {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean
  readonly invalid?: boolean
  readonly widthRef?: RefObject<HTMLElement | null>
  readonly onChange: (value: string) => void
}) {
  const t = useTranslate()
  const format = useFormat()
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState<CalendarMonth>(() =>
    monthFor(value),
  )
  const [editingYear, setEditingYear] = useState(false)
  const [yearDraft, setYearDraft] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const selectedDay = useRef<HTMLButtonElement>(null)
  const firstMonthDay = useRef<HTMLButtonElement>(null)
  const monthYearButton = useRef<HTMLButtonElement>(null)
  const yearInput = useRef<HTMLInputElement>(null)
  const menuId = useId()
  const triggerId = useId()
  const selected = parseDate(value)
  const selectedValue = selected ? canonicalDate(selected) : null
  const today = canonicalDate(todayParts())
  const days = monthDays(viewMonth)
  const monthStart = canonicalDate({ ...viewMonth, day: 1 })
  const displayedYear = format.civilYear(monthStart)
  const displayValue = selectedValue
    ? format.civilDate(selectedValue, 'short')
    : 'YYYY-MM-DD'
  const triggerLabel = selectedValue
    ? t('record.datePicker.trigger', {
        label,
        date: format.civilDate(selectedValue),
      })
    : t('record.datePicker.triggerEmpty', { label })

  const focusCalendar = () => {
    globalThis.queueMicrotask(() => {
      ;(selectedDay.current ?? firstMonthDay.current)?.focus()
    })
  }
  const openMenu = () => {
    setViewMonth(monthFor(value))
    setEditingYear(false)
    setOpen(true)
    focusCalendar()
  }
  const closeMenu = (restoreFocus = true) => {
    setEditingYear(false)
    setOpen(false)
    if (restoreFocus) {
      globalThis.queueMicrotask(() => trigger.current?.focus())
    }
  }
  const choose = (nextValue: string) => {
    onChange(nextValue)
    closeMenu()
  }
  const moveMonth = (amount: number) => {
    setViewMonth((current) => shiftMonth(current, amount))
    focusCalendar()
  }
  const focusMonthYearButton = () => {
    globalThis.queueMicrotask(() => monthYearButton.current?.focus())
  }
  const startYearEdit = () => {
    setYearDraft(String(viewMonth.year))
    setEditingYear(true)
  }
  const finishYearEdit = (apply: boolean, restoreFocus = true) => {
    const nextYear = /^\d{1,4}$/.test(yearDraft) ? Number(yearDraft) : 0
    if (apply && nextYear >= 1 && nextYear <= 9999) {
      setViewMonth((current) => ({ ...current, year: nextYear }))
    }
    setEditingYear(false)
    if (restoreFocus) focusMonthYearButton()
  }

  useEffect(() => {
    if (!editingYear) return
    yearInput.current?.focus()
    yearInput.current?.select()
  }, [editingYear])

  const onDayKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const rowStart = Math.floor(index / 7) * 7
    const nextIndex =
      event.key === 'ArrowLeft'
        ? index - 1
        : event.key === 'ArrowRight'
          ? index + 1
          : event.key === 'ArrowUp'
            ? index - 7
            : event.key === 'ArrowDown'
              ? index + 7
              : event.key === 'Home'
                ? rowStart
                : event.key === 'End'
                  ? rowStart + 6
                  : null
    if (nextIndex !== null) {
      const target = event.currentTarget
        .closest('.record-date-picker__grid')
        ?.querySelectorAll<HTMLButtonElement>('.record-date-picker__day')
        .item(nextIndex)
      if (target) {
        event.preventDefault()
        target.focus()
      }
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      moveMonth(event.key === 'PageUp' ? -1 : 1)
    }
  }

  return (
    <div className="record-date-picker">
      <button
        id={triggerId}
        ref={trigger}
        type="button"
        className="record-date-picker__trigger"
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? closeMenu(false) : openMenu())}
      >
        <span>{displayValue}</span>
        <RecordControlIcon name="calendar" />
      </button>
      <RecordOverlay
        id={menuId}
        open={open}
        kind="menu"
        surfaceRole="dialog"
        labelledBy={triggerId}
        anchorRef={trigger}
        widthRef={widthRef}
        onClose={closeMenu}
        className="record-menu record-date-menu"
      >
        <div className="record-date-picker__calendar">
          <header className="record-date-picker__header">
            <button
              type="button"
              className="record-date-picker__month-step record-date-picker__month-step--previous"
              aria-label={t('record.navigation.previousMonth')}
              disabled={viewMonth.year === 1 && viewMonth.month === 1}
              onClick={() => moveMonth(-1)}
            >
              <RecordControlIcon name="next" />
            </button>
            {editingYear ? (
              <input
                ref={yearInput}
                className="record-date-picker__year-input"
                type="text"
                inputMode="numeric"
                enterKeyHint="done"
                pattern="[0-9]*"
                maxLength={4}
                autoComplete="off"
                spellCheck={false}
                aria-label={t('record.datePicker.yearInput')}
                value={yearDraft}
                onChange={(event) =>
                  setYearDraft(
                    event.currentTarget.value.replace(/\D/g, '').slice(0, 4),
                  )
                }
                onBlur={() => finishYearEdit(true, false)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    finishYearEdit(true)
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    event.stopPropagation()
                    finishYearEdit(false)
                  }
                }}
              />
            ) : (
              <button
                ref={monthYearButton}
                type="button"
                className="record-date-picker__month-year"
                aria-label={t('record.datePicker.changeYear', {
                  year: displayedYear,
                })}
                onClick={startYearEdit}
              >
                <strong>{format.civilMonthAndYear(monthStart)}</strong>
              </button>
            )}
            <button
              type="button"
              className="record-date-picker__month-step"
              aria-label={t('record.navigation.nextMonth')}
              disabled={viewMonth.year === 9999 && viewMonth.month === 12}
              onClick={() => moveMonth(1)}
            >
              <RecordControlIcon name="next" />
            </button>
          </header>
          <div className="record-date-picker__weekdays" aria-hidden="true">
            {days.slice(0, 7).map((date) => (
              <span key={date}>{format.civilWeekday(date, 'narrow')}</span>
            ))}
          </div>
          <div
            className="record-date-picker__grid"
            role="grid"
            aria-label={format.civilMonthAndYear(monthStart)}
          >
            {days.map((date, index) => {
              const parts = parseDate(date)!
              const inMonth =
                parts.year === viewMonth.year && parts.month === viewMonth.month
              return (
                <button
                  key={date}
                  ref={
                    date === selectedValue
                      ? selectedDay
                      : inMonth && parts.day === 1
                        ? firstMonthDay
                        : undefined
                  }
                  type="button"
                  className="record-date-picker__day"
                  role="gridcell"
                  aria-label={format.civilDate(date)}
                  aria-pressed={date === selectedValue}
                  aria-current={date === today ? 'date' : undefined}
                  data-outside-month={!inMonth || undefined}
                  tabIndex={
                    date === selectedValue ||
                    (!selectedValue && inMonth && parts.day === 1)
                      ? 0
                      : -1
                  }
                  onKeyDown={(event) => onDayKeyDown(event, index)}
                  onClick={() => choose(date)}
                >
                  {format.civilDayOfMonth(date)}
                </button>
              )
            })}
          </div>
          <footer className="record-date-picker__footer">
            <button type="button" onClick={() => choose(today)}>
              {t('record.navigation.today')}
            </button>
          </footer>
        </div>
      </RecordOverlay>
    </div>
  )
}
