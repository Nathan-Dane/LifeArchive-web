import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../i18n'
import { RecordDatePicker } from './RecordDatePicker'

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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RecordDatePicker', () => {
  it('uses the shared shell, its parent width, and a localised calendar', async () => {
    const user = userEvent.setup()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function mockBounds(this: HTMLElement) {
        if (this.classList.contains('date-reference')) {
          return rect(50, 100, 420, 36)
        }
        if (this.classList.contains('record-date-picker__trigger')) {
          return rect(72, 120, 248, 36)
        }
        if (this.classList.contains('record-date-menu')) {
          return rect(0, 0, 420, 300)
        }
        return rect(0, 0, 0, 0)
      },
    )
    const onChange = vi.fn()

    function Harness() {
      const reference = useRef<HTMLDivElement>(null)
      return (
        <div ref={reference} className="date-reference">
          <RecordDatePicker
            label="Date"
            value="2025-06-14"
            widthRef={reference}
            onChange={onChange}
          />
        </div>
      )
    }

    render(
      <I18nProvider locale="en">
        <Harness />
      </I18nProvider>,
    )
    const trigger = screen.getByRole('button', { name: /Date:.*Choose date/ })
    await user.click(trigger)

    const dialog = screen.getByRole('dialog', {
      name: /Date:.*Choose date/,
    })
    await waitFor(() => expect(dialog).toHaveAttribute('data-ready', 'true'))
    expect(dialog).not.toHaveAttribute('aria-modal')
    expect(dialog).toHaveStyle({
      '--record-overlay-left': '72px',
      '--record-overlay-top': '166px',
      '--record-overlay-anchor-width': '420px',
    })
    expect(within(dialog).getAllByRole('gridcell')).toHaveLength(42)
    expect(
      within(dialog).getByRole('button', { name: 'Previous month' }),
    ).toBeVisible()
    expect(
      within(dialog).getByRole('button', { name: 'Next month' }),
    ).toBeVisible()

    const nextDay = [
      ...dialog.querySelectorAll<HTMLButtonElement>('.record-date-picker__day'),
    ].find(
      (day) =>
        day.textContent === '15' &&
        day.getAttribute('data-outside-month') === null,
    )
    expect(nextDay).toBeDefined()
    await user.click(nextDay!)
    expect(onChange).toHaveBeenCalledWith('2025-06-15')
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(trigger).toHaveFocus()
  })
})
