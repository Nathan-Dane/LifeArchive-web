/**
 * Record copy.
 *
 * Record owns the presentation names for the semantic icon and tag IDs it
 * displays: the core supplies the ID, this catalog supplies the word. There
 * are no approved semantic IDs in v0.1.0 yet, so nothing here names one; an ID
 * without a name here stays exact on screen and takes the neutral fallback in
 * `semantic.ts`.
 *
 * Time navigation says nothing about *when* anything is. Every date, weekday,
 * month, and period a reader sees is spelled by `format.ts` from a value the
 * core produced, so no key here holds a date fragment and no phrase implies
 * one period contains, follows, or precedes another.
 */
export const recordMessages = {
  'record.page.title': 'Record',

  /* The navigation region as a whole, and the scale it is showing. */
  'record.navigation.label': 'Time',
  'record.navigation.scaleLabel': 'Scale',
  'record.navigation.scaleDay': 'Day',
  'record.navigation.scaleWeek': 'Week',
  'record.navigation.scaleMonth': 'Month',
  'record.navigation.scaleYear': 'Year',

  /*
   * Every gesture the native application answers with a swipe has a named
   * control here, and the name says which scale the step moves by.
   */
  'record.navigation.previousDay': 'Previous day',
  'record.navigation.previousWeek': 'Previous week',
  'record.navigation.previousMonth': 'Previous month',
  'record.navigation.previousYear': 'Previous year',
  'record.navigation.nextDay': 'Next day',
  'record.navigation.nextWeek': 'Next week',
  'record.navigation.nextMonth': 'Next month',
  'record.navigation.nextYear': 'Next year',
  'record.navigation.today': 'Today',

  /* The expandable calendar. The toggle carries the expanded state. */
  'record.navigation.expandCalendar': 'Show the surrounding month',
  'record.navigation.collapseCalendar': 'Show one week only',
  'record.navigation.weekCells': 'Week of the selected date',
  'record.navigation.monthCells': 'Month around the selected date',

  'record.navigation.loading': 'Reading time navigation',
  'record.navigation.unavailableTitle': 'Time navigation is unavailable',
  'record.navigation.unavailableDetail':
    'This view could not read a calendar from the archive, so it is showing none rather than a guessed one. Nothing was changed.',
} as const
