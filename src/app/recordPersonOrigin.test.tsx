import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  type InitialEntry,
} from 'react-router-dom'
import { stableId } from '../core/client'
import { I18nProvider } from '../i18n'
import { useRecordPersonOriginCoordinator } from './recordPersonOrigin'
import {
  RecordPersonOriginContext,
  useRecordPersonOrigin,
} from '../ui/navigation/recordPersonOrigin'

const PERSON_ID = stableId('c4000000-0000-4000-8000-000000000001')
const OBJECT_ID = stableId('c4000000-0000-4000-8000-000000000002')
const RECORD_LOCATION = `/record?scale=day&date=2025-06-14&object=${OBJECT_ID}`

function LocationProbe() {
  const location = useLocation()
  return <output>{`${location.pathname}${location.search}`}</output>
}

function RecordView() {
  const origin = useRecordPersonOrigin()
  return (
    <main id="main-content">
      <button
        type="button"
        data-record-person-id={PERSON_ID}
        data-record-person-opener-key="maya-secondary"
        onClick={(event) =>
          origin.openPerson(PERSON_ID, 'view', event.currentTarget)
        }
      >
        Open Maya elsewhere
      </button>
      <button
        type="button"
        data-record-person-id={PERSON_ID}
        data-record-person-opener-key="maya-primary"
        onClick={(event) =>
          origin.openPerson(PERSON_ID, 'view', event.currentTarget)
        }
      >
        Open Maya
      </button>
      <button
        type="button"
        data-record-person-id={PERSON_ID}
        data-record-person-opener-key="maya-edit"
        onClick={(event) =>
          origin.openPerson(PERSON_ID, 'edit', event.currentTarget)
        }
      >
        Edit Maya
      </button>
    </main>
  )
}

function PersonView({ editing = false }: { readonly editing?: boolean }) {
  const origin = useRecordPersonOrigin()
  const navigate = useNavigate()
  const returnToRecord = () => {
    if (!origin.returnToRecord()) navigate('/index/people')
  }
  return (
    <main id="main-content">
      {origin.expiredOrigin ? (
        <p role="status">
          The Record return point expired. This Person remains open.
        </p>
      ) : null}
      <h1>{editing ? 'Edit Maya' : 'Maya'}</h1>
      <button type="button" onClick={returnToRecord}>
        Back
      </button>
      {!editing ? (
        <button
          type="button"
          onClick={() =>
            navigate(`/index/people/${PERSON_ID}/edit`, {
              state: origin.stateForPersonRoute(),
            })
          }
        >
          Edit profile
        </button>
      ) : null}
      <button type="button" onClick={() => navigate(-1)}>
        Browser back
      </button>
    </main>
  )
}

function Harness() {
  const origin = useRecordPersonOriginCoordinator()
  return (
    <RecordPersonOriginContext.Provider value={origin}>
      <LocationProbe />
      <Routes>
        <Route path="/record" element={<RecordView />} />
        <Route path="/index/people/:personId" element={<PersonView />} />
        <Route
          path="/index/people/:personId/edit"
          element={<PersonView editing />}
        />
        <Route path="/index/people" element={<h1>People</h1>} />
      </Routes>
    </RecordPersonOriginContext.Provider>
  )
}

function view(initialEntry: InitialEntry = RECORD_LOCATION) {
  return render(
    <I18nProvider locale="en">
      <MemoryRouter initialEntries={[initialEntry]}>
        <Harness />
      </MemoryRouter>
    </I18nProvider>,
  )
}

describe('Record Person route origin', () => {
  it('returns View to the exact Record URL, scroll, and Person opener', async () => {
    const user = userEvent.setup()
    view()
    const main = document.getElementById('main-content')!
    main.scrollTop = 127
    main.scrollLeft = 9

    await user.click(screen.getByRole('button', { name: 'Open Maya' }))
    expect(screen.getByRole('heading', { name: 'Maya' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(
      screen.getByText(RECORD_LOCATION, { selector: 'output' }),
    ).toBeInTheDocument()
    const opener = screen.getByRole('button', { name: 'Open Maya' })
    await waitFor(() => expect(opener).toHaveFocus())
    expect(
      screen.getByRole('button', { name: 'Open Maya elsewhere' }),
    ).not.toHaveFocus()
    expect(document.getElementById('main-content')).toHaveProperty(
      'scrollTop',
      127,
    )
    expect(document.getElementById('main-content')).toHaveProperty(
      'scrollLeft',
      9,
    )
  })

  it('returns a direct Edit route and browser Back without losing the origin', async () => {
    const user = userEvent.setup()
    view()
    await user.click(screen.getByRole('button', { name: 'Edit Maya' }))
    expect(
      screen.getByText(`/index/people/${PERSON_ID}/edit`, {
        selector: 'output',
      }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Browser back' }))
    expect(
      screen.getByText(RECORD_LOCATION, { selector: 'output' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit Maya' })).toHaveFocus(),
    )
  })

  it('counts Person route pushes so in-product Back skips to Record', async () => {
    const user = userEvent.setup()
    view()
    await user.click(screen.getByRole('button', { name: 'Open Maya' }))
    await user.click(screen.getByRole('button', { name: 'Edit profile' }))
    expect(
      screen.getByRole('heading', { name: 'Edit Maya' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(
      screen.getByText(RECORD_LOCATION, { selector: 'output' }),
    ).toBeInTheDocument()
  })

  it('falls back safely when origin router state is stale', async () => {
    const user = userEvent.setup()
    view({
      pathname: `/index/people/${PERSON_ID}`,
      state: {
        lifeArchiveRecordPersonOrigin: {
          version: 1,
          token: 'record-person-expired',
          depth: 1,
        },
      },
    })
    expect(
      screen.getByText(
        'The Record return point expired. This Person remains open.',
      ),
    ).toHaveAttribute('role', 'status')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument()
  })

  it('falls back safely when origin router state is malformed', async () => {
    const user = userEvent.setup()
    view({
      pathname: `/index/people/${PERSON_ID}`,
      state: {
        lifeArchiveRecordPersonOrigin: {
          version: 1,
          token: 42,
          depth: 'all',
        },
      },
    })
    expect(
      screen.queryByText(
        'The Record return point expired. This Person remains open.',
      ),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument()
  })
})
