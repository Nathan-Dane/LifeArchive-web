/**
 * Record object selection.
 *
 * The property under test throughout is that **an object is its stable ID**.
 * So the assertions are about identity rather than appearance: two Events with
 * the same title on the same date stay two objects, two overlapping Spans stay
 * independently selectable, a link names one exact object and arrives at it
 * wherever in time it lives, and a window that does not hold the selection
 * says so instead of quietly editing something else.
 *
 * The second property is that the core decides what is here and in what order.
 * Nothing below expects this repository to have sorted, grouped by time,
 * counted across windows, or worked out which day contains what — each test
 * states what the core answered and then asks what was shown.
 */

import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import {
  civilDate,
  clientFailure,
  failed,
  ok,
  revision,
  stableId,
  type ClientResult,
  type LifeArchiveClient,
  type StableId,
  type InvalidationToken,
  type OpenArchive,
  type StructuredListPage,
  type StructuredObject,
  type StructuredObjectState,
  type StructuredSummary,
} from '../../../core/client'
import { I18nProvider } from '../../../i18n'
import { setClientMedia } from '../../../test/clientMedia'
import { renderAppAt } from '../../../test/render'
import { TestLifeArchiveClient } from '../../../test/TestLifeArchiveClient'
import { coreWindow } from '../../../test/timeFixtures'
import { RecordObjectDetails } from './RecordObjectDetails'
import {
  OBJECT_PAGE_LIMIT,
  placementDate,
  type RecordObjects,
} from './recordObjects'

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

function id(last: string): StableId {
  return stableId(`7f1c0a10-0000-4000-8000-0000000001${last}`)
}

const MORNING_SWIM = id('01')
const EVENING_SWIM = id('02')
const AARHUS = id('03')
const STUDIO = id('04')

const INVALIDATION: InvalidationToken = {
  storeInstanceId: 'record-objects-test',
  revision: revision('7'),
}

const ARCHIVE: OpenArchive = {
  storeId: id('00'),
  productContract: 'test',
  storeSchemaVersion: 'test',
  rootLayoutVersion: 'test',
  invalidation: INVALIDATION,
}

const BUSY = clientFailure({
  area: 'concurrency',
  code: 'busyRetryable',
  phase: 'snapshot',
  retryable: true,
})

/** Two Events that differ in nothing a reader can see but their identity. */
function sameDayEvents(): readonly StructuredSummary[] {
  const shared = {
    revision: revision('1'),
    placement: { kind: 'event', date: civilDate('2025-06-14') },
    iconId: 'icon.activity',
    tags: { ordered: [], display: null },
    trackId: null,
  } as const
  return [
    { ...shared, id: MORNING_SWIM, title: 'Swim' },
    { ...shared, id: EVENING_SWIM, title: 'Swim' },
  ]
}

/** Two Spans covering one date, one of them still ongoing. */
function overlappingSpans(): readonly StructuredSummary[] {
  const marker = { enabled: false, titleOverride: null } as const
  return [
    {
      id: AARHUS,
      revision: revision('2'),
      title: 'Living in Aarhus',
      placement: {
        kind: 'span',
        startDate: civilDate('2024-08-01'),
        endDate: null,
        beginMarker: marker,
        endMarker: marker,
      },
      iconId: 'icon.home',
      tags: { ordered: [], display: null },
      trackId: null,
    },
    {
      id: STUDIO,
      revision: revision('3'),
      title: 'The studio year',
      placement: {
        kind: 'span',
        startDate: civilDate('2025-01-01'),
        endDate: civilDate('2025-12-31'),
        beginMarker: marker,
        endMarker: marker,
      },
      iconId: 'icon.tools',
      tags: { ordered: ['home', 'creative'], display: 'creative' },
      trackId: null,
    },
  ]
}

function page(objects: readonly StructuredSummary[]): StructuredListPage {
  return { objects, invalidation: INVALIDATION }
}

/** One complete object, as `structured.load` answers for an exact ID. */
function loaded(summary: StructuredSummary): StructuredObject {
  return {
    summary,
    markdown: 'The flat by the botanical garden.',
    createdAtMs: 1_722_470_400_000,
    updatedAtMs: 1_749_896_400_000,
    privacy: 'normal',
    media: [],
    hasMoreMedia: false,
  }
}

/* -------------------------------------------------------------------------- */
/* Standing in for the core                                                   */
/* -------------------------------------------------------------------------- */

function openArchive(): TestLifeArchiveClient {
  return new TestLifeArchiveClient({ state: 'open', archive: ARCHIVE })
}

/**
 * The complete mock, with the two operations these tests stand in for.
 *
 * `time.window` answers each request with a distinct window for the exact
 * position asked about, which is what the core does and what makes "was this
 * position asked about again?" a real question rather than an accident of two
 * positions sharing one fixture. `record.listObjects` hands out the pages the
 * test states, in order, the last one repeating — so a test says how the
 * archive answers rather than how many times it is asked.
 */
function recordClient(
  client: TestLifeArchiveClient,
  ...pages: readonly (() => Promise<ClientResult<StructuredListPage>>)[]
): LifeArchiveClient {
  const base = client.client
  let call = 0
  return {
    ...base,
    time: {
      ...base.time,
      window: (request) => {
        client.calls.record('time.window', request)
        return Promise.resolve(
          ok(coreWindow(request.scale, request.containing)),
        )
      },
    },
    record: {
      ...base.record,
      listObjects: (request) => {
        const answer = pages[call] ?? pages[pages.length - 1]
        call += 1
        client.calls.record('record.listObjects', request)
        return answer!()
      },
    },
  }
}

/** One settled page, for the tests that do not care how often it is read. */
function listing(
  ...pages: readonly ClientResult<StructuredListPage>[]
): readonly (() => Promise<ClientResult<StructuredListPage>>)[] {
  return pages.map((answer) => async () => answer)
}

/* -------------------------------------------------------------------------- */
/* Rendering the composed application                                         */
/* -------------------------------------------------------------------------- */

/** The location, so a feature that writes to the URL is read from the URL. */
let location = ''

function LocationProbe() {
  const search = useLocation().search
  useEffect(() => {
    location = search
  }, [search])
  return null
}

function renderRecord(client: LifeArchiveClient, path = '/record') {
  location = ''
  return renderAppAt(
    path,
    async () => ({ state: 'client', client, developmentMock: true }),
    { locale: 'en-GB', within: <LocationProbe /> },
  )
}

async function railReady(): Promise<HTMLElement> {
  const rail = await screen.findByRole('group', { name: 'Object' })
  await waitFor(() => expect(rail).not.toHaveAttribute('aria-busy'))
  return rail
}

/** Every control in the object row, in the order it is drawn. */
function railControls(rail: HTMLElement): readonly string[] {
  return within(rail)
    .getAllByRole('button')
    .map(
      (control) =>
        control.getAttribute('aria-label') ?? control.textContent ?? '',
    )
}

function tabFor(objectId: StableId): HTMLElement {
  const tab = document.querySelector(`[data-object-id="${objectId}"]`)
  if (!(tab instanceof HTMLElement))
    throw new Error(`No control for ${objectId}`)
  return tab
}

function noTabFor(objectId: StableId): boolean {
  return document.querySelector(`[data-object-id="${objectId}"]`) === null
}

/* -------------------------------------------------------------------------- */
/* The Day rail                                                               */
/* -------------------------------------------------------------------------- */

describe('the objects a day holds', () => {
  it('fixes the ordinary entry first and keeps the core s order after it', async () => {
    const client = openArchive()
    renderRecord(
      recordClient(
        client,
        ...listing(ok(page([...overlappingSpans(), ...sameDayEvents()]))),
      ),
    )
    const rail = await railReady()
    const navigation = screen.getByRole('complementary', {
      name: 'Navigation',
    })

    /* Kinds are grouped; the core order within each kind stays exact. */
    expect(within(navigation).getByRole('group', { name: 'Object' })).toBe(rail)
    expect(railControls(rail)).toEqual([
      'Day entry',
      'Event: Swim, 14 June 2025',
      'Event: Swim, 14 June 2025',
      'Span: Living in Aarhus, 1 August 2024 to Present',
      'Span: The studio year, 1 January 2025 to 31 December 2025',
      'New Event',
      'New Span',
    ])
  })

  it('asks for the objects of a window once, not once per object', async () => {
    const client = openArchive()
    renderRecord(recordClient(client, ...listing(ok(page(sameDayEvents())))))
    await railReady()

    expect(client.calls.countOf('record.listObjects')).toBe(1)
    /* Nothing was loaded object by object to fill the row in. */
    expect(client.calls.countOf('structured.load')).toBe(0)
    const asked = client.calls.to('record.listObjects').at(0)?.request
    expect(asked).toMatchObject({
      window: { scale: 'day' },
      limit: OBJECT_PAGE_LIMIT,
    })
  })

  it('selects the exact one of two Events that share a date and a title', async () => {
    const user = userEvent.setup()
    const client = openArchive()
    renderRecord(recordClient(client, ...listing(ok(page(sameDayEvents())))))
    await railReady()

    await user.click(tabFor(EVENING_SWIM))

    expect(tabFor(EVENING_SWIM)).toHaveAttribute('aria-pressed', 'true')
    expect(tabFor(MORNING_SWIM)).toHaveAttribute('aria-pressed', 'false')
    /* The identity, not the title, is what the location carries. */
    await waitFor(() => expect(location).toBe(`?object=${EVENING_SWIM}`))
  })

  it('keeps overlapping Spans separate and presents an absent end as Present', async () => {
    const user = userEvent.setup()
    const client = openArchive()
    renderRecord(recordClient(client, ...listing(ok(page(overlappingSpans())))))
    await railReady()

    await user.click(tabFor(AARHUS))
    expect(tabFor(AARHUS)).toHaveAttribute('aria-pressed', 'true')
    expect(tabFor(STUDIO)).toHaveAttribute('aria-pressed', 'false')

    /* No derived end date stands in for an ongoing Span, anywhere. */
    const details = screen.getByRole('complementary', { name: 'Details' })
    await waitFor(() =>
      expect(within(details).getByText('Present')).toBeInTheDocument(),
    )

    await user.click(tabFor(STUDIO))
    expect(tabFor(STUDIO)).toHaveAttribute('aria-pressed', 'true')
    expect(tabFor(AARHUS)).toHaveAttribute('aria-pressed', 'false')
  })

  it('offers explicit Event creation and cancellation', async () => {
    const user = userEvent.setup()
    const client = openArchive()
    renderRecord(recordClient(client, ...listing(ok(page([])))))
    await railReady()

    await user.click(screen.getByRole('button', { name: 'New Event' }))
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(screen.getAllByText('No Items')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull()
  })

  it('lists nothing it could not read, and offers the retry the core allows', async () => {
    const user = userEvent.setup()
    const client = openArchive()
    renderRecord(
      recordClient(
        client,
        ...listing(failed(BUSY), ok(page(overlappingSpans()))),
      ),
    )
    await railReady()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(noTabFor(AARHUS)).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(tabFor(AARHUS)).toBeInTheDocument())
  })
})

/* -------------------------------------------------------------------------- */
/* The exact ID in the location                                               */
/* -------------------------------------------------------------------------- */

describe('the exact object in the location', () => {
  it('carries the stable ID and nothing else, and takes it out again', async () => {
    const user = userEvent.setup()
    const client = openArchive()
    renderRecord(recordClient(client, ...listing(ok(page(sameDayEvents())))))
    await railReady()

    await user.click(tabFor(MORNING_SWIM))
    await waitFor(() => expect(location).toBe(`?object=${MORNING_SWIM}`))
    /* No revision and no writing: neither is durable, shareable, or ours. */
    expect(location).not.toMatch(/revision|markdown/i)

    await user.click(screen.getByRole('button', { name: 'Day entry' }))
    await waitFor(() => expect(location).toBe(''))
  })

  it('opens the exact object a location names, wherever in time it lives', async () => {
    const client = openArchive()
    const aarhus = overlappingSpans()[0]!
    client.script(
      'structured.load',
      ok<StructuredObjectState>({
        presence: 'present',
        object: loaded(aarhus),
        invalidation: INVALIDATION,
      }),
    )
    renderRecord(
      recordClient(client, ...listing(ok(page(overlappingSpans())))),
      `/record?object=${AARHUS}`,
    )
    await railReady()

    /* Asked for by ID, then followed to the civil date the core placed it at. */
    expect(client.calls.to('structured.load').at(0)?.request).toEqual({
      id: AARHUS,
      includeDeleted: true,
    })
    await waitFor(() =>
      expect(client.calls.to('time.window').at(-1)?.request).toMatchObject({
        scale: 'day',
        containing: placementDate(aarhus.placement),
      }),
    )
    await waitFor(() =>
      expect(tabFor(AARHUS)).toHaveAttribute('aria-pressed', 'true'),
    )
  })

  it('says so when a location names an object the archive does not hold', async () => {
    const client = openArchive()
    const missing = id('99')
    client.script(
      'structured.load',
      ok<StructuredObjectState>({ presence: 'absent', id: missing }),
    )
    renderRecord(
      recordClient(client, ...listing(ok(page(sameDayEvents())))),
      `/record?object=${missing}`,
    )
    await railReady()

    expect(
      await screen.findByText('That object is not in this archive.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Day entry' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await waitFor(() => expect(location).toBe(''))
  })

  it('ignores location text that is not an identifier', async () => {
    const client = openArchive()
    renderRecord(
      recordClient(client, ...listing(ok(page(sameDayEvents())))),
      '/record?object=not-an-identifier',
    )
    await railReady()

    expect(client.calls.countOf('structured.load')).toBe(0)
    expect(screen.getByRole('button', { name: 'Day entry' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

/* -------------------------------------------------------------------------- */
/* Scales wider than a day                                                    */
/* -------------------------------------------------------------------------- */

describe('scales wider than a day', () => {
  it('keeps the categorized bounded list visible', async () => {
    const user = userEvent.setup()
    const client = openArchive()
    renderRecord(
      recordClient(
        client,
        ...listing(
          ok(page(sameDayEvents())),
          ok(page([...sameDayEvents(), ...overlappingSpans()])),
        ),
      ),
    )
    await railReady()

    await user.click(screen.getByRole('button', { name: 'Week' }))
    await waitFor(() => expect(tabFor(AARHUS)).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Entry' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Events' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Spans' })).toBeInTheDocument()
    expect(
      within(screen.getByRole('complementary', { name: 'Details' })).getByText(
        'Week entry',
      ),
    ).toBeInTheDocument()
  })

  it('hands off to the object s own day and selects it there', async () => {
    const user = userEvent.setup()
    const client = openArchive()
    renderRecord(
      recordClient(
        client,
        ...listing(ok(page([])), ok(page(overlappingSpans()))),
      ),
    )
    await railReady()

    await user.click(screen.getByRole('button', { name: 'Month' }))
    await waitFor(() => expect(tabFor(STUDIO)).toBeInTheDocument())
    await user.click(tabFor(STUDIO))

    /* One move: the scale and the civil location change together. */
    await waitFor(() =>
      expect(client.calls.to('time.window').at(-1)?.request).toMatchObject({
        scale: 'day',
        containing: '2025-01-01',
      }),
    )
    await waitFor(() =>
      expect(tabFor(STUDIO)).toHaveAttribute('aria-pressed', 'true'),
    )
  })
})

/* -------------------------------------------------------------------------- */
/* Answers to questions the reader has moved on from                          */
/* -------------------------------------------------------------------------- */

describe('stale answers and selections a window does not hold', () => {
  it('discards a list that answers for a window the reader has left', async () => {
    const user = userEvent.setup()
    const client = openArchive()
    let release: (() => void) | null = null
    const stranded = new Promise<ClientResult<StructuredListPage>>(
      (resolve) => {
        release = () => resolve(ok(page(sameDayEvents())))
      },
    )
    renderRecord(
      recordClient(
        client,
        () => stranded,
        async () => ok(page(overlappingSpans())),
      ),
    )

    await user.click(
      await screen.findByRole('button', { name: 'Previous day' }),
    )
    await railReady()
    await waitFor(() => expect(tabFor(AARHUS)).toBeInTheDocument())

    await act(async () => release?.())
    /* The superseded window's Events never reach the row. */
    expect(noTabFor(MORNING_SWIM)).toBe(true)
    expect(tabFor(AARHUS)).toBeInTheDocument()
  })

  it('falls back to the ordinary entry and offers to follow the object', async () => {
    const user = userEvent.setup()
    const client = openArchive()
    renderRecord(
      recordClient(
        client,
        ...listing(
          ok(page(overlappingSpans())),
          ok(page([])),
          ok(page(overlappingSpans())),
        ),
      ),
    )
    await railReady()

    await user.click(tabFor(AARHUS))
    await user.click(screen.getByRole('button', { name: 'Previous day' }))

    expect(
      await screen.findByText(
        'Living in Aarhus is not in the period being shown, so the ordinary entry is selected.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Day entry' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await waitFor(() => expect(location).toBe(''))

    await user.click(
      screen.getByRole('button', { name: 'Go to Living in Aarhus' }),
    )
    await waitFor(() =>
      expect(client.calls.to('time.window').at(-1)?.request).toMatchObject({
        scale: 'day',
        containing: '2024-08-01',
      }),
    )
    await waitFor(() =>
      expect(tabFor(AARHUS)).toHaveAttribute('aria-pressed', 'true'),
    )
  })
})

/* -------------------------------------------------------------------------- */
/* The composed workspace                                                     */
/* -------------------------------------------------------------------------- */

describe('object selection across the workspace', () => {
  it('uses only the core display tag as the compact object accent', async () => {
    const client = openArchive()
    renderRecord(recordClient(client, ...listing(ok(page(overlappingSpans())))))
    await railReady()

    const compact = tabFor(STUDIO)
    expect(compact).toHaveAttribute('data-display-tag-id', 'creative')
    expect(compact).toHaveClass('record-display-accent--creative')
    expect(compact.querySelectorAll('[data-semantic-tag-id]')).toHaveLength(0)
    expect({
      displayTag: compact.dataset.displayTagId,
      accentClasses: [...compact.classList].filter((name) =>
        name.startsWith('record-display-accent--'),
      ),
      renderedTagBadges: compact.querySelectorAll('[data-semantic-tag-id]')
        .length,
    }).toMatchInlineSnapshot(`
      {
        "accentClasses": [
          "record-display-accent--creative",
        ],
        "displayTag": "creative",
        "renderedTagBadges": 0,
      }
    `)
  })

  it('keeps the exact object selected when the regions become drawers', async () => {
    const user = userEvent.setup()
    const client = openArchive()
    renderRecord(recordClient(client, ...listing(ok(page(overlappingSpans())))))
    await railReady()

    await user.click(tabFor(STUDIO))
    expect(tabFor(STUDIO)).toHaveAttribute('aria-pressed', 'true')

    act(() => setClientMedia('(max-width: 820px)', '(max-width: 1120px)'))

    /* Moving the menu into a drawer does not replace its selection state. */
    expect(tabFor(STUDIO)).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Details' }))
    const details = screen.getByRole('dialog', { name: 'Details' })
    await waitFor(() =>
      expect(
        within(details).getByDisplayValue('The studio year'),
      ).toBeInTheDocument(),
    )
    /* Changing width is not a new question for the archive. */
    expect(client.calls.countOf('record.listObjects')).toBe(1)
  })

  it('opens navigation and details one at a time', async () => {
    setClientMedia('(max-width: 820px)', '(max-width: 1120px)')
    const user = userEvent.setup()
    const client = openArchive()
    renderRecord(recordClient(client, ...listing(ok(page(overlappingSpans())))))
    await screen.findByRole('heading', { name: 'Record' })

    const navigation = await screen.findByRole('button', {
      name: 'Navigation',
    })
    const details = await screen.findByRole('button', { name: 'Details' })

    await user.click(navigation)
    await railReady()
    expect(navigation).toHaveAttribute('aria-expanded', 'true')
    expect(details).toHaveAttribute('aria-expanded', 'false')

    await user.click(details)
    expect(navigation).toHaveAttribute('aria-expanded', 'false')
    expect(details).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* The details of what is selected                                            */
/* -------------------------------------------------------------------------- */

describe('the details region', () => {
  function stubObjects(selected: StructuredSummary | null): RecordObjects {
    return {
      state: {
        status: 'ready',
        failure: null,
        objects: [],
        bounded: false,
        selected,
        notice: null,
      },
      selectOrdinary: () => undefined,
      selectObject: () => undefined,
      goToObject: () => undefined,
      selectCreated: () => undefined,
      replaceObject: () => undefined,
      removeObject: () => undefined,
      dismissNotice: () => undefined,
      retry: () => undefined,
    }
  }

  it('names the ordinary entry by the period the core returned', () => {
    render(
      <I18nProvider locale="en-GB">
        <RecordObjectDetails
          scale="week"
          window={coreWindow('week', '2025-06-09', '2025-06-15')}
          objects={stubObjects(null)}
        />
      </I18nProvider>,
    )

    expect(screen.getByText('Week entry')).toBeVisible()
    expect(screen.getByText(/9.*15 June 2025/)).toBeInTheDocument()
  })

  it('shows an object s own dates and its exact identifier', () => {
    const studio = overlappingSpans()[1]!
    render(
      <I18nProvider locale="en-GB">
        <RecordObjectDetails
          scale="day"
          window={coreWindow('day', '2025-06-14')}
          objects={stubObjects(studio)}
        />
      </I18nProvider>,
    )

    expect(screen.getByText('The studio year')).toBeVisible()
    expect(screen.getByText(/1 January.*31 December 2025/)).toBeInTheDocument()
    /* The exact identifier, as the archive spells it. */
    expect(screen.getByText(STUDIO)).toBeInTheDocument()
  })
})
