/**
 * The cells of the expandable calendar.
 *
 * Every cell is one `CalendarDay` the core placed, rendered in the order it
 * arrived. This file numbers nothing, names no weekday, decides no month
 * boundary, and inserts no leading or trailing blanks: an out-of-month day is
 * one the core marked as such, and the grid is as wide as the week the core
 * returned, so a calendar with a different week length would lay itself out
 * correctly without a change here.
 *
 * Keyboard movement is movement through that returned collection — one cell,
 * one row, or one end at a time — and never movement through dates. Moving the
 * focus selects nothing; a cell is chosen by activating it, like any button.
 *
 * One cell at a time is in the tab order. It starts on the date the core
 * focused and follows the focus from then on, so leaving and returning to the
 * calendar comes back to where the reader was rather than to its first day.
 */

import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { CalendarDay, CivilDate } from '../../../core/client'
import { useFormat } from '../../../i18n'

export interface RecordCalendarCellsProps {
  readonly id?: string
  readonly days: readonly CalendarDay[]
  /** The core-returned week that remains present in both calendar states. */
  readonly selectedWeek: readonly CalendarDay[]
  /** How many cells make one row. Taken from the week the core returned. */
  readonly columns: number
  /** The accessible name of this collection of cells. */
  readonly label: string
  /** The date the core says is focused. Marks the pressed cell. */
  readonly focusedDate: CivilDate
  /** The device's civil day. Marks the current cell. */
  readonly today: CivilDate
  /** Surrounding rows are visible only while the calendar is expanded. */
  readonly expanded: boolean
  readonly onSelect: (date: CivilDate) => void
}

/** The roving tab stop, and the focused date it was last synchronised with. */
interface Roving {
  readonly from: number
  readonly index: number
}

export function RecordCalendarCells({
  id,
  days,
  selectedWeek,
  columns,
  label,
  focusedDate,
  today,
  expanded,
  onSelect,
}: RecordCalendarCellsProps) {
  const format = useFormat()
  const cells = useRef<(HTMLButtonElement | null)[]>([])
  const selectedWeekDates = new Set(selectedWeek.map((day) => day.date))
  const visible = days
    .map((day, index) =>
      expanded || selectedWeekDates.has(day.date) ? index : null,
    )
    .filter((index): index is number => index !== null)
  const selected = days.findIndex((day) => day.date === focusedDate)
  const start = visible.includes(selected) ? selected : (visible[0] ?? 0)
  const [roving, setRoving] = useState<Roving>({ from: start, index: start })

  /*
   * When the core focuses another date the tab stop follows it. Adjusting
   * during render rather than in an effect keeps the two from disagreeing for
   * a frame.
   */
  if (roving.from !== start) setRoving({ from: start, index: start })
  const active = visible.includes(roving.index)
    ? roving.index
    : (visible[0] ?? 0)

  const rove = (to: number) => {
    setRoving((current) =>
      current.index === to ? current : { ...current, index: to },
    )
  }

  const move = (to: number) => {
    const activePosition = Math.max(visible.indexOf(active), 0)
    const clampedPosition = Math.min(
      Math.max(to, 0),
      Math.max(visible.length - 1, 0),
    )
    const index = visible[clampedPosition] ?? visible[activePosition] ?? 0
    rove(index)
    cells.current[index]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const activePosition = Math.max(visible.indexOf(active), 0)
    const step = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns,
    }[event.key]
    if (step !== undefined) {
      move(activePosition + step)
    } else if (event.key === 'Home') {
      move(0)
    } else if (event.key === 'End') {
      move(visible.length - 1)
    } else {
      return
    }
    event.preventDefault()
  }

  return (
    <div
      id={id}
      className="record-calendar__cells"
      role="group"
      aria-label={label}
      style={{ '--record-calendar-columns': columns } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      {days.map((day, index) => (
        <button
          key={day.date}
          ref={(element) => {
            cells.current[index] = element
          }}
          type="button"
          className="record-calendar__day"
          data-selected-week={
            selectedWeekDates.has(day.date) ? 'true' : undefined
          }
          data-outside={day.withinFocusedMonth ? undefined : 'true'}
          hidden={!expanded && !selectedWeekDates.has(day.date)}
          aria-label={format.civilDate(day.date)}
          aria-pressed={day.date === focusedDate}
          aria-current={day.date === today ? 'date' : undefined}
          tabIndex={index === active ? 0 : -1}
          onFocus={() => rove(index)}
          onClick={() => onSelect(day.date)}
        >
          {selectedWeekDates.has(day.date) ? (
            <span className="record-calendar__weekday" aria-hidden="true">
              {format.civilWeekday(day.date, 'narrow')}
            </span>
          ) : null}
          <span className="record-calendar__number" aria-hidden="true">
            {format.civilDayOfMonth(day.date)}
          </span>
        </button>
      ))}
    </div>
  )
}

/**
 * The month grid's column headings, named from the week the core returned.
 *
 * They repeat what each cell's own accessible name already says, so they are
 * decoration for sighted readers and hidden from assistive technology rather
 * than announced as a second row of dates.
 */
export function RecordCalendarHeadings({
  week,
}: {
  readonly week: readonly CalendarDay[]
}) {
  const format = useFormat()
  return (
    <div
      className="record-calendar__cells record-calendar__cells--headings"
      aria-hidden="true"
      style={{ '--record-calendar-columns': week.length } as CSSProperties}
    >
      {week.map((day) => (
        <span key={day.date} className="record-calendar__heading">
          {format.civilWeekday(day.date, 'narrow')}
        </span>
      ))}
    </div>
  )
}
