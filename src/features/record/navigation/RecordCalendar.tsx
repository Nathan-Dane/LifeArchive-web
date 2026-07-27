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
  /** How many cells make one row. Taken from the week the core returned. */
  readonly columns: number
  /** The accessible name of this collection of cells. */
  readonly label: string
  /** The date the core says is focused. Marks the pressed cell. */
  readonly focusedDate: CivilDate
  /** The device's civil day. Marks the current cell. */
  readonly today: CivilDate
  /** Whether each cell also names its weekday, as the week strip does. */
  readonly showWeekday?: boolean
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
  columns,
  label,
  focusedDate,
  today,
  showWeekday,
  onSelect,
}: RecordCalendarCellsProps) {
  const format = useFormat()
  const cells = useRef<(HTMLButtonElement | null)[]>([])
  const selected = days.findIndex((day) => day.date === focusedDate)
  const start = selected < 0 ? 0 : selected
  const [roving, setRoving] = useState<Roving>({ from: start, index: start })

  /*
   * When the core focuses another date the tab stop follows it. Adjusting
   * during render rather than in an effect keeps the two from disagreeing for
   * a frame.
   */
  if (roving.from !== start) setRoving({ from: start, index: start })
  const active = Math.min(
    Math.max(roving.index, 0),
    Math.max(days.length - 1, 0),
  )

  const rove = (to: number) => {
    setRoving((current) =>
      current.index === to ? current : { ...current, index: to },
    )
  }

  const move = (to: number) => {
    const clamped = Math.min(Math.max(to, 0), days.length - 1)
    rove(clamped)
    cells.current[clamped]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns,
    }[event.key]
    if (step !== undefined) {
      move(active + step)
    } else if (event.key === 'Home') {
      move(0)
    } else if (event.key === 'End') {
      move(days.length - 1)
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
          data-outside={day.withinFocusedMonth ? undefined : 'true'}
          aria-label={format.civilDate(day.date)}
          aria-pressed={day.date === focusedDate}
          aria-current={day.date === today ? 'date' : undefined}
          tabIndex={index === active ? 0 : -1}
          onFocus={() => rove(index)}
          onClick={() => onSelect(day.date)}
        >
          {showWeekday ? (
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
