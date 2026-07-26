import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RouteErrorBoundary } from './RouteErrorBoundary'

function BrokenView({ broken }: { readonly broken: boolean }) {
  if (broken) throw new Error('route fixture failed')
  return <h1>Recovered view</h1>
}

function ResetFixture() {
  const [broken, setBroken] = useState(true)
  return (
    <>
      <button type="button" onClick={() => setBroken(false)}>
        Repair fixture
      </button>
      <RouteErrorBoundary>
        <BrokenView broken={broken} />
      </RouteErrorBoundary>
    </>
  )
}

describe('route error boundary', () => {
  beforeEach(() =>
    vi.spyOn(console, 'error').mockImplementation(() => undefined),
  )
  afterEach(() => vi.restoreAllMocks())

  it('states that the archive was not erased and resets the same view', async () => {
    const user = userEvent.setup()
    render(<ResetFixture />)

    expect(
      screen.getByRole('heading', { name: 'This view could not be shown' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      /was not erased or replaced/i,
    )

    await user.click(screen.getByRole('button', { name: 'Repair fixture' }))
    await user.click(
      screen.getByRole('button', { name: 'Try this view again' }),
    )
    expect(
      screen.getByRole('heading', { name: 'Recovered view' }),
    ).toBeInTheDocument()
  })

  it('offers an injected non-destructive reload action', async () => {
    const reload = vi.fn()
    const user = userEvent.setup()
    render(
      <RouteErrorBoundary reload={reload}>
        <BrokenView broken />
      </RouteErrorBoundary>,
    )
    await user.click(screen.getByRole('button', { name: 'Reload application' }))
    expect(reload).toHaveBeenCalledOnce()
  })
})
