import { describe, expect, it } from 'vitest'
import packageMetadata from '../../../package.json'
import {
  civilDate,
  coreTimeWindow,
  coreTrackHistoryCursor,
  operationId,
  revision,
  stableId,
} from '../client'
import { runtimeBoundary, type RuntimeBoundary } from './runtimeBoundary'

const entryId = stableId('A1000000-0000-4000-8000-000000000101')
const objectId = stableId('A1000000-0000-4000-8000-000000000102')
const trackId = stableId('A1000000-0000-4000-8000-000000000103')
const mediaId = stableId('A1000000-0000-4000-8000-000000000104')
const archiveId = stableId('A1000000-0000-4000-8000-000000000105')
const subjectId = stableId('A1000000-0000-4000-8000-000000000106')
const artifactId = stableId('A1000000-0000-4000-8000-000000000107')
const importOperationId = operationId('A1000000-0000-4000-8000-000000000108')
const exportOperationId = operationId('A1000000-0000-4000-8000-000000000109')

const token = {
  storeInstanceId: 'runtime-boundary-fixture',
  revision: revision('7'),
}

const window = coreTimeWindow({
  id: 'opaque-day-window',
  scale: 'day',
  startMs: 1_785_139_200_000,
  endMs: 1_785_225_600_000,
  startDate: civilDate('2026-07-26'),
  endDate: civilDate('2026-07-26'),
  calendarId: 'gregorian',
  timeZoneId: 'Europe/Copenhagen',
})

const weekRules = {
  firstWeekday: 2,
  minimumDaysInFirstWeek: 4,
}

const runtimeRecordSpan = {
  entryType: 'day',
  startMs: window.startMs,
  endMs: window.endMs,
  calendarIdentifier: window.calendarId,
  timeZoneIdentifier: window.timeZoneId,
}

const runtimeTimelineSpan = {
  id: window.id,
  scale: window.scale,
  startMs: window.startMs,
  endMs: window.endMs,
  calendarIdentifier: window.calendarId,
  timeZoneIdentifier: window.timeZoneId,
}

const runtimeOrdinaryCurrent = {
  entry: {
    id: entryId,
    entryType: 'day',
    startMs: window.startMs,
    endMs: window.endMs,
    calendarIdentifier: window.calendarId,
    timeZoneIdentifier: window.timeZoneId,
    bodyMarkdown: 'Exact runtime writing',
    plainTextCache: 'Exact runtime writing',
    createdAtMs: 1_785_139_200_001,
    updatedAtMs: 1_785_139_200_002,
    deletedAtMs: null,
    source: 'manual',
    isPinned: false,
    privacyLevel: 'normal',
  },
  mutationRevision: '3',
}

const structuredDraft = {
  title: 'Runtime event',
  markdown: 'Runtime event body',
  placement: {
    kind: 'event' as const,
    date: civilDate('2026-07-26'),
  },
  iconId: 'calendar',
  tags: { ordered: ['family'], display: 'family' },
  trackId,
  privacy: 'normal' as const,
}

const runtimeStructuredMetadata = {
  kind: 'event',
  date: '2026-07-26',
  iconId: 'calendar',
  tagIds: ['family'],
  displayTagId: 'family',
  trackId,
}

const runtimeStructuredSummary = {
  id: objectId,
  title: 'Runtime event',
  metadata: runtimeStructuredMetadata,
  mutationRevision: '4',
}

const runtimeStructuredSnapshot = {
  summary: runtimeStructuredSummary,
  bodyMarkdown: 'Runtime event body',
  createdAtMs: 1_785_139_200_003,
  updatedAtMs: 1_785_139_200_004,
  deletedAtMs: null,
  privacyLevel: 'normal',
  attachments: [],
  hasMoreAttachments: false,
}

const trackDraft = {
  name: 'Runtime track',
  iconId: 'route',
  suggestedTagId: 'family',
  isArchived: false,
}

const runtimeTrackSnapshot = {
  track: {
    id: trackId,
    name: 'Runtime track',
    iconId: 'route',
    suggestedTagId: 'family',
    isArchived: false,
    createdAt: '2026-07-26T00:00:00Z',
    updatedAt: '2026-07-26T00:00:01.123Z',
    deletedAt: null,
  },
  mutationRevision: '5',
}

const runtimeMediaItem = {
  id: mediaId,
  entryId,
  fileName: 'photo.jpg',
  mediaType: 'image',
  mimeType: 'image/jpeg',
  byteSize: 3,
  createdAtMs: 1_785_139_200_005,
  capturedAtMs: null,
  durationMs: null,
  width: 1,
  height: 1,
  caption: null,
}

const identity = {
  id: archiveId,
  title: 'Runtime archive',
  subject: {
    id: subjectId,
    displayName: 'Archive subject',
    shortName: 'Subject',
    lifeStatus: 'living' as const,
    dateOfBirth: civilDate('1990-01-01'),
    dateOfDeath: null,
  },
}

const runtimeStructuredDraft = {
  title: structuredDraft.title,
  bodyMarkdown: structuredDraft.markdown,
  metadata: runtimeStructuredMetadata,
  privacyLevel: structuredDraft.privacy,
}

const runtimeTrackDraft = {
  name: trackDraft.name,
  iconId: trackDraft.iconId,
  suggestedTagId: trackDraft.suggestedTagId,
  isArchived: trackDraft.isArchived,
}

const archiveFile = new File(
  [Uint8Array.from([1, 2, 3])],
  'Runtime.lifearchive.tar',
  { type: 'application/x-tar' },
)

const mediaBytes = Uint8Array.from([4, 5, 6]).buffer
const exportBytes = Uint8Array.from([7, 8, 9]).buffer

interface ExerciseExpectations {
  readonly operation: string
  readonly request: unknown
  readonly preparedTransfers?: readonly ArrayBuffer[]
  readonly mappedTransfers?: readonly ArrayBuffer[]
  readonly archive?: File
}

function exercise<Request, Result>(
  boundary: RuntimeBoundary<Request, Result>,
  request: Request,
  runtimeResult: unknown,
  expectations: ExerciseExpectations,
): Result {
  expect(boundary.operation).toBe(expectations.operation)
  const prepared = boundary.prepare(request)
  expect(prepared.request).toEqual(expectations.request)
  expect(prepared.transfers).toEqual(expectations.preparedTransfers ?? [])
  if (expectations.archive) {
    expect(prepared.archive).toBe(expectations.archive)
  } else {
    expect(prepared.archive).toBeUndefined()
  }
  const mapped = boundary.map(
    runtimeResult,
    expectations.mappedTransfers ?? [],
    request,
  )
  expect(mapped).toBeDefined()
  return mapped
}

const cases = {
  storeOpen: () => {
    const request = {
      minimumContractVersion: '5',
      maximumContractVersion: '5',
      requiredCapabilities: [],
      logicalRoot: 'lifearchive:archive-root:v1:primary',
      disposition: 'existing',
    }
    const mapped = exercise(
      runtimeBoundary.storeOpen,
      request,
      {
        outcome: 'opened',
        productContractVersion: '5',
        schemaVersion: '7',
        rootLayoutVersion: '1',
        storeId: archiveId,
        token,
        ready: true,
      },
      { operation: 'store.open', request },
    )
    expect(mapped.storeId).toBe(archiveId)
  },

  storeClose: () => {
    const mapped = exercise(
      runtimeBoundary.storeClose,
      null,
      { outcome: 'closed' },
      { operation: 'store.close', request: null },
    )
    expect(mapped.outcome).toBe('closed')
  },

  archiveOverview: () => {
    const mapped = exercise(
      runtimeBoundary.archiveOverview,
      {},
      {
        outcome: 'overview',
        storeId: archiveId,
        schemaVersion: 7,
        storeContractVersion: 5,
        visibleEntryCount: 1,
        entryCounts: {
          moment: 0,
          day: 1,
          week: 0,
          month: 0,
          year: 0,
          custom: 0,
        },
        structuredCounts: { events: 1, spans: 0 },
        trackCounts: { active: 1, archived: 0, ongoingMembers: 0 },
        attachmentCount: 1,
        attachmentByteTotal: 3,
        health: {
          storeReadable: true,
          schemaCompatible: true,
          recoveryState: 'clean',
          databaseIntegrity: 'ok',
          foreignKeyViolationCount: 0,
          status: 'healthy',
        },
        token,
      },
      { operation: 'archive.overview', request: {} },
    )
    expect(mapped.health.integrity).toBe('verified')
  },

  archiveVerify: () => {
    const mapped = exercise(
      runtimeBoundary.archiveVerify,
      { archive: archiveFile },
      {
        valid: true,
        issues: [{ code: 'checked', path: 'manifest.json' }],
        checkedFiles: 3,
      },
      { operation: 'archive.verify', request: {}, archive: archiveFile },
    )
    expect(mapped.checkedFiles).toBe(3)
  },

  archiveImport: () => {
    const input = { operationId: importOperationId, archive: archiveFile }
    const request = { input, previousInvalidation: token }
    const mapped = exercise(
      runtimeBoundary.archiveImport,
      request,
      {
        outcome: 'applied',
        importedEntries: 1,
        importedAttachments: 1,
        importedTracks: 1,
        skippedEntries: 0,
        skippedAttachments: 0,
        skippedTracks: 0,
        skippedEntryIds: [],
        skippedAttachmentIds: [],
        skippedTrackIds: [],
        issues: [],
        identityOutcome: 'matched',
        identityConflicts: [],
        identityFilledFields: [],
        token: { ...token, revision: '8' },
      },
      {
        operation: 'archive.apply',
        request: { operationId: importOperationId },
        archive: archiveFile,
      },
    )
    expect(mapped.importedTracks).toBe(1)
  },

  archiveExport: () => {
    const request = {
      operationId: exportOperationId,
      artifactId,
      sourceStoreId: archiveId,
      createdAtMs: 1_785_139_200_000,
    }
    const mapped = exercise(
      runtimeBoundary.archiveExport,
      request,
      {
        outcome: 'exported',
        archiveId: artifactId,
        createdAt: '2026-07-26T00:00:00Z',
        counts: { entries: 1, attachments: 1, summaries: 1, tracks: 1 },
        dateRange: {
          start: '2026-07-26T00:00:00Z',
          end: '2026-07-26T23:59:59Z',
        },
        filesWritten: 4,
        checkedFiles: 4,
        checksumAlgorithm: 'sha256',
        browserTransport: {
          transferId: 'archive-export',
          fileName: 'Runtime.lifearchive.tar',
          mimeType: 'application/x-tar',
          byteLength: '3',
        },
        token,
      },
      {
        operation: 'archive.export',
        request: {
          operationId: exportOperationId,
          contractVersion: '5',
          archiveId: artifactId,
          createdAtMs: request.createdAtMs,
          createdBy: {
            appName: 'LifeArchive Web',
            appVersion: packageMetadata.version,
          },
          archiveName: 'LifeArchive.lifearchive',
        },
        mappedTransfers: [exportBytes],
      },
    )
    expect(mapped.artifactId).toBe(artifactId)
    expect(mapped.sourceStoreId).toBe(archiveId)
  },

  archiveErase: () => {
    const request = { confirmation: 'erase-this-archive' as const }
    const mapped = exercise(
      runtimeBoundary.archiveErase,
      request,
      { outcome: 'erased', token },
      { operation: 'archive.erase', request: {} },
    )
    expect(mapped.outcome).toBe('erased')
  },

  identityLoad: () => {
    const mapped = exercise(
      runtimeBoundary.identityLoad,
      null,
      { outcome: 'loaded', identity, token },
      { operation: 'archive.identity.load', request: {} },
    )
    expect(mapped.identity.id).toBe(archiveId)
  },

  identitySave: () => {
    const mapped = exercise(
      runtimeBoundary.identitySave,
      identity,
      { outcome: 'updated', identity, token },
      {
        operation: 'archive.identity.save',
        request: { identity },
      },
    )
    expect(mapped.outcome).toBe('updated')
  },

  timeWindow: () => {
    const request = {
      scale: 'day' as const,
      containing: civilDate('2026-07-26'),
      timeZoneId: 'Europe/Copenhagen',
      weekRules,
    }
    const mapped = exercise(runtimeBoundary.timeWindow, request, window, {
      operation: 'time.window',
      request: {
        contractVersion: 1,
        scale: 'day',
        anchorDate: '2026-07-26',
        calendarIdentifier: 'gregorian',
        timeZoneIdentifier: 'Europe/Copenhagen',
        firstWeekday: 2,
        minimumDaysInFirstWeek: 4,
      },
    })
    expect(mapped).toEqual(window)
  },

  timeStep: () => {
    const request = { window, step: 'next' as const, weekRules }
    const mapped = exercise(runtimeBoundary.timeStep, request, window, {
      operation: 'time.step',
      request: {
        contractVersion: 1,
        scale: 'day',
        anchorDate: '2026-07-26',
        step: 'next',
        calendarIdentifier: 'gregorian',
        timeZoneIdentifier: 'Europe/Copenhagen',
        firstWeekday: 2,
        minimumDaysInFirstWeek: 4,
      },
    })
    expect(mapped).toEqual(window)
  },

  timeCalendarContext: () => {
    const request = {
      focusedDate: civilDate('2026-07-26'),
      timeZoneId: 'Europe/Copenhagen',
      weekRules,
    }
    const day = {
      date: '2026-07-26',
      window,
      withinFocusedMonth: true,
    }
    const mapped = exercise(
      runtimeBoundary.timeCalendarContext,
      request,
      {
        focused: window,
        focusedDate: '2026-07-26',
        week: [day],
        month: [day],
      },
      {
        operation: 'time.calendarContext',
        request: {
          contractVersion: 1,
          focusedDate: '2026-07-26',
          calendarIdentifier: 'gregorian',
          timeZoneIdentifier: 'Europe/Copenhagen',
          firstWeekday: 2,
          minimumDaysInFirstWeek: 4,
        },
      },
    )
    expect(mapped.week[0]?.window).toEqual(window)
  },

  recordLoad: () => {
    const mapped = exercise(
      runtimeBoundary.recordLoad,
      window,
      { outcome: 'loaded', current: runtimeOrdinaryCurrent, token },
      {
        operation: 'record.loadSpan',
        request: { contractVersion: 1, span: runtimeRecordSpan },
      },
    )
    expect(mapped.presence).toBe('present')
  },

  recordSave: () => {
    const request = {
      window,
      markdown: 'Exact runtime writing',
      nowMs: 1_785_139_200_010,
      target: {
        expectation: 'existing' as const,
        entryId,
        expectedRevision: revision('2'),
      },
    }
    const mapped = exercise(
      runtimeBoundary.recordSave,
      request,
      { outcome: 'updated', current: runtimeOrdinaryCurrent, token },
      {
        operation: 'record.saveDraft',
        request: {
          contractVersion: 1,
          span: runtimeRecordSpan,
          draft: request.markdown,
          nowMs: request.nowMs,
          entryId,
          expectedRevision: revision('2'),
        },
      },
    )
    expect(mapped.outcome).toBe('updated')
  },

  recordDelete: () => {
    const request = {
      window,
      entryId,
      expectedRevision: revision('3'),
      nowMs: 1_785_139_200_011,
    }
    const mapped = exercise(
      runtimeBoundary.recordDelete,
      request,
      {
        outcome: 'softDeleted',
        deletedEntryId: entryId,
        deletedRevision: '3',
        token,
      },
      {
        operation: 'record.deleteEntry',
        request: {
          contractVersion: 1,
          entryId,
          expectedRevision: revision('3'),
          nowMs: request.nowMs,
        },
      },
    )
    expect(mapped.outcome).toBe('deleted')
    if (mapped.outcome !== 'deleted') {
      throw new Error('expected a deleted ordinary record result')
    }
    expect(mapped.deletedEntryId).toBe(entryId)
  },

  recordListObjects: () => {
    const request = { window, limit: 10 }
    const mapped = exercise(
      runtimeBoundary.recordListObjects,
      request,
      {
        outcome: 'listed',
        summaries: [runtimeStructuredSummary],
        token,
      },
      {
        operation: 'record.listObjects',
        request: { span: runtimeRecordSpan, limit: 10 },
      },
    )
    expect(mapped.objects).toHaveLength(1)
  },

  structuredLoad: () => {
    const request = { id: objectId, includeDeleted: true }
    const mapped = exercise(
      runtimeBoundary.structuredLoad,
      request,
      {
        outcome: 'loaded',
        current: runtimeStructuredSnapshot,
        token,
      },
      {
        operation: 'structured.load',
        request,
      },
    )
    expect(mapped.presence).toBe('present')
  },

  structuredCreate: () => {
    const request = {
      newObjectId: objectId,
      draft: structuredDraft,
      nowMs: 1_785_139_200_012,
    }
    const mapped = exercise(
      runtimeBoundary.structuredCreate,
      request,
      {
        outcome: 'created',
        current: runtimeStructuredSnapshot,
        token,
      },
      {
        operation: 'structured.create',
        request: {
          id: objectId,
          expectation: 'absent',
          draft: runtimeStructuredDraft,
          nowMs: request.nowMs,
        },
      },
    )
    expect(mapped.outcome).toBe('created')
  },

  structuredSave: () => {
    const request = {
      id: objectId,
      expectedRevision: revision('3'),
      draft: structuredDraft,
      nowMs: 1_785_139_200_013,
    }
    const mapped = exercise(
      runtimeBoundary.structuredSave,
      request,
      {
        outcome: 'updated',
        current: runtimeStructuredSnapshot,
        token,
      },
      {
        operation: 'structured.save',
        request: {
          id: objectId,
          expectedRevision: revision('3'),
          draft: runtimeStructuredDraft,
          nowMs: request.nowMs,
        },
      },
    )
    expect(mapped.outcome).toBe('updated')
  },

  structuredDelete: () => {
    const request = {
      id: objectId,
      expectedRevision: revision('4'),
      nowMs: 1_785_139_200_014,
    }
    const mapped = exercise(
      runtimeBoundary.structuredDelete,
      request,
      {
        outcome: 'softDeleted',
        deletedEntryId: objectId,
        deletedRevision: '4',
        token,
      },
      {
        operation: 'structured.delete',
        request: { contractVersion: 2, ...request },
      },
    )
    expect(mapped.outcome).toBe('deleted')
  },

  structuredConvert: () => {
    const request = {
      spanId: objectId,
      expectedRevision: revision('4'),
      requestedStartDate: civilDate('2026-07-26'),
      requestedEndDate: civilDate('2026-07-27'),
      nowMs: 1_785_139_200_015,
    }
    const mapped = exercise(
      runtimeBoundary.structuredConvert,
      request,
      {
        outcome: 'converted',
        current: runtimeStructuredSnapshot,
        token,
      },
      {
        operation: 'structured.convertSpanToEvent',
        request: {
          contractVersion: 2,
          id: objectId,
          expectedRevision: request.expectedRevision,
          requestedStartDate: request.requestedStartDate,
          requestedEndDate: request.requestedEndDate,
          nowMs: request.nowMs,
        },
      },
    )
    expect(mapped.outcome).toBe('converted')
  },

  trackList: () => {
    const request = { includeArchived: false, limit: 10 }
    const mapped = exercise(
      runtimeBoundary.trackList,
      request,
      {
        tracks: [
          {
            current: runtimeTrackSnapshot,
            memberCount: 1,
            ongoingMemberCount: 0,
          },
        ],
        token,
      },
      {
        operation: 'track.list',
        request: { archived: false, limit: 10 },
      },
    )
    expect(mapped.tracks[0]?.track.createdAtMs).toBe(
      Date.parse('2026-07-26T00:00:00Z'),
    )
  },

  trackLoad: () => {
    const mapped = exercise(
      runtimeBoundary.trackLoad,
      trackId,
      { current: runtimeTrackSnapshot, token },
      {
        operation: 'track.load',
        request: { id: trackId, includeDeleted: true },
      },
    )
    expect(mapped.presence).toBe('present')
  },

  trackCreate: () => {
    const request = {
      newTrackId: trackId,
      draft: trackDraft,
      nowMs: 1_785_139_200_016,
    }
    const mapped = exercise(
      runtimeBoundary.trackCreate,
      request,
      { outcome: 'created', current: runtimeTrackSnapshot, token },
      {
        operation: 'track.create',
        request: {
          id: trackId,
          expectation: 'absent',
          draft: runtimeTrackDraft,
          nowMs: request.nowMs,
        },
      },
    )
    expect(mapped.outcome).toBe('created')
  },

  trackSave: () => {
    const request = {
      id: trackId,
      expectedRevision: revision('4'),
      draft: trackDraft,
      nowMs: 1_785_139_200_017,
    }
    const mapped = exercise(
      runtimeBoundary.trackSave,
      request,
      { outcome: 'updated', current: runtimeTrackSnapshot, token },
      {
        operation: 'track.save',
        request: {
          id: trackId,
          expectedRevision: revision('4'),
          draft: runtimeTrackDraft,
          nowMs: request.nowMs,
        },
      },
    )
    expect(mapped.outcome).toBe('updated')
  },

  trackDelete: () => {
    const request = {
      id: trackId,
      expectedRevision: revision('5'),
      detachMembers: true,
      nowMs: 1_785_139_200_018,
    }
    const mapped = exercise(
      runtimeBoundary.trackDelete,
      request,
      {
        outcome: 'deleted',
        current: {
          ...runtimeTrackSnapshot,
          track: {
            ...runtimeTrackSnapshot.track,
            deletedAt: '2026-07-26T00:00:02Z',
          },
        },
        detachedMemberCount: 1,
        token,
      },
      {
        operation: 'track.delete',
        request,
      },
    )
    expect(mapped.outcome).toBe('deleted')
    if (mapped.outcome !== 'deleted') {
      throw new Error('expected a deleted Track result')
    }
    expect(mapped.detachedMemberCount).toBe(1)
  },

  trackCreateWithFirstMember: () => {
    const request = {
      newTrackId: trackId,
      newMemberId: objectId,
      track: trackDraft,
      member: structuredDraft,
      tagStateOmitted: true,
      nowMs: 1_785_139_200_019,
    }
    const mapped = exercise(
      runtimeBoundary.trackCreateWithFirstMember,
      request,
      {
        track: runtimeTrackSnapshot,
        member: runtimeStructuredSnapshot,
        token,
      },
      {
        operation: 'track.createWithFirstMember',
        request: {
          trackId,
          memberId: objectId,
          track: runtimeTrackDraft,
          member: runtimeStructuredDraft,
          tagStateOmitted: true,
          nowMs: request.nowMs,
        },
      },
    )
    expect(mapped.member.summary.id).toBe(objectId)
  },

  trackHistory: () => {
    const request = {
      trackId,
      expectedTrackRevision: revision('5'),
      expectedInvalidation: token,
      limit: 10,
      cursor: coreTrackHistoryCursor('opaque-history-cursor'),
    }
    const mapped = exercise(
      runtimeBoundary.trackHistory,
      request,
      {
        track: runtimeTrackSnapshot,
        members: [
          {
            id: objectId,
            mutationRevision: '4',
            kind: 'event',
            title: 'Runtime event',
            primaryDate: '2026-07-26',
            endDate: null,
            iconId: 'calendar',
            displayTagId: 'family',
            beginMarkerTitleOverride: null,
            endMarkerTitleOverride: null,
          },
        ],
        nextCursor: 'opaque-next-cursor',
        token,
      },
      {
        operation: 'track.history',
        request: {
          trackId,
          expectedTrackRevision: revision('5'),
          expectedToken: token,
          limit: 10,
          cursor: request.cursor,
        },
      },
    )
    expect(mapped.members).toHaveLength(1)
  },

  trackAttachMember: () => {
    const request = {
      memberId: objectId,
      memberKind: 'event' as const,
      trackId,
      expectedMemberRevision: revision('3'),
      expectedInvalidation: token,
      nowMs: 1_785_139_200_020,
    }
    const mapped = exercise(
      runtimeBoundary.trackAttachMember,
      request,
      {
        outcome: 'updated',
        current: runtimeStructuredSnapshot,
        token,
      },
      {
        operation: 'track.attachMember',
        request: {
          memberId: objectId,
          memberKind: 'event',
          trackId,
          expectedMemberRevision: revision('3'),
          expectedToken: token,
          nowMs: request.nowMs,
        },
      },
    )
    expect(mapped.outcome).toBe('updated')
  },

  trackDetachMember: () => {
    const request = {
      memberId: objectId,
      memberKind: 'event' as const,
      expectedMemberRevision: revision('4'),
      expectedInvalidation: token,
      nowMs: 1_785_139_200_021,
    }
    const mapped = exercise(
      runtimeBoundary.trackDetachMember,
      request,
      {
        outcome: 'updated',
        current: {
          ...runtimeStructuredSnapshot,
          summary: {
            ...runtimeStructuredSummary,
            metadata: { ...runtimeStructuredMetadata, trackId: null },
          },
        },
        token,
      },
      {
        operation: 'track.detachMember',
        request: {
          memberId: objectId,
          memberKind: 'event',
          expectedMemberRevision: revision('4'),
          expectedToken: token,
          nowMs: request.nowMs,
        },
      },
    )
    expect(mapped.outcome).toBe('updated')
  },

  trackCreateMember: () => {
    const request = {
      trackId,
      expectedTrackRevision: revision('5'),
      expectedInvalidation: token,
      newMemberId: objectId,
      member: structuredDraft,
      tagStateOmitted: true,
      nowMs: 1_785_139_200_022,
    }
    const mapped = exercise(
      runtimeBoundary.trackCreateMember,
      request,
      {
        outcome: 'created',
        current: runtimeStructuredSnapshot,
        token,
      },
      {
        operation: 'track.createMember',
        request: {
          trackId,
          expectedTrackRevision: revision('5'),
          expectedToken: token,
          memberId: objectId,
          member: runtimeStructuredDraft,
          tagStateOmitted: true,
          nowMs: request.nowMs,
        },
      },
    )
    expect(mapped.outcome).toBe('created')
  },

  timelineIndex: () => {
    const request = {
      windows: [window],
      weekRules,
      asOf: civilDate('2026-07-26'),
    }
    const mapped = exercise(
      runtimeBoundary.timelineIndex,
      request,
      {
        rows: [
          {
            span: runtimeTimelineSpan,
            exactEntry: null,
            exactEntryHasWriting: false,
            attachmentCount: 0,
            dayEntryCount: 1,
            weekEntryCount: 0,
            monthEntryCount: 0,
            coverage: { numerator: 1, denominator: 1 },
            hasContent: true,
          },
        ],
        structuredScene: [runtimeStructuredSummary],
        derivedMarkers: [
          {
            boundary: 'begin',
            date: '2026-07-26',
            parentSpanId: objectId,
            parentSpanRevision: '4',
            parentStartDate: '2026-07-26',
            parentEndDate: null,
            trackId,
            titleMode: 'automatic',
            titleOverride: null,
            iconId: 'calendar',
            displayTagId: 'family',
          },
        ],
        contentBounds: {
          startMs: window.startMs,
          endMs: window.endMs,
        },
        structuredContentEndDate: '2026-07-26',
        token,
      },
      {
        operation: 'timeline.index',
        request: {
          contractVersion: 1,
          spans: [runtimeTimelineSpan],
          firstWeekday: 2,
          minimumDaysInFirstWeek: 4,
          sceneStartDate: window.startDate,
          sceneEndDate: window.endDate,
          asOfCivilDate: request.asOf,
        },
      },
    )
    expect(mapped.rows).toHaveLength(1)
  },

  timelineFocus: () => {
    const request = {
      window,
      weekRules,
      entry: { id: entryId, revision: revision('3') },
      expectedInvalidation: token,
    }
    const mapped = exercise(
      runtimeBoundary.timelineFocus,
      request,
      {
        span: runtimeTimelineSpan,
        exactEntry: {
          reference: { id: entryId, mutationRevision: '3' },
          text: 'Exact runtime writing',
          preview: 'Exact runtime',
        },
        attachments: [runtimeMediaItem],
        token,
      },
      {
        operation: 'timeline.focusedDetail',
        request: {
          contractVersion: 1,
          span: runtimeTimelineSpan,
          firstWeekday: 2,
          minimumDaysInFirstWeek: 4,
          expectedEntry: { id: entryId, mutationRevision: revision('3') },
          expectedToken: token,
        },
      },
    )
    expect(mapped.outcome).toBe('focused')
  },

  timelineStructuredDetail: () => {
    const request = {
      id: objectId,
      expectedRevision: revision('4'),
      expectedInvalidation: token,
    }
    const mapped = exercise(
      runtimeBoundary.timelineStructuredDetail,
      request,
      { outcome: 'detail', detail: runtimeStructuredSnapshot, token },
      {
        operation: 'timeline.structuredDetail',
        request: {
          id: objectId,
          expectedRevision: revision('4'),
          token,
        },
      },
    )
    expect(mapped.outcome).toBe('detail')
  },

  timelineStructuredList: () => {
    const request = {
      ids: [objectId],
      limit: 10,
      expectedInvalidation: token,
    }
    const mapped = exercise(
      runtimeBoundary.timelineStructuredList,
      request,
      {
        outcome: 'listed',
        summaries: [runtimeStructuredSummary],
        token,
      },
      {
        operation: 'timeline.structuredList',
        request: { ids: [objectId], limit: 10, token },
      },
    )
    expect(mapped.outcome).toBe('listed')
  },

  mediaList: () => {
    const request = { parentEntryId: entryId }
    const mapped = exercise(
      runtimeBoundary.mediaList,
      request,
      {
        outcome: 'listed',
        entryId,
        entryRevision: '3',
        attachments: [runtimeMediaItem],
        token,
      },
      {
        operation: 'media.listForEntry',
        request: { entryId },
      },
    )
    expect(mapped.items).toHaveLength(1)
  },

  mediaContent: () => {
    const request = { mediaId }
    const mapped = exercise(
      runtimeBoundary.mediaContent,
      request,
      {
        outcome: 'resolved',
        attachmentId: mediaId,
        byteSize: 3,
        sha256: 'abc123',
        contentTransferId: 'media-content',
      },
      {
        operation: 'media.resolveContent',
        request: { attachmentId: mediaId },
        mappedTransfers: [mediaBytes],
      },
    )
    expect(mapped.bytes).toEqual(new Uint8Array(mediaBytes))
  },

  mediaImport: () => {
    const request = {
      newMediaId: mediaId,
      parentEntryId: entryId,
      expectedParentRevision: revision('3'),
      fileName: 'photo.jpg',
      bytes: mediaBytes,
      createdAtMs: 1_785_139_200_023,
      mimeTypeHint: 'image/jpeg',
      kindHint: 'image' as const,
    }
    const mapped = exercise(
      runtimeBoundary.mediaImport,
      request,
      {
        outcome: 'imported',
        attachment: runtimeMediaItem,
        token,
      },
      {
        operation: 'media.import',
        request: {
          attachmentId: mediaId,
          entryId,
          expectedRevision: revision('3'),
          fileName: 'photo.jpg',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          declaredSha256: null,
          createdAtMs: request.createdAtMs,
          capturedAtMs: null,
          durationMs: null,
          width: null,
          height: null,
          cloudAssetId: null,
          transcription: null,
          caption: null,
          aiCaption: null,
          sourceTransferId: 'media-source',
        },
        preparedTransfers: [mediaBytes],
      },
    )
    expect(mapped.item.id).toBe(mediaId)
  },

  mediaDelete: () => {
    const request = {
      mediaId,
      parentEntryId: entryId,
      expectedParentRevision: revision('3'),
    }
    const mapped = exercise(
      runtimeBoundary.mediaDelete,
      request,
      { outcome: 'deleted', attachmentId: mediaId, token },
      {
        operation: 'media.delete',
        request: {
          attachmentId: mediaId,
          entryId,
          expectedRevision: revision('3'),
        },
      },
    )
    expect(mapped.deletedMediaId).toBe(mediaId)
  },
} satisfies Record<keyof typeof runtimeBoundary, () => void>

describe('runtimeBoundary operation contracts', () => {
  expect(Object.keys(cases)).toEqual(Object.keys(runtimeBoundary))

  for (const [name, run] of Object.entries(cases)) {
    it(name, run)
  }
})
