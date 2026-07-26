/**
 * The development mock's fixed scenario.
 *
 * Every value here is a literal. Nothing in this file derives an answer the
 * core owns: there is no calendar arithmetic, no window traversal, no
 * ordering, no counting, no conflict resolution, no empty-entry policy, and no
 * archive encoding. A mock that computed those would drift from the real
 * runtime and would teach the UI a wrong shape of the truth.
 *
 * Because the values are fixed, a call does not change them. Saving does not
 * alter the entry the next load returns, and stepping a window does not move
 * anywhere the fixtures do not already describe. A caller that needs a
 * different answer scripts one; it never asks the mock to work it out.
 *
 * These fixtures describe a single illustrative day, 2025-06-14, in UTC.
 */

import {
  civilDate,
  coreTimeWindow,
  coreTrackHistoryCursor,
  ok,
  operationId,
  revision,
  stableId,
} from '../client'
import type {
  ArchiveCloseResult,
  ArchiveEraseResult,
  ArchiveExportResult,
  ArchiveIdentity,
  ArchiveIdentitySaveResult,
  ArchiveIdentityState,
  ArchiveImportResult,
  ArchiveOverview,
  ArchiveSession,
  ArchiveVerification,
  CalendarContext,
  CalendarDay,
  CancellationRequestResult,
  CivilDate,
  ClientResult,
  Instant,
  InvalidationToken,
  MediaContent,
  MediaDeleteResult,
  MediaImportResult,
  MediaItem,
  MediaListing,
  OpenArchive,
  OperationId,
  OrdinaryDeleteResult,
  OrdinaryEntry,
  OrdinaryEntryState,
  OrdinarySaveResult,
  RuntimeFacts,
  RuntimeStatus,
  StableId,
  StorageFacts,
  StructuredDeleteResult,
  StructuredListPage,
  StructuredMutationResult,
  StructuredObject,
  StructuredObjectState,
  StructuredSummary,
  TimeWindow,
  TimelineFocusResult,
  TimelinePage,
  TimelineStructuredDetailResult,
  TimelineStructuredListResult,
  Track,
  TrackHistoryPage,
  TrackListPage,
  TrackMutationResult,
  TrackState,
  TrackWithFirstMember,
} from '../client'
import { DEVELOPMENT_MOCK_MARKER } from './developmentOnly'

/* -------------------------------------------------------------------------- */
/* Exact fixture identifiers                                                  */
/* -------------------------------------------------------------------------- */

const ARCHIVE_ID = stableId('7f1c0a10-0000-4000-8000-000000000001')
const SUBJECT_ID = stableId('7f1c0a10-0000-4000-8000-000000000002')
const ENTRY_ID = stableId('7f1c0a10-0000-4000-8000-000000000010')
const EVENT_ID = stableId('7f1c0a10-0000-4000-8000-000000000020')
const SPAN_ID = stableId('7f1c0a10-0000-4000-8000-000000000021')
const TRACK_ID = stableId('7f1c0a10-0000-4000-8000-000000000030')
const ARCHIVED_TRACK_ID = stableId('7f1c0a10-0000-4000-8000-000000000031')
const MEDIA_ID = stableId('7f1c0a10-0000-4000-8000-000000000040')

/**
 * The identifiers `operations.newStableId` hands out, in order and cycling.
 * They are a fixed list rather than random values so a development session and
 * a test observe the same identifiers.
 */
const MINTED_STABLE_IDS: readonly StableId[] = [
  stableId('7f1c0a10-0000-4000-8000-0000000000a1'),
  stableId('7f1c0a10-0000-4000-8000-0000000000a2'),
  stableId('7f1c0a10-0000-4000-8000-0000000000a3'),
  stableId('7f1c0a10-0000-4000-8000-0000000000a4'),
]

const MINTED_OPERATION_IDS: readonly OperationId[] = [
  operationId('7f1c0a10-0000-4000-8000-0000000000b1'),
  operationId('7f1c0a10-0000-4000-8000-0000000000b2'),
]

const STORE_INSTANCE_ID = 'development-mock-store-instance'

const INVALIDATION: InvalidationToken = {
  storeInstanceId: STORE_INSTANCE_ID,
  revision: revision('412'),
}

/* -------------------------------------------------------------------------- */
/* Literal civil days                                                         */
/* -------------------------------------------------------------------------- */

/**
 * `[civil date, window start, window end, inside the focused month]`.
 *
 * The instants are written out rather than stepped from a base, so no part of
 * this file performs date arithmetic. A month grid is a core placement
 * decision; these values simply record one.
 */
type DayFixture = readonly [string, Instant, Instant, boolean]

const MONTH_DAYS: readonly DayFixture[] = [
  ['2025-05-26', 1748217600000, 1748304000000, false],
  ['2025-05-27', 1748304000000, 1748390400000, false],
  ['2025-05-28', 1748390400000, 1748476800000, false],
  ['2025-05-29', 1748476800000, 1748563200000, false],
  ['2025-05-30', 1748563200000, 1748649600000, false],
  ['2025-05-31', 1748649600000, 1748736000000, false],
  ['2025-06-01', 1748736000000, 1748822400000, true],
  ['2025-06-02', 1748822400000, 1748908800000, true],
  ['2025-06-03', 1748908800000, 1748995200000, true],
  ['2025-06-04', 1748995200000, 1749081600000, true],
  ['2025-06-05', 1749081600000, 1749168000000, true],
  ['2025-06-06', 1749168000000, 1749254400000, true],
  ['2025-06-07', 1749254400000, 1749340800000, true],
  ['2025-06-08', 1749340800000, 1749427200000, true],
  ['2025-06-09', 1749427200000, 1749513600000, true],
  ['2025-06-10', 1749513600000, 1749600000000, true],
  ['2025-06-11', 1749600000000, 1749686400000, true],
  ['2025-06-12', 1749686400000, 1749772800000, true],
  ['2025-06-13', 1749772800000, 1749859200000, true],
  ['2025-06-14', 1749859200000, 1749945600000, true],
  ['2025-06-15', 1749945600000, 1750032000000, true],
  ['2025-06-16', 1750032000000, 1750118400000, true],
  ['2025-06-17', 1750118400000, 1750204800000, true],
  ['2025-06-18', 1750204800000, 1750291200000, true],
  ['2025-06-19', 1750291200000, 1750377600000, true],
  ['2025-06-20', 1750377600000, 1750464000000, true],
  ['2025-06-21', 1750464000000, 1750550400000, true],
  ['2025-06-22', 1750550400000, 1750636800000, true],
  ['2025-06-23', 1750636800000, 1750723200000, true],
  ['2025-06-24', 1750723200000, 1750809600000, true],
  ['2025-06-25', 1750809600000, 1750896000000, true],
  ['2025-06-26', 1750896000000, 1750982400000, true],
  ['2025-06-27', 1750982400000, 1751068800000, true],
  ['2025-06-28', 1751068800000, 1751155200000, true],
  ['2025-06-29', 1751155200000, 1751241600000, true],
  ['2025-06-30', 1751241600000, 1751328000000, true],
  ['2025-07-01', 1751328000000, 1751414400000, false],
  ['2025-07-02', 1751414400000, 1751500800000, false],
  ['2025-07-03', 1751500800000, 1751587200000, false],
  ['2025-07-04', 1751587200000, 1751673600000, false],
  ['2025-07-05', 1751673600000, 1751760000000, false],
  ['2025-07-06', 1751760000000, 1751846400000, false],
]

/** The core-placed week strip, quoted from the same fixed placement. */
const WEEK_DAY_DATES: readonly string[] = [
  '2025-06-09',
  '2025-06-10',
  '2025-06-11',
  '2025-06-12',
  '2025-06-13',
  '2025-06-14',
  '2025-06-15',
]

function dayWindow([date, startMs, endMs]: DayFixture): TimeWindow {
  return coreTimeWindow({
    id: `day:${date}`,
    scale: 'day',
    startMs,
    endMs,
    calendarId: 'gregory',
    timeZoneId: 'UTC',
  })
}

function dayFixture(date: string): DayFixture {
  const found = MONTH_DAYS.find(([value]) => value === date)
  if (!found) {
    throw new TypeError(`No mock day fixture for ${date}`)
  }
  return found
}

function calendarDay(fixture: DayFixture): CalendarDay {
  return {
    date: civilDate(fixture[0]),
    window: dayWindow(fixture),
    withinFocusedMonth: fixture[3],
  }
}

const FOCUSED_DATE: CivilDate = civilDate('2025-06-14')
const FOCUSED_WINDOW = dayWindow(dayFixture('2025-06-14'))

/**
 * The window `time.step` answers with, in both directions. The mock does not
 * know which neighbour a step lands on — that is core traversal — so it
 * returns one fixed neighbouring window and leaves real traversal to the
 * runtime.
 */
const NEIGHBOUR_WINDOW = dayWindow(dayFixture('2025-06-13'))

const WEEK_WINDOW = coreTimeWindow({
  id: 'week:2025-W24',
  scale: 'week',
  startMs: 1749427200000,
  endMs: 1750032000000,
  calendarId: 'gregory',
  timeZoneId: 'UTC',
})

/* -------------------------------------------------------------------------- */
/* Record fixtures                                                            */
/* -------------------------------------------------------------------------- */

const ENTRY_MARKDOWN = [
  '## Morning',
  '',
  'Cycled to the harbour before the heat arrived. The water was flat enough',
  'to see the pilings straight down.',
  '',
  '- coffee at the kiosk',
  '- read two chapters',
  '',
  '## Evening',
  '',
  'Long call with Mum about the summer plans.',
].join('\n')

const ENTRY_PLAIN_TEXT = [
  'Morning',
  'Cycled to the harbour before the heat arrived. The water was flat enough',
  'to see the pilings straight down.',
  'coffee at the kiosk',
  'read two chapters',
  'Evening',
  'Long call with Mum about the summer plans.',
].join('\n')

const ENTRY: OrdinaryEntry = {
  id: ENTRY_ID,
  revision: revision('9'),
  window: FOCUSED_WINDOW,
  markdown: ENTRY_MARKDOWN,
  plainText: ENTRY_PLAIN_TEXT,
  createdAtMs: 1749892800000,
  updatedAtMs: 1749931200000,
  isPinned: false,
  privacy: 'normal',
  source: 'manual',
}

const ENTRY_PRESENT: OrdinaryEntryState = {
  presence: 'present',
  window: FOCUSED_WINDOW,
  entry: ENTRY,
  invalidation: INVALIDATION,
}

/** The conflicting state a scripted revision conflict reports as current. */
const ENTRY_AFTER_CONFLICT: OrdinaryEntryState = {
  presence: 'present',
  window: FOCUSED_WINDOW,
  entry: {
    ...ENTRY,
    revision: revision('10'),
    markdown: `${ENTRY_MARKDOWN}\n\nAdded from another tab.`,
    plainText: `${ENTRY_PLAIN_TEXT}\nAdded from another tab.`,
    updatedAtMs: 1749934800000,
  },
  invalidation: {
    storeInstanceId: STORE_INSTANCE_ID,
    revision: revision('413'),
  },
}

const MEDIA_ITEM: MediaItem = {
  id: MEDIA_ID,
  parentEntryId: ENTRY_ID,
  fileName: 'harbour.jpg',
  kind: 'image',
  mimeType: 'image/jpeg',
  byteSize: 248_193,
  createdAtMs: 1749895200000,
  capturedAtMs: 1749888000000,
  durationMs: null,
  width: 3024,
  height: 4032,
  caption: 'Flat water at the harbour',
}

const EVENT_SUMMARY: StructuredSummary = {
  id: EVENT_ID,
  revision: revision('4'),
  title: 'Harbour swim',
  placement: { kind: 'event', date: FOCUSED_DATE },
  iconId: 'icon.activity',
  tags: { ordered: ['tag.outdoors', 'tag.summer'], display: 'tag.outdoors' },
  trackId: null,
}

const SPAN_SUMMARY: StructuredSummary = {
  id: SPAN_ID,
  revision: revision('6'),
  title: 'Living in Aarhus',
  placement: {
    kind: 'span',
    startDate: civilDate('2024-08-01'),
    endDate: null,
    beginMarker: { enabled: true, titleOverride: 'Moved to Aarhus' },
    endMarker: { enabled: false, titleOverride: null },
  },
  iconId: 'icon.home',
  tags: { ordered: ['tag.places'], display: 'tag.places' },
  trackId: TRACK_ID,
}

const EVENT_OBJECT: StructuredObject = {
  summary: EVENT_SUMMARY,
  markdown: 'Cold, clear, and completely empty at seven in the morning.',
  createdAtMs: 1749892800000,
  updatedAtMs: 1749896400000,
  privacy: 'normal',
  media: [MEDIA_ITEM],
  hasMoreMedia: false,
}

const SPAN_OBJECT: StructuredObject = {
  summary: SPAN_SUMMARY,
  markdown: 'The flat by the botanical garden.',
  createdAtMs: 1722470400000,
  updatedAtMs: 1749896400000,
  privacy: 'normal',
  media: [],
  hasMoreMedia: false,
}

const EVENT_STATE: StructuredObjectState = {
  presence: 'present',
  object: EVENT_OBJECT,
  invalidation: INVALIDATION,
}

/* -------------------------------------------------------------------------- */
/* Track fixtures                                                             */
/* -------------------------------------------------------------------------- */

const TRACK: Track = {
  id: TRACK_ID,
  revision: revision('3'),
  name: 'Where I lived',
  iconId: 'icon.home',
  suggestedTagId: 'tag.places',
  isArchived: false,
  createdAtMs: 1722470400000,
  updatedAtMs: 1749896400000,
}

const ARCHIVED_TRACK: Track = {
  id: ARCHIVED_TRACK_ID,
  revision: revision('2'),
  name: 'Bicycle repairs',
  iconId: 'icon.tools',
  suggestedTagId: null,
  isArchived: true,
  createdAtMs: 1690848000000,
  updatedAtMs: 1717200000000,
}

const TRACK_STATE: TrackState = {
  presence: 'present',
  track: TRACK,
  invalidation: INVALIDATION,
}

/* -------------------------------------------------------------------------- */
/* Archive fixtures                                                           */
/* -------------------------------------------------------------------------- */

const OPEN_ARCHIVE: OpenArchive = {
  storeId: ARCHIVE_ID,
  productContract: 'development-mock',
  storeSchemaVersion: 'development-mock',
  rootLayoutVersion: 'development-mock',
  invalidation: INVALIDATION,
}

const IDENTITY: ArchiveIdentity = {
  id: ARCHIVE_ID,
  title: 'A development archive',
  subject: {
    id: SUBJECT_ID,
    displayName: 'Sample Subject',
    shortName: 'Sample',
    lifeStatus: 'living',
    dateOfBirth: civilDate('1988-03-04'),
    dateOfDeath: null,
  },
}

/**
 * Runtime facts for the mock. The mode is explicit and durability is
 * `unproven`: fixtures are not an archive, and nothing here may be presented
 * as durable, backed up, or held on the user's device.
 */
const RUNTIME_FACTS: RuntimeFacts = {
  mode: 'development-mock',
  runtimeVersion: DEVELOPMENT_MOCK_MARKER,
  buildId: DEVELOPMENT_MOCK_MARKER,
  productContract: 'development-mock',
  browserAbi: 'development-mock',
  backend: 'development-mock',
  durability: 'unproven',
}

const STORAGE_FACTS: StorageFacts = {
  backend: 'development-mock',
  durability: 'unproven',
  archiveOpen: true,
  grant: 'unsupported',
  estimate: null,
}

const EXPORT_BYTES = Uint8Array.from([0x4c, 0x41, 0x44, 0x45, 0x56])

/* -------------------------------------------------------------------------- */
/* The scenario                                                               */
/* -------------------------------------------------------------------------- */

/**
 * One answer per client method that returns a value, keyed by its
 * `area.method` path. Every entry is a complete `ClientResult`, so a scenario
 * can present a failure exactly as naturally as a success.
 */
export interface MockResults {
  readonly 'runtime.storage': ClientResult<StorageFacts>
  readonly 'archive.create': ClientResult<OpenArchive>
  readonly 'archive.open': ClientResult<OpenArchive>
  readonly 'archive.close': ClientResult<ArchiveCloseResult>
  readonly 'archive.overview': ClientResult<ArchiveOverview>
  readonly 'archive.verify': ClientResult<ArchiveVerification>
  readonly 'archive.import': ClientResult<ArchiveImportResult>
  readonly 'archive.export': ClientResult<ArchiveExportResult>
  readonly 'archive.erase': ClientResult<ArchiveEraseResult>
  readonly 'identity.load': ClientResult<ArchiveIdentityState>
  readonly 'identity.save': ClientResult<ArchiveIdentitySaveResult>
  readonly 'time.window': ClientResult<TimeWindow>
  readonly 'time.step': ClientResult<TimeWindow>
  readonly 'time.calendarContext': ClientResult<CalendarContext>
  readonly 'record.load': ClientResult<OrdinaryEntryState>
  readonly 'record.save': ClientResult<OrdinarySaveResult>
  readonly 'record.delete': ClientResult<OrdinaryDeleteResult>
  readonly 'record.listObjects': ClientResult<StructuredListPage>
  readonly 'structured.load': ClientResult<StructuredObjectState>
  readonly 'structured.create': ClientResult<StructuredMutationResult>
  readonly 'structured.save': ClientResult<StructuredMutationResult>
  readonly 'structured.delete': ClientResult<StructuredDeleteResult>
  readonly 'structured.convertSpanToEvent': ClientResult<StructuredMutationResult>
  readonly 'tracks.list': ClientResult<TrackListPage>
  readonly 'tracks.load': ClientResult<TrackState>
  readonly 'tracks.create': ClientResult<TrackMutationResult>
  readonly 'tracks.save': ClientResult<TrackMutationResult>
  readonly 'tracks.delete': ClientResult<TrackMutationResult>
  readonly 'tracks.createWithFirstMember': ClientResult<TrackWithFirstMember>
  readonly 'tracks.history': ClientResult<TrackHistoryPage>
  readonly 'tracks.attachMember': ClientResult<StructuredMutationResult>
  readonly 'tracks.detachMember': ClientResult<StructuredMutationResult>
  readonly 'tracks.createMember': ClientResult<StructuredMutationResult>
  readonly 'timeline.index': ClientResult<TimelinePage>
  readonly 'timeline.focus': ClientResult<TimelineFocusResult>
  readonly 'timeline.structuredDetail': ClientResult<TimelineStructuredDetailResult>
  readonly 'timeline.structuredList': ClientResult<TimelineStructuredListResult>
  readonly 'media.list': ClientResult<MediaListing>
  readonly 'media.content': ClientResult<MediaContent>
  readonly 'media.import': ClientResult<MediaImportResult>
  readonly 'media.delete': ClientResult<MediaDeleteResult>
  readonly 'operations.requestCancel': ClientResult<CancellationRequestResult>
}

export type MockResultPath = keyof MockResults

export interface MockScenario {
  readonly runtimeStatus: RuntimeStatus
  readonly archiveSession: ArchiveSession
  /** Handed out in order and then cycled. Never generated. */
  readonly mintedStableIds: readonly StableId[]
  readonly mintedOperationIds: readonly OperationId[]
  readonly results: MockResults
}

function exportPackage(): File {
  return new File([EXPORT_BYTES], 'development-mock-export.lifearchive', {
    type: 'application/octet-stream',
  })
}

const RESULTS: MockResults = {
  'runtime.storage': ok(STORAGE_FACTS),
  'archive.create': ok(OPEN_ARCHIVE),
  'archive.open': ok(OPEN_ARCHIVE),
  'archive.close': ok({ outcome: 'closed' }),
  'archive.overview': ok<ArchiveOverview>({
    storeId: ARCHIVE_ID,
    storeSchemaVersion: 'development-mock',
    storeContract: 'development-mock',
    visibleEntryCount: 128,
    entryCounts: {
      moment: 0,
      day: 124,
      week: 3,
      month: 1,
      year: 0,
      custom: 0,
    },
    structuredCounts: { events: 17, spans: 4 },
    trackCounts: { active: 1, archived: 1, ongoingMembers: 1 },
    mediaCount: 6,
    mediaByteTotal: 1_488_204,
    health: {
      readable: true,
      schemaCompatible: true,
      recovery: 'clean',
      integrity: 'verified',
      referenceViolationCount: 0,
      overall: 'healthy',
    },
    invalidation: INVALIDATION,
  }),
  'archive.verify': ok<ArchiveVerification>({
    valid: true,
    issues: [],
    checkedFiles: 214,
  }),
  'archive.import': ok<ArchiveImportResult>({
    importedEntries: 12,
    importedMedia: 3,
    skippedEntries: 2,
    skippedMedia: 0,
    skippedEntryIds: [ENTRY_ID],
    skippedMediaIds: [],
    issues: [],
    identity: { outcome: 'preserved' },
    invalidation: INVALIDATION,
  }),
  'archive.export': ok<ArchiveExportResult>({
    archive: exportPackage(),
    archiveId: ARCHIVE_ID,
    createdAt: '2025-06-14T18:00:00Z',
    counts: { entries: 128, media: 6, summaries: 21 },
    dateRange: { start: '2024-08-01', end: '2025-06-14' },
    filesWritten: 214,
    checkedFiles: 214,
    checksumAlgorithm: 'sha256',
    invalidation: INVALIDATION,
  }),
  'archive.erase': ok<ArchiveEraseResult>({
    outcome: 'erased',
    invalidation: INVALIDATION,
  }),
  'identity.load': ok<ArchiveIdentityState>({
    identity: IDENTITY,
    invalidation: INVALIDATION,
  }),
  'identity.save': ok<ArchiveIdentitySaveResult>({
    outcome: 'updated',
    identity: IDENTITY,
    invalidation: INVALIDATION,
  }),
  'time.window': ok(FOCUSED_WINDOW),
  'time.step': ok(NEIGHBOUR_WINDOW),
  'time.calendarContext': ok<CalendarContext>({
    focused: FOCUSED_WINDOW,
    focusedDate: FOCUSED_DATE,
    week: WEEK_DAY_DATES.map((date) => calendarDay(dayFixture(date))),
    month: MONTH_DAYS.map(calendarDay),
  }),
  'record.load': ok(ENTRY_PRESENT),
  'record.save': ok<OrdinarySaveResult>({
    outcome: 'updated',
    entry: ENTRY,
    invalidation: INVALIDATION,
  }),
  'record.delete': ok<OrdinaryDeleteResult>({
    outcome: 'deleted',
    deletedEntryId: ENTRY_ID,
    deletedRevision: revision('9'),
    invalidation: INVALIDATION,
  }),
  'record.listObjects': ok<StructuredListPage>({
    objects: [EVENT_SUMMARY, SPAN_SUMMARY],
    invalidation: INVALIDATION,
  }),
  'structured.load': ok(EVENT_STATE),
  'structured.create': ok<StructuredMutationResult>({
    outcome: 'created',
    object: EVENT_OBJECT,
    invalidation: INVALIDATION,
  }),
  'structured.save': ok<StructuredMutationResult>({
    outcome: 'updated',
    object: EVENT_OBJECT,
    invalidation: INVALIDATION,
  }),
  'structured.delete': ok<StructuredDeleteResult>({
    outcome: 'deleted',
    deletedId: EVENT_ID,
    deletedRevision: revision('4'),
    invalidation: INVALIDATION,
  }),
  'structured.convertSpanToEvent': ok<StructuredMutationResult>({
    outcome: 'converted',
    object: EVENT_OBJECT,
    invalidation: INVALIDATION,
  }),
  'tracks.list': ok<TrackListPage>({
    tracks: [
      { track: TRACK, memberCount: 3, ongoingMemberCount: 1 },
      { track: ARCHIVED_TRACK, memberCount: 5, ongoingMemberCount: 0 },
    ],
    invalidation: INVALIDATION,
  }),
  'tracks.load': ok(TRACK_STATE),
  'tracks.create': ok<TrackMutationResult>({
    outcome: 'created',
    track: TRACK,
    detachedMemberCount: 0,
    invalidation: INVALIDATION,
  }),
  'tracks.save': ok<TrackMutationResult>({
    outcome: 'updated',
    track: TRACK,
    detachedMemberCount: 0,
    invalidation: INVALIDATION,
  }),
  'tracks.delete': ok<TrackMutationResult>({
    outcome: 'deleted',
    track: TRACK,
    detachedMemberCount: 3,
    invalidation: INVALIDATION,
  }),
  'tracks.createWithFirstMember': ok<TrackWithFirstMember>({
    track: TRACK,
    member: SPAN_OBJECT,
    invalidation: INVALIDATION,
  }),
  'tracks.history': ok<TrackHistoryPage>({
    track: TRACK,
    members: [
      {
        id: SPAN_ID,
        revision: revision('6'),
        kind: 'span',
        title: 'Living in Aarhus',
        primaryDate: civilDate('2024-08-01'),
        endDate: null,
        iconId: 'icon.home',
        displayTagId: 'tag.places',
        beginMarkerTitleOverride: 'Moved to Aarhus',
        endMarkerTitleOverride: null,
      },
    ],
    nextCursor: coreTrackHistoryCursor('development-mock-cursor-2'),
    invalidation: INVALIDATION,
  }),
  'tracks.attachMember': ok<StructuredMutationResult>({
    outcome: 'updated',
    object: SPAN_OBJECT,
    invalidation: INVALIDATION,
  }),
  'tracks.detachMember': ok<StructuredMutationResult>({
    outcome: 'updated',
    object: EVENT_OBJECT,
    invalidation: INVALIDATION,
  }),
  'tracks.createMember': ok<StructuredMutationResult>({
    outcome: 'created',
    object: SPAN_OBJECT,
    invalidation: INVALIDATION,
  }),
  'timeline.index': ok<TimelinePage>({
    rows: [
      {
        window: dayWindow(dayFixture('2025-06-12')),
        exactEntry: null,
        exactEntryHasWriting: false,
        mediaCount: 0,
        containedEntryCounts: { day: 0, week: 0, month: 0 },
        coverage: null,
        hasContent: false,
      },
      {
        window: dayWindow(dayFixture('2025-06-13')),
        exactEntry: {
          id: stableId('7f1c0a10-0000-4000-8000-000000000011'),
          revision: revision('2'),
        },
        exactEntryHasWriting: true,
        mediaCount: 0,
        containedEntryCounts: { day: 1, week: 0, month: 0 },
        coverage: null,
        hasContent: true,
      },
      {
        window: FOCUSED_WINDOW,
        exactEntry: { id: ENTRY_ID, revision: revision('9') },
        exactEntryHasWriting: true,
        mediaCount: 1,
        containedEntryCounts: { day: 1, week: 0, month: 0 },
        coverage: null,
        hasContent: true,
      },
      {
        window: WEEK_WINDOW,
        exactEntry: null,
        exactEntryHasWriting: false,
        mediaCount: 1,
        containedEntryCounts: { day: 2, week: 0, month: 0 },
        coverage: { filled: 2, total: 7 },
        hasContent: true,
      },
    ],
    scene: [EVENT_SUMMARY, SPAN_SUMMARY],
    markerCandidates: [
      {
        boundary: 'begin',
        date: civilDate('2024-08-01'),
        parentSpanId: SPAN_ID,
        parentSpanRevision: revision('6'),
        parentStartDate: civilDate('2024-08-01'),
        parentEndDate: null,
        trackId: TRACK_ID,
        titleMode: 'override',
        titleOverride: 'Moved to Aarhus',
        iconId: 'icon.home',
        displayTagId: 'tag.places',
      },
    ],
    contentBounds: { startMs: 1722470400000, endMs: 1749945600000 },
    structuredContentEndDate: FOCUSED_DATE,
    invalidation: INVALIDATION,
  }),
  'timeline.focus': ok<TimelineFocusResult>({
    outcome: 'focused',
    window: FOCUSED_WINDOW,
    entry: {
      reference: { id: ENTRY_ID, revision: revision('9') },
      text: ENTRY_MARKDOWN,
      preview: 'Cycled to the harbour before the heat arrived.',
    },
    media: [MEDIA_ITEM],
    invalidation: INVALIDATION,
  }),
  'timeline.structuredDetail': ok<TimelineStructuredDetailResult>({
    outcome: 'detail',
    object: EVENT_OBJECT,
    invalidation: INVALIDATION,
  }),
  'timeline.structuredList': ok<TimelineStructuredListResult>({
    outcome: 'listed',
    objects: [EVENT_SUMMARY, SPAN_SUMMARY],
    invalidation: INVALIDATION,
  }),
  'media.list': ok<MediaListing>({
    parentEntryId: ENTRY_ID,
    parentRevision: revision('9'),
    items: [MEDIA_ITEM],
    invalidation: INVALIDATION,
  }),
  'media.content': ok<MediaContent>({
    mediaId: MEDIA_ID,
    bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xdb]),
    byteSize: 4,
    sha256: null,
  }),
  'media.import': ok<MediaImportResult>({
    outcome: 'imported',
    item: MEDIA_ITEM,
    invalidation: INVALIDATION,
  }),
  'media.delete': ok<MediaDeleteResult>({
    outcome: 'deleted',
    deletedMediaId: MEDIA_ID,
    invalidation: INVALIDATION,
  }),
  'operations.requestCancel': ok<CancellationRequestResult>({
    operationId: MINTED_OPERATION_IDS[0],
    outcome: 'requested',
  }),
}

/**
 * The scenario the mock uses unless a caller supplies another. The archive is
 * already open, because a UI under development normally needs the open state;
 * every other state is reachable by supplying a different scenario or by
 * scripting.
 */
export const DEVELOPMENT_MOCK_SCENARIO: MockScenario = {
  runtimeStatus: { state: 'available', runtime: RUNTIME_FACTS },
  archiveSession: { state: 'open', archive: OPEN_ARCHIVE },
  mintedStableIds: MINTED_STABLE_IDS,
  mintedOperationIds: MINTED_OPERATION_IDS,
  results: RESULTS,
}

/**
 * Named pieces of the scenario a caller can script against, so a test states
 * the outcome it wants instead of rebuilding a fixture that must stay in step
 * with this file.
 */
export const MOCK_FIXTURES = {
  archiveId: ARCHIVE_ID,
  entryId: ENTRY_ID,
  eventId: EVENT_ID,
  spanId: SPAN_ID,
  trackId: TRACK_ID,
  mediaId: MEDIA_ID,
  focusedDate: FOCUSED_DATE,
  focusedWindow: FOCUSED_WINDOW,
  neighbourWindow: NEIGHBOUR_WINDOW,
  weekWindow: WEEK_WINDOW,
  invalidation: INVALIDATION,
  entry: ENTRY,
  entryPresent: ENTRY_PRESENT,
  entryAfterConflict: ENTRY_AFTER_CONFLICT,
  eventObject: EVENT_OBJECT,
  eventState: EVENT_STATE,
  spanObject: SPAN_OBJECT,
  track: TRACK,
  trackState: TRACK_STATE,
  mediaItem: MEDIA_ITEM,
  identity: IDENTITY,
  openArchive: OPEN_ARCHIVE,
  runtimeFacts: RUNTIME_FACTS,
  storageFacts: STORAGE_FACTS,
} as const

/** The scripted revision conflict a caller most often wants for an entry. */
export const ORDINARY_SAVE_CONFLICT: OrdinarySaveResult = {
  outcome: 'conflict',
  conflict: {
    expectedRevision: revision('9'),
    actualRevision: revision('10'),
    current: ENTRY_AFTER_CONFLICT,
  },
}
