/**
 * Record copy.
 *
 * Record owns the presentation names for the semantic icon and tag IDs it
 * displays: the core supplies the ID, the adjacent semantic catalog supplies
 * the word. An ID without a name stays exact on screen and takes the neutral
 * fallback in `semantic.ts`.
 *
 * Time navigation says nothing about *when* anything is. Every date, weekday,
 * month, and period a reader sees is spelled by `format.ts` from a value the
 * core produced, so no key here holds a date fragment and no phrase implies
 * one period contains, follows, or precedes another.
 */
export const recordMessages = {
  'record.page.title': 'Record',
  'record.page.kindEntry': 'Day Entry',
  'record.page.kindEvent': 'Event Entry',
  'record.page.kindSpan': 'Span Entry',
  'record.page.kindTrack': 'Track',

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
  'record.navigation.periodStrip': 'Periods around the selected period',

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
  'record.objects.groupEntry': 'Entry',
  'record.objects.noItems': 'No Items',
  'record.objects.newStructured': 'New event or span',
  'record.objects.closeCreateMenu': 'Close new record menu',

  /*
   * The spoken name of one object. Duplicate titles are allowed and several
   * Events may share a date, so the whole phrase is one message: a name built
   * from fragments cannot be reordered or inflected in another language.
   */
  'record.objects.eventName': 'Event: {title}, {date}',
  'record.objects.spanName': 'Span: {title}, {start} to {end}',
  'record.objects.spanOngoingName': 'Span: {title}, {start} to Present',
  'record.objects.spanOngoingRange': '{start} to Present',

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

  /* Details follows the reference hierarchy without adopting its placeholders. */
  'record.details.title': 'Details',
  'record.details.identity': 'Identity',
  'record.details.time': 'Time',
  'record.details.organisation': 'Organisation',

  'record.icon.pickerLabel': 'Choose an icon',
  'record.icon.trigger': 'Icon: {name}. Choose icon',
  'record.icon.cancel': 'Cancel',
  'record.icon.use': 'Use icon',
  'record.icon.groups': 'Icon categories',
  'record.icon.all': 'All icons',
  'record.icon.count': {
    one: '{count} icon',
    other: '{count} icons',
  },
  'record.icon.category.life-change': 'Life & Change',
  'record.icon.category.relationships-people': 'Relationships & People',
  'record.icon.category.home-possessions': 'Home & Possessions',
  'record.icon.category.work-money': 'Work & Money',
  'record.icon.category.learning-growth': 'Learning & Growth',
  'record.icon.category.travel-places': 'Travel & Places',
  'record.icon.category.health-wellbeing': 'Health & Wellbeing',
  'record.icon.category.creativity-projects': 'Creativity & Projects',
  'record.icon.category.achievement-sport': 'Achievement & Sport',
  'record.icon.category.hobbies-digital': 'Hobbies & Digital Life',
  'record.icon.category.nature-animals': 'Nature & Animals',
  'record.icon.category.occasions-general': 'Occasions & General',
  'record.tag.pickerLabel': 'Choose tags',
  'record.tag.pickerDetail': 'Select any number. Mark one as main.',
  'record.tag.main': 'Main',
  'record.tag.makeMain': 'Make {name} the main tag',
  'record.tag.mainLabel': '{name}, main tag',
  'record.tag.summary': '{count} selected',
  'record.tag.summaryWithMain': '{count} selected · {name} main',
  'record.tag.manage': 'Manage tags',
  'record.tag.close': 'Close tag picker',
  'record.tag.done': 'Done',
  'record.datePicker.trigger': '{label}: {date}. Choose date',
  'record.datePicker.triggerEmpty': 'Choose {label}',

  /* Event creation and revision-safe editing. */
  'record.event.new': 'New Event',
  'record.event.titleAndIcon': 'Title and icon',
  'record.event.semanticIcon': 'Semantic icon',
  'record.event.date': 'Date',
  'record.event.noTimeOfDay': 'Events have no time of day.',
  'record.event.track': 'Track',
  'record.event.noTrack': 'Not in a Track',
  'record.event.tags': 'Tags',
  'record.event.noTags': 'No tags',
  'record.event.create': 'Create',
  'record.event.cancel': 'Cancel',
  'record.event.delete': 'Delete Event',
  'record.event.deleteConfirm':
    'Delete this Event? Its exact stable identity will be soft-deleted.',
  'record.event.confirmDelete': 'Delete Event',
  'record.event.saveFailed':
    'The Event change did not complete. The complete draft remains in this tab. {detail}',
  'record.event.conflictTitle': 'The Event changed in the archive',
  'record.event.conflictDetail':
    'Your complete draft remains here. Choose which version to continue with.',
  'record.event.conflictSaveMine': 'Save my Event',
  'record.event.conflictUseArchive': 'Use archive Event',
  'record.event.status.idle': 'Event editing is unavailable.',
  'record.event.status.creating': 'Draft Event. Choose Create or Cancel.',
  'record.event.status.loading': 'Reading the selected Event.',
  'record.event.status.ready': 'Ready to save.',
  'record.event.status.dirty': 'Unsaved Event changes.',
  'record.event.status.saving': 'Saving Event…',
  'record.event.status.saved': 'Saved.',
  'record.event.status.failed': 'The Event change did not complete.',
  'record.event.status.conflicted':
    'The Event change stopped because the archive changed.',
  'record.event.status.missing': 'This Event is no longer available.',
  'record.event.status.mock':
    'Development preview. Changes remain in this tab only.',

  /* Span creation, ongoing ranges, derived markers, and conversion. */
  'record.span.new': 'New Span',
  'record.span.titleAndIcon': 'Title and icon',
  'record.span.semanticIcon': 'Semantic icon',
  'record.span.startDate': 'Start',
  'record.span.endDate': 'End',
  'record.span.ongoing': 'Ongoing',
  'record.span.present': 'Present',
  'record.span.markers': 'Timeline markers',
  'record.span.beginMarkerLegend': 'Start marker',
  'record.span.beginMarkerEnabled': 'Show begin marker',
  'record.span.endMarkerLegend': 'End marker',
  'record.span.endMarkerEnabled': 'Show end marker',
  'record.span.markerTitle': 'Custom title',
  'record.span.markerAutomatic': 'Automatic title',
  'record.span.markerReset': 'Use automatic title',
  'record.span.markerDerived':
    'Markers are derived from this Span and have no separate writing or identity.',
  'record.span.create': 'Create Span',
  'record.span.convert': 'Convert one-day Span to Event',
  'record.span.convertConfirm':
    'Choose the Event date for this Span. Its writing and stable identity will be preserved.',
  'record.span.convertDate': 'Event date',
  'record.span.confirmConvert': 'Convert to Event',
  'record.span.delete': 'Delete Span',
  'record.span.deleteConfirm':
    'Delete this Span? Its exact stable identity will be soft-deleted. Its markers are derived and will disappear with it.',
  'record.span.confirmDelete': 'Delete Span',
  'record.span.movedRange':
    'The Span moved to its current range. The object list has been refreshed.',
  'record.span.dismissMovedRange': 'Dismiss',
  'record.span.saveFailed':
    'The Span change did not complete. The complete draft remains in this tab. {detail}',
  'record.span.conflictTitle': 'The Span changed in the archive',
  'record.span.conflictDetail':
    'Your complete draft remains here. Choose which version to continue with.',
  'record.span.conflictSaveMine': 'Save my Span',
  'record.span.conflictUseArchive': 'Use archive Span',
  'record.span.status.idle': 'Span editing is unavailable.',
  'record.span.status.creating': 'Draft Span. Choose Create Span or Cancel.',
  'record.span.status.loading': 'Reading the selected Span.',
  'record.span.status.ready': 'Ready to save.',
  'record.span.status.dirty': 'Unsaved Span changes.',
  'record.span.status.saving': 'Saving Span…',
  'record.span.status.saved': 'Saved.',
  'record.span.status.failed': 'The Span change did not complete.',
  'record.span.status.conflicted':
    'The Span change stopped because the archive changed.',
  'record.span.status.missing': 'This Span is no longer available.',
  'record.span.status.mock':
    'Development preview. Changes remain in this tab only.',

  /* Track management, mixed-member capture, and membership chooser. */
  'record.track.heading': 'Tracks',
  'record.track.new': 'New Track',
  'record.track.showArchived': 'Show archived Tracks',
  'record.track.empty': 'No Tracks',
  'record.track.memberCount': {
    one: '{count} member',
    other: '{count} members',
  },
  'record.track.archived': 'Archived',
  'record.track.none': 'Not in a Track',
  'record.track.noSelection': 'No Track',
  'record.track.choose': 'Choose a Track',
  'record.track.trigger': 'Track: {name}. Choose Track',
  'record.track.close': 'Close Track picker',
  'record.track.manage': 'Manage Track',
  'record.track.manageAll': 'Manage Tracks',
  'record.track.manageDetail': 'Open a Track to edit it.',
  'record.track.activeHeading': 'Tracks',
  'record.track.archivedHeading': 'Archived',
  'record.track.closeManager': 'Close Track management',
  'record.track.backToManager': 'Back to Manage Tracks',
  'record.track.closeEditor': 'Close Track editor',
  'record.track.createHeading': 'New Track',
  'record.track.createDetail': 'Create a Track for related Events and Spans.',
  'record.track.editHeading': 'Edit Track',
  'record.track.editDetail': 'Update this Track’s identity and organisation.',
  'record.track.name': 'Name',
  'record.track.icon': 'Semantic icon',
  'record.track.titleAndIcon': 'Icon and title',
  'record.track.defaultTag': 'Default tag',
  'record.track.suggestedTag': 'Tag for new items',
  'record.track.noSuggestedTag': 'No suggested tag',
  'record.track.createWithFirst': 'Create with a first member',
  'record.track.create': 'Create Track',
  'record.track.createAtomically': 'Create Track and member',
  'record.track.save': 'Save',
  'record.track.addMember': 'Create member in this Track',
  'record.track.createMember': 'Create member',
  'record.track.memberDetails': 'New member',
  'record.track.memberKind': 'Kind',
  'record.track.memberTitle': 'Title',
  'record.track.memberWriting': 'Writing',
  'record.track.suggestedTagMayApply':
    'The Track suggestion will apply unless tag state is supplied',
  'record.track.useNoTags': 'Use no tags',
  'record.track.history': 'Track history',
  'record.track.contained': 'Contained Events and Spans',
  'record.track.seeHistory': 'See Track History',
  'record.track.historyEmpty': 'No members in this Track.',
  'record.track.markerPreview': 'Markers: {titles}',
  'record.track.loadMore': 'Load more members',
  'record.track.delete': 'Delete Track',
  'record.track.archive': 'Archive Track',
  'record.track.unarchive': 'Restore Track',
  'record.track.deleteEmpty':
    'Delete this empty Track? This does not delete any Event or Span.',
  'record.track.deletePopulated': {
    one: 'Delete this Track and detach its one member? The Event or Span, including all its writing and metadata, will remain in the archive.',
    other:
      'Delete this Track and detach its {count} members? The Events and Spans, including all their writing and metadata, will remain in the archive.',
  },
  'record.track.detachConfirm':
    'Detach every member without deleting any Event or Span',
  'record.track.confirmDelete': 'Confirm Delete',
  'record.track.failureDraftKept': 'The complete Track draft remains here.',
  'record.track.conflictTitle': 'The Track changed in the archive',
  'record.track.conflictDetail':
    'Your complete Track draft remains here. Choose which version to continue with.',
  'record.track.saveMine': 'Save my Track',
  'record.track.useArchive': 'Use archive Track',
  'record.track.retryCreate': 'Try again with a new identity',
  'record.track.memberConflictTitle':
    'The Track or member changed in the archive',
  'record.track.memberConflictDetail':
    'The complete new-member draft remains here. Refresh its Track context, then try creating it again.',
  'record.track.refreshAndRetry': 'Refresh Track context',
  'record.icon.fallbackGlyph': '?',

  /* Core-owned media. A durability statement follows only core success. */
  'record.media.heading': 'Media',
  'record.media.count': {
    one: '{count} media item',
    other: '{count} media items',
  },
  'record.media.detail':
    'Original files are copied into this archive. Picker access and previews are temporary.',
  'record.media.add': 'Add media',
  'record.media.addShort': 'Add',
  'record.media.picker': 'Choose media files',
  'record.media.choose': 'Choose photos or files from this computer',
  'record.media.empty': 'No media in this entry',
  'record.media.ownerRequired': 'No media in this Day',
  'record.media.ownerRequiredDetail':
    'Add some writing first. You can add media after this Day’s entry is created.',
  'record.media.gallery': 'Media in this entry',
  'record.media.loading': 'Reading media from the archive…',
  'record.media.reading': 'Reading {fileName}…',
  'record.media.importing': 'Copying {fileName} into the archive…',
  'record.media.progress': 'Media import progress',
  'record.media.imported':
    'The core copied the original bytes into durable archive storage.',
  'record.media.importedMock':
    'Development preview. The selected bytes remain in this tab only.',
  'record.media.deleted': 'Media removed from the archive.',
  'record.media.acquisitionFailed':
    'The browser could not read that file. Nothing was added.',
  'record.media.listFailed':
    'Media could not be read from the archive. Nothing was changed. {detail}',
  'record.media.mutationFailed':
    'The media change did not complete. The gallery was kept unchanged. {detail}',
  'record.media.retry': 'Try reading media again',
  'record.media.kind.image': 'Image',
  'record.media.kind.video': 'Video',
  'record.media.kind.audio': 'Audio',
  'record.media.kind.document': 'Document',
  'record.media.kind.text': 'Text',
  'record.media.kind.other': 'File',
  'record.media.itemMetadata': '{kind} · {size}',
  'record.media.previewAction': 'Preview {fileName}',
  'record.media.deleteAction': 'Remove {fileName}',
  'record.media.remove': 'Remove',
  'record.media.closePreview': 'Close preview',
  'record.media.previewLoading': 'Reading preview bytes from the archive…',
  'record.media.previewMetadata': '{mimeType} · {size}',
  'record.media.previewFailed':
    'The archived content is unavailable for preview. {detail}',
  'record.media.previewUnsupported':
    'This format is not opened inside LifeArchive. The original remains unchanged in the archive.',
  'record.media.previewAlt': 'Preview of {fileName}',
  'record.media.deleteConfirm':
    'Remove {fileName} from this entry and the archive?',
  'record.media.confirmDelete': 'Remove media',
  'record.media.cancelDelete': 'Keep media',

  /* Markdown writing surface. Mock mode never makes a durability claim. */
  'record.editor.label': 'Writing',
  'record.editor.heading': 'Writing',
  'record.editor.entryKind.scaleDay': 'Day entry',
  'record.editor.entryKind.scaleWeek': 'Week entry',
  'record.editor.entryKind.scaleMonth': 'Month entry',
  'record.editor.entryKind.scaleYear': 'Year entry',
  'record.editor.entryKind.event': 'Event entry',
  'record.editor.entryKind.span': 'Span entry',
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
