import { useId, useRef, useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecordOverlay } from './RecordOverlay'

function rect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  }
}

function Harness() {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const first = useRef<HTMLButtonElement>(null)
  const dialogId = useId()
  const headingId = useId()
  return (
    <>
      <button ref={anchor} type="button" onClick={() => setOpen(true)}>
        Open picker
      </button>
      <RecordOverlay
        id={dialogId}
        open={open}
        kind="anchored"
        labelledBy={headingId}
        anchorRef={anchor}
        initialFocusRef={first}
        onClose={() => setOpen(false)}
        className="test-picker"
      >
        <h2 id={headingId}>Picker</h2>
        <button ref={first} type="button">
          First choice
        </button>
      </RecordOverlay>
    </>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RecordOverlay', () => {
  it('centres on its anchor, clamps to the viewport gutter, and reports available space', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function mockBounds(this: HTMLElement) {
        if (this.classList.contains('test-picker')) {
          return rect(0, 0, 350, 400)
        }
        if (this.textContent === 'Open picker') {
          return rect(980, 730, 40, 32)
        }
        return rect(0, 0, 0, 0)
      },
    )
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Open picker' }))
    const dialog = screen.getByRole('dialog', { name: 'Picker' })
    await waitFor(() => expect(dialog).toHaveAttribute('data-ready', 'true'))
    expect(dialog).toHaveStyle({
      '--record-overlay-left': '654px',
      '--record-overlay-top': '348px',
      '--record-overlay-max-width': '984px',
      '--record-overlay-max-height': '728px',
    })
  })

  it('keeps its established position when the anchor moves beneath it', async () => {
    let anchorLeft = 600
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function mockBounds(this: HTMLElement) {
        if (this.classList.contains('test-picker')) {
          return rect(0, 0, 350, 400)
        }
        if (this.textContent === 'Open picker') {
          return rect(anchorLeft, 500, 40, 32)
        }
        return rect(0, 0, 0, 0)
      },
    )
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Open picker' }))
    const dialog = screen.getByRole('dialog', { name: 'Picker' })
    await waitFor(() => expect(dialog).toHaveAttribute('data-ready', 'true'))
    expect(dialog).toHaveStyle({
      '--record-overlay-left': '445px',
      '--record-overlay-top': '316px',
    })

    anchorLeft = 200
    fireEvent.scroll(globalThis.window)
    await waitFor(() =>
      expect(dialog).toHaveStyle({
        '--record-overlay-left': '445px',
        '--record-overlay-top': '316px',
      }),
    )
  })

  it('closes from Escape and the backdrop and restores its opener', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open picker' })

    await user.click(opener)
    expect(screen.getByRole('button', { name: 'First choice' })).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(opener).toHaveFocus())

    await user.click(opener)
    const backdrop = screen.getByRole('dialog').parentElement
    expect(backdrop).not.toBeNull()
    await user.click(backdrop!)
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(opener).toHaveFocus())
  })
})
