import { useRef, useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LiveStatus } from './LiveStatus'
import { useFocusTrap } from './focus'

function TrappedSurface() {
  const [open, setOpen] = useState(false)
  const surface = useRef<HTMLDivElement>(null)
  useFocusTrap(surface, { active: open, onEscape: () => setOpen(false) })

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <div ref={surface} role="dialog" tabIndex={-1} hidden={!open}>
        <button type="button">First</button>
        <button type="button" onClick={() => setOpen(false)}>
          Last
        </button>
      </div>
    </>
  )
}

function TrappedSurfaceWithReplaceableOpener() {
  const [open, setOpen] = useState(false)
  const [openerGeneration, setOpenerGeneration] = useState(0)
  const surface = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  useFocusTrap(surface, {
    active: open,
    onEscape: () => setOpen(false),
    returnFocusRef: opener,
  })

  return (
    <>
      <button
        key={openerGeneration}
        ref={opener}
        type="button"
        onClick={() => setOpen(true)}
      >
        Open replaceable
      </button>
      <div ref={surface} role="dialog" tabIndex={-1} hidden={!open}>
        <button
          type="button"
          onClick={() => setOpenerGeneration((current) => current + 1)}
        >
          Replace opener
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    </>
  )
}

describe('the focus trap', () => {
  it('enters, wraps, closes with Escape, and restores its opener', async () => {
    const user = userEvent.setup()
    render(<TrappedSurface />)
    const opener = screen.getByRole('button', { name: 'Open' })

    await user.click(opener)
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()

    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('restores an explicit opener that React replaced while active', async () => {
    const user = userEvent.setup()
    render(<TrappedSurfaceWithReplaceableOpener />)

    await user.click(screen.getByRole('button', { name: 'Open replaceable' }))
    await user.click(screen.getByRole('button', { name: 'Replace opener' }))
    const replacement = screen.getByRole('button', {
      name: 'Open replaceable',
    })
    await user.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(replacement).toHaveFocus())
  })
})

describe('quiet announcements', () => {
  it('uses polite, atomic status semantics', () => {
    render(<LiveStatus>Archive ready</LiveStatus>)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveAttribute('aria-atomic', 'true')
    expect(status).toHaveClass('visually-hidden')
  })
})
