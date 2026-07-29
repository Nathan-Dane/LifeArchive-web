import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  civilDate,
  revision,
  stableId,
  type StructuredSummary,
} from '../../../core/client'
import { I18nProvider } from '../../../i18n'
import { coreWindow } from '../../../test/timeFixtures'
import type {
  TemporalMotion,
  TemporalStatus,
} from '../navigation/temporalCursor'
import { RecordObjectSwitcher } from './RecordObjectSwitcher'
import type { RecordObjects, RecordObjectsState } from './recordObjects'

const RETAINED_SPAN: StructuredSummary = {
  id: stableId('6f1c0a10-0000-4000-8000-000000000101'),
  revision: revision('1'),
  title: 'Retained span',
  placement: {
    kind: 'span',
    startDate: civilDate('2025-01-01'),
    endDate: civilDate('2025-12-31'),
    beginMarker: { enabled: false, titleOverride: null },
    endMarker: { enabled: false, titleOverride: null },
  },
  iconId: 'span',
  tags: { ordered: [], display: null },
  trackId: null,
}

const DEPARTING_EVENT: StructuredSummary = {
  id: stableId('6f1c0a10-0000-4000-8000-000000000102'),
  revision: revision('1'),
  title: 'Departing event',
  placement: { kind: 'event', date: civilDate('2025-06-14') },
  iconId: 'life-event',
  tags: { ordered: [], display: null },
  trackId: null,
}

const ARRIVING_EVENT: StructuredSummary = {
  ...DEPARTING_EVENT,
  id: stableId('6f1c0a10-0000-4000-8000-000000000103'),
  title: 'Arriving event',
  placement: { kind: 'event', date: civilDate('2025-06-15') },
}

const ARRIVING_SPAN: StructuredSummary = {
  ...RETAINED_SPAN,
  id: stableId('6f1c0a10-0000-4000-8000-000000000104'),
  title: 'Arriving span',
}

function recordObjects(
  objects: readonly StructuredSummary[],
  status: RecordObjectsState['status'] = 'ready',
): RecordObjects {
  return {
    state: {
      status,
      objects,
      bounded: false,
      selected: null,
      notice: null,
      failure: null,
    },
    selectOrdinary: vi.fn(),
    selectObject: vi.fn(),
    goToObject: vi.fn(),
    selectCreated: vi.fn(),
    replaceObject: vi.fn(),
    removeObject: vi.fn(),
    dismissNotice: vi.fn(),
    retry: vi.fn(),
  }
}

function motion(
  id: number,
  kind: TemporalMotion['kind'],
  direction: TemporalMotion['direction'],
): TemporalMotion {
  return { id, kind, direction }
}

function switcher(
  objects: RecordObjects,
  navigationStatus: TemporalStatus,
  navigationMotion: TemporalMotion | null,
  scale: 'day' | 'month' = 'day',
) {
  return (
    <I18nProvider locale="en">
      <RecordObjectSwitcher
        scale={scale}
        window={coreWindow(scale, '2025-06-14')}
        objects={objects}
        creatingEvent={false}
        creatingSpan={false}
        navigationStatus={navigationStatus}
        motion={navigationMotion}
        onCreateEvent={vi.fn()}
        onCreateSpan={vi.fn()}
      />
    </I18nProvider>
  )
}

function tab(id: StructuredSummary['id']): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-object-id="${id}"]`,
  )
  if (!element) throw new Error(`Missing object tab ${id}`)
  return element
}

function ordinaryEntry(): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    '.record-objects__ordinary-layer[data-layer="current"] .record-objects__tab--ordinary',
  )
  if (!element) throw new Error('Missing current ordinary entry')
  return element
}

describe('RecordObjectSwitcher presence transitions', () => {
  it('keeps retained rows stationary while only entering and exiting rows move', () => {
    const initial = recordObjects([DEPARTING_EVENT, RETAINED_SPAN])
    const rendered = render(switcher(initial, 'ready', null))
    const retained = tab(RETAINED_SPAN.id)
    const previousOrdinary = ordinaryEntry()
    const groups = document.querySelector('.record-objects__groups')

    rendered.rerender(
      switcher(
        recordObjects([], 'loading'),
        'loading',
        motion(1, 'horizontal', 'forward'),
      ),
    )
    expect(tab(RETAINED_SPAN.id)).toBe(retained)

    rendered.rerender(
      switcher(
        recordObjects([ARRIVING_EVENT, RETAINED_SPAN]),
        'ready',
        motion(1, 'horizontal', 'forward'),
      ),
    )

    expect(tab(RETAINED_SPAN.id)).toBe(retained)
    expect(retained.closest('.record-objects__item-shell')).toHaveAttribute(
      'data-presence',
      'stable',
    )
    expect(
      tab(DEPARTING_EVENT.id).closest('.record-objects__item-shell'),
    ).toHaveAttribute('data-presence', 'exiting')
    expect(
      tab(ARRIVING_EVENT.id).closest('.record-objects__item-shell'),
    ).toHaveAttribute('data-presence', 'entering')
    expect(ordinaryEntry()).not.toBe(previousOrdinary)
    expect(
      document.querySelector('.record-objects__ordinary-stack'),
    ).toHaveAttribute('data-transition', 'true')
    expect(
      document.querySelectorAll('.record-objects__ordinary-layer'),
    ).toHaveLength(2)
    expect(document.querySelector('.record-objects__groups')).toBe(groups)
  })

  it('does not replace or animate the full list during a scale change', () => {
    const rendered = render(
      switcher(recordObjects([RETAINED_SPAN]), 'ready', null),
    )
    const retained = tab(RETAINED_SPAN.id)
    const ordinary = ordinaryEntry()
    const groups = document.querySelector('.record-objects__groups')

    rendered.rerender(
      switcher(
        recordObjects([], 'loading'),
        'loading',
        motion(2, 'scale', 'coarser'),
        'month',
      ),
    )
    rendered.rerender(
      switcher(
        recordObjects([RETAINED_SPAN, ARRIVING_SPAN]),
        'ready',
        motion(2, 'scale', 'coarser'),
        'month',
      ),
    )

    expect(tab(RETAINED_SPAN.id)).toBe(retained)
    expect(ordinaryEntry()).toBe(ordinary)
    expect(document.querySelector('.record-objects__groups')).toBe(groups)
    expect(
      tab(ARRIVING_SPAN.id).closest('.record-objects__item-shell'),
    ).toHaveAttribute('data-motion-kind', 'scale')
    expect(
      document.querySelector('.record-objects__transition-stack'),
    ).not.toHaveAttribute('data-motion-kind')
  })
})
