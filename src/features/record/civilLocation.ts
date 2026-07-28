/**
 * Spelling the civil location of a window.
 *
 * A window covering one day is spelled as that day; a wider one is spelled as
 * the inclusive range the core gave it, rather than as a name for the period.
 * Naming periods is where a frontend starts deciding which weeks and months
 * exist, so this reads the two civil bounds the core produced and nothing
 * else.
 */

import type { TimeWindow } from '../../core/client'
import type { Formatters } from '../../i18n'

export function civilLocation(format: Formatters, window: TimeWindow): string {
  return window.startDate === window.endDate
    ? format.civilDate(window.startDate)
    : format.civilDateRange(window.startDate, window.endDate)
}
