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

  /* Markdown writing surface. Mock mode never makes a durability claim. */
  'record.editor.label': 'Writing',
  'record.editor.heading': 'Writing',
  'record.editor.toolbar': 'Text formatting',
  'record.editor.source': 'Writing editor',
  'record.editor.mockStatus':
    'Development preview. Changes remain in this tab only.',
  'record.editor.status.unavailable': 'Writing is unavailable.',
  'record.editor.status.mock':
    'Development preview. Changes remain in this tab only.',
  'record.editor.status.ready': 'Ready to save.',
  'record.editor.status.dirty': 'Unsaved changes.',
  'record.editor.status.saving': 'Saving…',
  'record.editor.status.saved': 'Saved.',
  'record.editor.status.failed': 'The save did not complete.',
  'record.editor.status.conflicted':
    'The save stopped because the archive changed.',
  'record.editor.status.offlineRuntime':
    'The archive runtime is offline. Unsaved writing remains in this tab.',
  'record.editor.retrySave': 'Try saving again',
  'record.editor.saveFailed':
    'The save did not complete. The editor buffer was kept. {detail}',
  'record.editor.conflictTitle': 'Choose which writing to keep',
  'record.editor.conflictDetail':
    'Your writing remains in the editor. Nothing will be combined or overwritten until you choose.',
  'record.editor.conflictCurrent': 'Writing currently in the archive',
  'record.editor.conflictCurrentEmpty': 'No current writing',
  'record.editor.conflictSaveMine': 'Save my writing',
  'record.editor.conflictUseArchive': 'Use archive writing',
  'record.editor.loading': 'Reading the selected writing.',
  'record.editor.loadFailed':
    'The selected writing could not be read. The editor buffer was kept. {detail}',
  'record.editor.retry': 'Try reading again',
  'record.editor.placeholder': 'Continue writing…',
  'record.editor.undo': 'Undo',
  'record.editor.redo': 'Redo',
  'record.editor.undoShortcut': 'Undo (Ctrl or Command+Z)',
  'record.editor.redoShortcut': 'Redo (Ctrl or Command+Shift+Z)',
  'record.editor.blockStyle': 'Text style',
  'record.editor.paragraph': 'Paragraph',
  'record.editor.headingTwo': 'Heading',
  'record.editor.headingThree': 'Subheading',
  'record.editor.bold': 'Bold',
  'record.editor.boldShortcut': 'Bold (Ctrl or Command+B)',
  'record.editor.boldPlaceholder': 'bold text',
  'record.editor.italic': 'Italic',
  'record.editor.italicShortcut': 'Italic (Ctrl or Command+I)',
  'record.editor.italicPlaceholder': 'italic text',
  'record.editor.list': 'Bulleted list',
  'record.editor.listShortcut': 'Bulleted list (Ctrl or Command+Shift+8)',
  'record.editor.orderedList': 'Numbered list',
  'record.editor.orderedListShortcut':
    'Numbered list (Ctrl or Command+Shift+7)',
  'record.editor.quote': 'Quote',
  'record.editor.link': 'Link',
  'record.editor.unlink': 'Remove link',
  'record.editor.linkShortcut': 'Link (Ctrl or Command+K)',
  'record.editor.linkPlaceholder': 'link text',
  'record.editor.linkDialog': 'Insert link',
  'record.editor.linkAddress': 'Web address',
  'record.editor.linkApply': 'Apply link',
  'record.editor.linkCancel': 'Cancel',
  'record.editor.linkInvalid':
    'Enter a web address beginning with http, https, or mailto.',
} as const
