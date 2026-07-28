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

  /*
   * Object selection. The ordinary entry is named by the scale it belongs to,
   * because "the entry" means a different span of time at each one.
   */
  'record.objects.label': 'Object',
  'record.objects.ordinaryDay': 'Day entry',
  'record.objects.ordinaryWeek': 'Week entry',
  'record.objects.ordinaryMonth': 'Month entry',
  'record.objects.ordinaryYear': 'Year entry',
  'record.objects.kindEvent': 'Event',
  'record.objects.kindSpan': 'Span',

  /*
   * The spoken name of one object. Duplicate titles are allowed and several
   * Events may share a date, so the whole phrase is one message: a name built
   * from fragments cannot be reordered or inflected in another language.
   */
  'record.objects.eventName': 'Event: {title}, {date}',
  'record.objects.spanName': 'Span: {title}, {start} to {end}',
  'record.objects.spanOngoingName': 'Span: {title}, {start} to Present',
  'record.objects.spanOngoingRange': '{start} to Present',

  'record.objects.add': 'Add',
  'record.objects.addUnavailable':
    'Creating Events and Spans is not available in this version.',

  /*
   * Broader scales offer a count and a picker rather than a tab for every
   * overlapping object. The count is the size of the one page the archive
   * returned, and when that page was filled the wording says so instead of
   * letting a page size read as a total.
   */
  'record.objects.count': 'Objects ({count})',
  'record.objects.groupEvents': 'Events',
  'record.objects.groupSpans': 'Spans',
  'record.objects.none': 'No Events or Spans in this period.',
  'record.objects.noneUnplaced': 'No period is being shown.',
  'record.objects.bounded':
    'The first {count} were read. There may be more in this period.',
  'record.objects.unavailableDetail':
    'The objects in this period could not be read, so none are listed. Nothing was changed.',

  /* What happened to an object a reader asked for and is not now editing. */
  'record.objects.notice.elsewhere':
    '{title} is not in the period being shown, so the ordinary entry is selected.',
  'record.objects.notice.deleted': '{title} is no longer in this archive.',
  'record.objects.notice.missing': 'That object is not in this archive.',
  'record.objects.notice.goTo': 'Go to {title}',
  'record.objects.notice.dismiss': 'Dismiss',

  /* The details region. */
  'record.objects.detailsOrdinary': 'Ordinary entry',
  'record.objects.detailsWhen': 'When',
  'record.objects.detailsIdentifier': 'Identifier',
  'record.objects.detailsNoWindow': 'No period is being shown.',
} as const
