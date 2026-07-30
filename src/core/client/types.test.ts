import { describe, expect, it } from 'vitest'
import { assertNever } from './errors'
import {
  civilDate,
  coreTimeWindow,
  coreTrackHistoryCursor,
  isRevision,
  isStableId,
  revision,
  stableId,
} from './types'
import type {
  ArchiveSession,
  OrdinaryConflictState,
  OrdinaryEntry,
  OrdinaryEntryState,
  OrdinarySaveResult,
  RuntimeStatus,
  StructuredPlacement,
  TimeWindow,
} from './types'

const MAXIMUM_REVISION = '18446744073709551615'

function dayWindow(): TimeWindow {
  return coreTimeWindow({
    id: 'day:0:UTC',
    scale: 'day',
    startMs: 0,
    endMs: 86_400_000,
    startDate: civilDate('1970-01-01'),
    endDate: civilDate('1970-01-01'),
    weekNumber: 1,
    calendarId: 'gregorian',
    timeZoneId: 'UTC',
  })
}

describe('exact identifiers and revisions', () => {
  it('keeps a full-width revision lossless as text', () => {
    expect(revision(MAXIMUM_REVISION)).toBe(MAXIMUM_REVISION)
    expect(Number(MAXIMUM_REVISION).toString()).not.toBe(MAXIMUM_REVISION)
  })

  it('accepts the whole unsigned 64-bit range and nothing beyond it', () => {
    expect(isRevision('0')).toBe(true)
    expect(isRevision('1')).toBe(true)
    expect(isRevision(MAXIMUM_REVISION)).toBe(true)
    expect(isRevision('18446744073709551616')).toBe(false)
    expect(isRevision('99999999999999999999')).toBe(false)
  })

  it('rejects revision text that is not canonical', () => {
    for (const value of ['', '01', '-1', '1.0', ' 1', '1 ', '0x1', '1e3']) {
      expect(isRevision(value)).toBe(false)
      expect(() => revision(value)).toThrow(TypeError)
    }
  })

  it('preserves stable identifier text exactly, including case', () => {
    const upper = 'A1000000-0000-4000-8000-000000000002'
    expect(stableId(upper)).toBe(upper)
    expect(stableId(upper.toLowerCase())).toBe(upper.toLowerCase())
  })

  it('rejects identifier text that is not canonical UUID syntax', () => {
    for (const value of [
      '',
      'A1000000000040008000000000000002',
      'A1000000-0000-4000-8000-00000000000',
      'not-a-uuid',
    ]) {
      expect(isStableId(value)).toBe(false)
      expect(() => stableId(value)).toThrow(TypeError)
    }
  })

  it('checks civil-date syntax without judging whether the date exists', () => {
    expect(civilDate('0001-01-01')).toBe('0001-01-01')
    expect(civilDate('2026-07-19')).toBe('2026-07-19')
    // Syntax is all the client checks: the core decides validity.
    expect(civilDate('2026-02-30')).toBe('2026-02-30')
    for (const value of ['2026-7-10', '26-07-10', '2026/07/10', '']) {
      expect(() => civilDate(value)).toThrow(TypeError)
    }
  })
})

describe('core-produced values', () => {
  it('freezes a mapped time window', () => {
    const window = dayWindow()
    expect(Object.isFrozen(window)).toBe(true)
    expect(window.scale).toBe('day')
    expect(window.timeZoneId).toBe('UTC')
  })

  it('keeps a history cursor opaque text', () => {
    expect(coreTrackHistoryCursor('opaque-cursor')).toBe('opaque-cursor')
  })
})

describe('explicit absence', () => {
  it('states an absent ordinary entry rather than an empty one', () => {
    const state: OrdinaryEntryState = {
      presence: 'absent',
      window: dayWindow(),
      invalidation: { storeInstanceId: 'instance-1', revision: revision('4') },
    }
    expect(state.presence).toBe('absent')
    expect('entry' in state).toBe(false)
  })

  it('presents an ongoing Span as an absent end date', () => {
    const placement: StructuredPlacement = {
      kind: 'span',
      startDate: civilDate('2026-01-01'),
      endDate: null,
      beginMarker: { enabled: true, titleOverride: ' exact ' },
      endMarker: { enabled: false, titleOverride: null },
    }
    expect(placement.kind === 'span' && placement.endDate).toBeNull()
    expect(
      placement.kind === 'span' && placement.beginMarker.titleOverride,
    ).toBe(' exact ')
  })
})

function describeSave(result: OrdinarySaveResult): string {
  switch (result.outcome) {
    case 'created':
    case 'updated':
    case 'unchanged':
      return `${result.outcome}:${result.entry.revision}`
    case 'removed-as-empty':
      return `removed:${result.removedRevision}`
    case 'absent-unchanged':
      return 'absent'
    case 'conflict':
      return `conflict:${result.conflict.expectedRevision}:${result.conflict.actualRevision}`
    default:
      return assertNever(result)
  }
}

describe('save outcomes', () => {
  const invalidation = {
    storeInstanceId: 'instance-1',
    revision: revision('7'),
  }
  const entry: OrdinaryEntry = {
    id: stableId('10000000-0000-4000-8000-000000000001'),
    revision: revision(MAXIMUM_REVISION),
    window: dayWindow(),
    markdown: '  exact writing — 日記\r\n',
    plainText: 'exact writing — 日記',
    createdAtMs: -62_135_596_800_000,
    updatedAtMs: 9_223_372_036_854,
    isPinned: true,
    privacy: 'sensitive',
    source: 'manual',
  }

  it('covers every outcome the core can report', () => {
    expect(describeSave({ outcome: 'created', entry, invalidation })).toBe(
      `created:${MAXIMUM_REVISION}`,
    )
    expect(describeSave({ outcome: 'unchanged', entry, invalidation })).toBe(
      `unchanged:${MAXIMUM_REVISION}`,
    )
    expect(
      describeSave({
        outcome: 'removed-as-empty',
        removedEntryId: entry.id,
        removedRevision: revision('3'),
        invalidation,
      }),
    ).toBe('removed:3')
    expect(describeSave({ outcome: 'absent-unchanged', invalidation })).toBe(
      'absent',
    )
  })

  it('keeps the exact stored writing untouched by the boundary', () => {
    expect(entry.markdown).toBe('  exact writing — 日記\r\n')
    expect(entry.markdown).not.toBe(entry.plainText)
  })

  it('returns current state on a conflict so a buffer can be preserved', () => {
    const current: OrdinaryConflictState = {
      presence: 'present',
      window: dayWindow(),
      entry,
    }
    const result: OrdinarySaveResult = {
      outcome: 'conflict',
      conflict: {
        expectedRevision: revision('1'),
        actualRevision: revision('2'),
        current,
      },
    }
    expect(describeSave(result)).toBe('conflict:1:2')
    expect(result.outcome === 'conflict' && result.conflict.current).toBe(
      current,
    )
  })

  it('refuses an outcome the client does not model', () => {
    const unmodelled = { outcome: 'merged' } as unknown as OrdinarySaveResult
    expect(() => describeSave(unmodelled)).toThrow(TypeError)
  })
})

describe('runtime and session states', () => {
  function describeRuntime(status: RuntimeStatus): string {
    switch (status.state) {
      case 'checking':
        return 'checking'
      case 'available':
        return `available:${status.runtime.mode}:${status.runtime.durability}`
      case 'incompatible':
        return `incompatible:${status.reason}`
      case 'unavailable':
        return `unavailable:${status.reason}`
      default:
        return assertNever(status)
    }
  }

  function describeSession(session: ArchiveSession): string {
    switch (session.state) {
      case 'no-archive':
      case 'opening':
      case 'closing':
      case 'closed':
      case 'open-in-another-tab':
      case 'needs-recovery':
      case 'incompatible':
        return session.state
      case 'open':
        return `open:${session.archive.storeId}`
      case 'lost':
        return `lost:${session.durableOutcome}`
      default:
        return assertNever(session)
    }
  }

  it('never reports an available runtime without real facts', () => {
    expect(describeRuntime({ state: 'checking' })).toBe('checking')
    expect(
      describeRuntime({ state: 'unavailable', reason: 'not-integrated' }),
    ).toBe('unavailable:not-integrated')
    expect(
      describeRuntime({
        state: 'incompatible',
        reason: 'capability-inventory-mismatch',
      }),
    ).toBe('incompatible:capability-inventory-mismatch')
    expect(
      describeRuntime({
        state: 'available',
        runtime: {
          mode: 'development-mock',
          runtimeVersion: '0.0.0',
          buildId: 'opaque-build',
          productContract: '5',
          browserAbi: '1',
          backend: 'unproven',
          durability: 'unproven',
        },
      }),
    ).toBe('available:development-mock:unproven')
  })

  it('gives every archive lifecycle state one value-based outcome', () => {
    expect(describeSession({ state: 'no-archive' })).toBe('no-archive')
    expect(describeSession({ state: 'open-in-another-tab' })).toBe(
      'open-in-another-tab',
    )
    expect(describeSession({ state: 'lost', durableOutcome: 'unknown' })).toBe(
      'lost:unknown',
    )
    expect(
      describeSession({
        state: 'open',
        archive: {
          storeId: stableId('10000000-0000-4000-8000-000000000001'),
          productContract: '5',
          storeSchemaVersion: '7',
          rootLayoutVersion: '1',
          invalidation: {
            storeInstanceId: 'instance-1',
            revision: revision('0'),
          },
        },
      }),
    ).toBe('open:10000000-0000-4000-8000-000000000001')
  })
})
