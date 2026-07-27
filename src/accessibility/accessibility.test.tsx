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
