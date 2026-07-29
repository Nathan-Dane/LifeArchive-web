/**
 * Record time navigation.
 *
 * The property under test throughout is that **the core decides where in time
 * the reader is and the panel only shows it**. So the assertions are about the
 * requests that went out, the values that came back, and the fact that nothing
 * on screen was worked out here: a week is as long as the core said, a month
 * contains the days the core placed, a step lands where the core answered, and
 * an answer to a question the reader has already moved on from is dropped.
 */

import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clientFailure,
  failed,
  ok,
  type CalendarContext,
  type CalendarContextRequest,
  type ClientResult,
  type LifeArchiveClient,
  type TimeWindow,
  type TimeWindowRequest,
  type WindowStepRequest,
} from '../../../core/client'
import { I18nProvider } from '../../../i18n'
import { setClientMedia } from '../../../test/clientMedia'
import { renderAppAt } from '../../../test/render'
import { TestLifeArchiveClient } from '../../../test/TestLifeArchiveClient'
import {
  coreCalendarContext,
  coreCalendarDay,
  coreWindow,
} from '../../../test/timeFixtures'
import { createDeviceCalendar } from './deviceCalendar'
import { RecordNavigationPanel } from './RecordNavigationPanel'
import { useTemporalCursor } from './temporalCursor'

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

/** The device the panel is read on. Fixed so no assertion depends on today. */
const DEVICE = createDeviceCalendar({
  timeZoneId: 'UTC',
  now: () => new Date('2025-06-14T09:00:00Z'),
})

const FIXTURE_TODAY = '2025-06-14'

beforeEach(() => {
  localStorage.clear()
})

const WEEK_OF_FOURTEENTH = [
  '2025-06-09',
  '2025-06-10',
  '2025-06-11',
  '2025-06-12',
  '2025-06-13',
  '2025-06-14',
  '2025-06-15',
]

const UNAVAILABLE = clientFailure({
  area: 'compatibility',
  code: 'unsupportedCapability',
  phase: 'negotiation',
  retryable: false,
})

const BUSY = clientFailure({
  area: 'concurrency',
  code: 'busyRetryable',
  phase: 'snapshot',
  retryable: true,
})

/* -------------------------------------------------------------------------- */
/* A client whose answers each test scripts for itself                        */
/* -------------------------------------------------------------------------- */

interface TimeStub {
  readonly client: LifeArchiveClient
  readonly window: ReturnType<typeof vi.fn>
  readonly step: ReturnType<typeof vi.fn>
  readonly calendarContext: ReturnType<typeof vi.fn>
}

function timeStub(answers: {
  window?: (request: TimeWindowRequest) => Promise<ClientResult<TimeWindow>>
  step?: (request: WindowStepRequest) => Promise<ClientResult<TimeWindow>>
  calendarContext?: (
    request: CalendarContextRequest,
  ) => Promise<ClientResult<CalendarContext>>
}): TimeStub {
  const window = vi.fn(
    answers.window ?? (async () => ok(coreWindow('day', FIXTURE_TODAY))),
  )
  const step = vi.fn(
    answers.step ?? (async () => ok(coreWindow('day', '2025-06-13'))),
  )
  const calendarContext = vi.fn(
    answers.calendarContext ??
      (async () => ok(coreCalendarContext(FIXTURE_TODAY, WEEK_OF_FOURTEENTH))),
  )
  return {
    client: {
      time: { window, step, calendarContext },
    } as unknown as LifeArchiveClient,
    window,
    step,
    calendarContext,
  }
}

/**
 * The panel presents a cursor it is given. Record builds that cursor once for
 * its three regions; here one holder stands in for that composition, so every
 * assertion below is still about the panel and the core behind it.
 */
function PanelHolder({ client }: { readonly client: LifeArchiveClient }) {
  const cursor = useTemporalCursor(client, { device: DEVICE })
  return <RecordNavigationPanel cursor={cursor} />
}

function renderPanel(client: LifeArchiveClient) {
  return render(
    <I18nProvider locale="en-GB">
      <PanelHolder client={client} />
    </I18nProvider>,
  )
}

async function panelReady(): Promise<HTMLElement> {
  const navigation = await screen.findByRole('navigation', { name: 'Time' })
  await waitFor(() => expect(navigation).not.toHaveAttribute('aria-busy'))
  return navigation
}

/** The visible civil location, distinct from the quiet region repeating it. */
function locationText(): string {
  return (
    document.querySelector('.record-navigation__location')?.textContent ?? ''
  )
}

function weekCells(): HTMLElement {
  return screen.getByRole('group', { name: 'Week of the selected date' })
}

function monthCells(): HTMLElement {
  return screen.getByRole('group', { name: 'Month around the selected date' })
}

/* -------------------------------------------------------------------------- */
/* What the panel asks the core                                               */
/* -------------------------------------------------------------------------- */

describe('the requests time navigation makes', () => {
  it('asks for the window and the calendar of the device s own civil day', async () => {
    const client = new TestLifeArchiveClient({ state: 'no-archive' })
    renderPanel(client.client)
    await panelReady()

    expect(client.calls.to('time.window').map((call) => call.request)).toEqual([
      {
        scale: 'day',
        containing: FIXTURE_TODAY,
        timeZoneId: 'UTC',
        weekRules: DEVICE.weekRules,
      },
    ])
    expect(
      client.calls.to('time.calendarContext').map((call) => call.request),
    ).toEqual([
      {
        focusedDate: FIXTURE_TODAY,
        timeZoneId: 'UTC',
        weekRules: DEVICE.weekRules,
      },
    ])
  })

  it('asks once per cursor position rather than once per cell', async () => {
    const user = userEvent.setup()
    const client = new TestLifeArchiveClient({ state: 'no-archive' })
    renderPanel(client.client)
    await panelReady()
    await user.click(
      screen.getByRole('button', { name: 'Show the surrounding month' }),
    )

    /* The development mock places 42 days; none of them was asked about. */
    expect(within(monthCells()).getAllByRole('button')).toHaveLength(42)
    expect(client.calls.countOf('time.window')).toBe(1)
    expect(client.calls.countOf('time.calendarContext')).toBe(1)
  })
})

/* -------------------------------------------------------------------------- */
/* What the panel shows                                                       */
/* -------------------------------------------------------------------------- */

describe('the civil location and the cells', () => {
  it('keeps the compact command strip on the core-focused civil date', async () => {
    const stub = timeStub({
      window: async () => ok(coreWindow('week', '2025-06-09', '2025-06-15')),
    })
    renderPanel(stub.client)
    await panelReady()

    /* Scale changes do not replace the compact date control with a range. */
    expect(locationText()).toBe('14 Jun 2025')
  })

  it('renders exactly the days the core placed, in the order it placed them', async () => {
    const stub = timeStub({})
    renderPanel(stub.client)
    await panelReady()

    expect(
      within(weekCells())
        .getAllByRole('button')
        .map((cell) => cell.getAttribute('aria-label')),
    ).toEqual([
      '9 June 2025',
      '10 June 2025',
      '11 June 2025',
      '12 June 2025',
      '13 June 2025',
      '14 June 2025',
      '15 June 2025',
    ])
  })

  it('lays the grid out as wide as the week the core returned', async () => {
    const shortWeek = ['2025-06-09', '2025-06-10', '2025-06-11']
    const stub = timeStub({
      calendarContext: async () =>
        ok(coreCalendarContext('2025-06-10', shortWeek, shortWeek)),
    })
    const { container } = renderPanel(stub.client)
    await panelReady()

    const cells = container.querySelector('.record-calendar__cells')
    expect(cells?.getAttribute('style')).toContain(
      '--record-calendar-columns: 3',
    )
    expect(within(weekCells()).getAllByRole('button')).toHaveLength(3)
  })

  it('marks the core s focused date and the device s own day distinctly', async () => {
    const stub = timeStub({
      calendarContext: async () =>
        ok(coreCalendarContext('2025-06-11', WEEK_OF_FOURTEENTH)),
    })
    renderPanel(stub.client)
    await panelReady()

    const cells = within(weekCells())
    expect(cells.getByRole('button', { name: '11 June 2025' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(cells.getByRole('button', { name: '14 June 2025' })).toHaveAttribute(
      'aria-current',
      'date',
    )
    expect(cells.getByRole('button', { name: '14 June 2025' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('marks an out-of-month day the core flagged without hiding its date', async () => {
    const stub = timeStub({
      calendarContext: async () =>
        ok(
          coreCalendarContext('2025-06-01', [
            coreCalendarDay('2025-05-31', false),
            coreCalendarDay('2025-06-01'),
          ]),
        ),
    })
    renderPanel(stub.client)
    await panelReady()

    const outside = within(weekCells()).getByRole('button', {
      name: '31 May 2025',
    })
    expect(outside).toHaveAttribute('data-outside', 'true')
    expect(
      within(weekCells()).getByRole('button', { name: '1 June 2025' }),
    ).not.toHaveAttribute('data-outside')
  })

  it('centres the selected broader period between core-returned neighbours', async () => {
    const user = userEvent.setup()
    const current = coreWindow('month', '2025-06-01', '2025-06-30')
    const previous = coreWindow('month', '2025-05-01', '2025-05-31')
    const next = coreWindow('month', '2025-07-01', '2025-07-31')
    const stub = timeStub({
      window: async (request) =>
        ok(
          request.scale === 'month'
            ? current
            : coreWindow('day', FIXTURE_TODAY),
        ),
      step: async (request) =>
        ok(request.step === 'previous' ? previous : next),
    })
    renderPanel(stub.client)
    await panelReady()

    await user.click(screen.getByRole('button', { name: 'Month' }))
    await panelReady()
    const strip = await screen.findByRole('group', {
      name: 'Periods around the selected period',
    })
    const periods = within(strip).getAllByRole('button')

    expect(periods.map((period) => period.textContent)).toEqual([
      'May',
      'Jun',
      'Jul',
    ])
    expect(
      periods.map((period) => period.getAttribute('aria-pressed')),
    ).toEqual(['false', 'true', 'false'])
    expect(locationText()).toBe('June 2025')
    expect(
      screen.queryByRole('group', { name: 'Week of the selected date' }),
    ).toBeNull()
    expect(stub.step).toHaveBeenCalledWith({
      window: current,
      step: 'previous',
      weekRules: DEVICE.weekRules,
    })
    expect(stub.step).toHaveBeenCalledWith({
      window: current,
      step: 'next',
      weekRules: DEVICE.weekRules,
    })
  })
})

/* -------------------------------------------------------------------------- */
/* Moving the cursor                                                          */
/* -------------------------------------------------------------------------- */

describe('moving the cursor', () => {
  it('keeps the anchor when the scale changes', async () => {
    const user = userEvent.setup()
    const client = new TestLifeArchiveClient({ state: 'no-archive' })
    renderPanel(client.client)
    await panelReady()

    await user.click(screen.getByRole('button', { name: 'Month' }))
    await panelReady()

    expect(client.calls.to('time.window').map((call) => call.request)).toEqual([
      {
        scale: 'day',
        containing: FIXTURE_TODAY,
        timeZoneId: 'UTC',
        weekRules: DEVICE.weekRules,
      },
      {
        scale: 'month',
        containing: FIXTURE_TODAY,
        timeZoneId: 'UTC',
        weekRules: DEVICE.weekRules,
      },
    ])
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('names the step controls for the scale in force', async () => {
    const user = userEvent.setup()
    const client = new TestLifeArchiveClient({ state: 'no-archive' })
    renderPanel(client.client)
    await panelReady()

    expect(screen.getByRole('button', { name: 'Previous day' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Year' }))
    await panelReady()
    expect(screen.getByRole('button', { name: 'Next year' })).toBeEnabled()
  })

  it('asks the core to traverse and follows the window it answers with', async () => {
    const user = userEvent.setup()
    const client = new TestLifeArchiveClient({ state: 'no-archive' })
    renderPanel(client.client)
    await panelReady()

    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    await panelReady()

    const [stepped] = client.calls.to('time.step')
    expect(stepped?.request).toMatchObject({
      step: 'previous',
      weekRules: DEVICE.weekRules,
    })
    /* The neighbour the core returned starts 2025-06-13, so that is the
       civil location the next request is asked about. */
    expect(client.calls.to('time.window').at(-1)?.request).toEqual({
      scale: 'day',
      containing: '2025-06-13',
      timeZoneId: 'UTC',
      weekRules: DEVICE.weekRules,
    })
  })

  it('moves to a date the core placed in the calendar', async () => {
    const user = userEvent.setup()
    const client = new TestLifeArchiveClient({ state: 'no-archive' })
    renderPanel(client.client)
    await panelReady()

    await user.click(
      within(weekCells()).getByRole('button', { name: '10 June 2025' }),
    )
    await panelReady()

    expect(client.calls.to('time.calendarContext').at(-1)?.request).toEqual({
      focusedDate: '2025-06-10',
      timeZoneId: 'UTC',
      weekRules: DEVICE.weekRules,
    })
  })

  it('re-reads the device s civil day when Today is chosen', async () => {
    const user = userEvent.setup()
    const client = new TestLifeArchiveClient({ state: 'no-archive' })
    renderPanel(client.client)
    await panelReady()

    await user.click(
      within(weekCells()).getByRole('button', { name: '10 June 2025' }),
    )
    await panelReady()
    await user.click(screen.getByRole('button', { name: 'Today' }))
    await panelReady()

    expect(client.calls.to('time.window').at(-1)?.request).toMatchObject({
      containing: FIXTURE_TODAY,
    })
  })
})

/* -------------------------------------------------------------------------- */
/* Stale answers                                                              */
/* -------------------------------------------------------------------------- */

describe('answers to questions the reader has moved on from', () => {
  it('discards a window that resolves after a newer one has landed', async () => {
    const user = userEvent.setup()
    let releaseFirst: (() => void) | null = null
    let call = 0
    const stub = timeStub({
      window: (request) => {
        call += 1
        if (call === 1) {
          return new Promise((resolve) => {
            releaseFirst = () => resolve(ok(coreWindow('day', '2001-01-01')))
          })
        }
        return Promise.resolve(ok(coreWindow('day', request.containing)))
      },
      calendarContext: async (request) =>
        ok(coreCalendarContext(request.focusedDate, WEEK_OF_FOURTEENTH)),
    })
    renderPanel(stub.client)

    /* The reader moves on before the first window has answered. */
    await user.click(screen.getByRole('button', { name: 'Week' }))
    await panelReady()
    expect(locationText()).toBe('14 Jun 2025')

    await act(async () => releaseFirst?.())
    expect(screen.queryByText('1 January 2001')).toBeNull()
    expect(locationText()).toBe('14 Jun 2025')
  })

  it('discards a step that resolves after the reader has stepped again', async () => {
    const user = userEvent.setup()
    let releaseFirst: (() => void) | null = null
    let steps = 0
    const stub = timeStub({
      window: async (request) => ok(coreWindow('day', request.containing)),
      calendarContext: async (request) =>
        ok(coreCalendarContext(request.focusedDate, WEEK_OF_FOURTEENTH)),
      step: () => {
        steps += 1
        if (steps === 1) {
          return new Promise((resolve) => {
            releaseFirst = () => resolve(ok(coreWindow('day', '2001-01-01')))
          })
        }
        return Promise.resolve(ok(coreWindow('day', '2025-06-13')))
      },
    })
    renderPanel(stub.client)
    await panelReady()

    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    /* A scale change supersedes the step that has not answered yet. */
    await user.click(screen.getByRole('button', { name: 'Week' }))
    await panelReady()

    await act(async () => releaseFirst?.())
    expect(screen.queryByText('1 January 2001')).toBeNull()
    expect(stub.window).not.toHaveBeenCalledWith(
      expect.objectContaining({ containing: '2001-01-01' }),
    )
  })
})

/* -------------------------------------------------------------------------- */
/* The expandable calendar                                                    */
/* -------------------------------------------------------------------------- */

describe('the expandable calendar', () => {
  it('carries its expanded state and reveals the month the core placed', async () => {
    const user = userEvent.setup()
    const stub = timeStub({
      calendarContext: async () =>
        ok(
          coreCalendarContext(FIXTURE_TODAY, WEEK_OF_FOURTEENTH, [
            ...WEEK_OF_FOURTEENTH,
            '2025-06-16',
          ]),
        ),
    })
    renderPanel(stub.client)
    await panelReady()

    const toggle = screen.getByRole('button', {
      name: 'Show the surrounding month',
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('group', { name: 'Month around the selected date' }),
    ).toBeNull()

    await user.click(toggle)
    const collapse = screen.getByRole('button', { name: 'Show one week only' })
    expect(collapse).toHaveAttribute('aria-expanded', 'true')
    const calendar = monthCells().closest('.record-calendar')
    expect(calendar).not.toBeNull()
    expect(collapse).toHaveAttribute(
      'aria-controls',
      calendar?.getAttribute('id'),
    )
    expect(within(monthCells()).getAllByRole('button')).toHaveLength(8)
  })

  it('collapses on Escape and gives the toggle its focus back', async () => {
    const user = userEvent.setup()
    const stub = timeStub({})
    renderPanel(stub.client)
    await panelReady()

    await user.click(
      screen.getByRole('button', { name: 'Show the surrounding month' }),
    )
    await user.click(
      within(monthCells()).getByRole('button', { name: '12 June 2025' }),
    )
    await panelReady()
    await user.keyboard('{Escape}')

    expect(
      screen.queryByRole('group', { name: 'Month around the selected date' }),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Show the surrounding month' }),
    ).toHaveFocus()
  })
})

describe('cursor restoration', () => {
  it('restores the last selected core-produced scale and anchor after remount', async () => {
    const user = userEvent.setup()
    const first = timeStub({})
    const mounted = renderPanel(first.client)
    await panelReady()

    await user.click(screen.getByRole('button', { name: '10 June 2025' }))
    await panelReady()
    await user.click(screen.getByRole('button', { name: 'Month' }))
    await panelReady()
    mounted.unmount()

    const restored = timeStub({})
    renderPanel(restored.client)
    await panelReady()
    expect(restored.window).toHaveBeenCalledWith({
      scale: 'month',
      containing: '2025-06-10',
      timeZoneId: 'UTC',
      weekRules: DEVICE.weekRules,
    })
  })
})

/* -------------------------------------------------------------------------- */
/* Keyboard                                                                   */
/* -------------------------------------------------------------------------- */

describe('keyboard movement through the cells', () => {
  it('moves along the returned collection without choosing anything', async () => {
    const user = userEvent.setup()
    const stub = timeStub({})
    renderPanel(stub.client)
    await panelReady()

    const cells = within(weekCells())
    /* One cell is in the tab order, and it is the date the core focused. */
    const focused = cells.getByRole('button', { name: '14 June 2025' })
    expect(focused).toHaveAttribute('tabindex', '0')
    expect(
      cells
        .getAllByRole('button')
        .filter((cell) => cell.getAttribute('tabindex') === '0'),
    ).toEqual([focused])

    focused.focus()
    await user.keyboard('{ArrowRight}')
    expect(cells.getByRole('button', { name: '15 June 2025' })).toHaveFocus()
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(cells.getByRole('button', { name: '13 June 2025' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(cells.getByRole('button', { name: '9 June 2025' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(cells.getByRole('button', { name: '15 June 2025' })).toHaveFocus()

    /* Moving the focus asked the core nothing: no date was chosen. */
    expect(stub.calendarContext).toHaveBeenCalledTimes(1)
  })

  it('moves a whole row at a time in the expanded month', async () => {
    const user = userEvent.setup()
    const month = [...WEEK_OF_FOURTEENTH, '2025-06-16', '2025-06-17']
    const stub = timeStub({
      calendarContext: async () =>
        ok(coreCalendarContext(FIXTURE_TODAY, WEEK_OF_FOURTEENTH, month)),
    })
    renderPanel(stub.client)
    await panelReady()
    await user.click(
      screen.getByRole('button', { name: 'Show the surrounding month' }),
    )

    const cells = within(monthCells())
    cells.getByRole('button', { name: '9 June 2025' }).focus()
    await user.keyboard('{ArrowDown}')
    expect(cells.getByRole('button', { name: '16 June 2025' })).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(cells.getByRole('button', { name: '9 June 2025' })).toHaveFocus()
    /* A row beyond the collection stops at its end rather than wrapping. */
    await user.keyboard('{ArrowUp}')
    expect(cells.getByRole('button', { name: '9 June 2025' })).toHaveFocus()
  })

  it('chooses the focused cell when it is activated', async () => {
    const user = userEvent.setup()
    const stub = timeStub({})
    renderPanel(stub.client)
    await panelReady()

    within(weekCells()).getByRole('button', { name: '11 June 2025' }).focus()
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect(stub.calendarContext).toHaveBeenLastCalledWith(
        expect.objectContaining({ focusedDate: '2025-06-11' }),
      ),
    )
  })
})

/* -------------------------------------------------------------------------- */
/* When the core cannot answer                                                */
/* -------------------------------------------------------------------------- */

describe('when time navigation is unavailable', () => {
  it('says so and shows no calendar it worked out for itself', async () => {
    const stub = timeStub({ window: async () => failed(UNAVAILABLE) })
    renderPanel(stub.client)

    expect(
      await screen.findByRole('heading', {
        name: 'Time navigation is unavailable',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('group', { name: 'Week of the selected date' }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('offers a retry only when the core says the request may be repeated', async () => {
    const user = userEvent.setup()
    let attempts = 0
    const stub = timeStub({
      window: async (request) => {
        attempts += 1
        return attempts === 1
          ? failed(BUSY)
          : ok(coreWindow('day', request.containing))
      },
    })
    renderPanel(stub.client)

    await user.click(await screen.findByRole('button', { name: 'Try again' }))
    await panelReady()

    expect(
      screen.queryByRole('heading', {
        name: 'Time navigation is unavailable',
      }),
    ).toBeNull()
    expect(within(weekCells()).getAllByRole('button')).toHaveLength(7)
  })

  it('reports a failing calendar the same way as a failing window', async () => {
    const stub = timeStub({ calendarContext: async () => failed(UNAVAILABLE) })
    renderPanel(stub.client)

    expect(
      await screen.findByRole('heading', {
        name: 'Time navigation is unavailable',
      }),
    ).toBeInTheDocument()
  })
})

/* -------------------------------------------------------------------------- */
/* In the composed application                                                */
/* -------------------------------------------------------------------------- */

describe('time navigation inside the workspace', () => {
  it('is the Record route s navigation region and no other route s', async () => {
    const record = renderAppAt('/record')
    expect(
      await screen.findByRole('navigation', { name: 'Time' }),
    ).toBeInTheDocument()
    record.unmount()

    renderAppAt('/timeline')
    await screen.findByRole('heading', { name: 'Timeline' })
    expect(screen.queryByRole('navigation', { name: 'Time' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Navigation' })).toBeNull()
  })

  it('returns as a drawer at narrow widths, reachable from the top bar', async () => {
    setClientMedia('(max-width: 820px)', '(max-width: 1120px)')
    const user = userEvent.setup()
    renderAppAt('/record')

    const toggle = await screen.findByRole('button', { name: 'Navigation' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('navigation', { name: 'Time' }),
    ).not.toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const drawer = screen.getByRole('dialog', { name: 'Navigation' })
    expect(
      within(drawer).getByRole('navigation', { name: 'Time' }),
    ).toBeInTheDocument()

    /* Escape closes the drawer once the calendar has nothing to collapse. */
    await user.keyboard('{Escape}')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
