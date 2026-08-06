import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { I18nProvider } from '../../i18n'
import { ConnectionLabelsEditor } from './ConnectionLabelsEditor'

function Harness() {
  const [labels, setLabels] = useState<readonly string[]>(['Choir', 'Cycling'])
  return (
    <I18nProvider locale="en">
      <ConnectionLabelsEditor labels={labels} onChange={setLabels} />
      <output aria-label="connection-order">{labels.join('|')}</output>
    </I18nProvider>
  )
}

describe('ConnectionLabelsEditor', () => {
  it('keeps custom selection rows stable when their primary order changes', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /Choir/ }))
    const task = await screen.findByRole('dialog', {
      name: 'How you know them',
    })
    const customRows = () =>
      within(task)
        .getAllByRole('checkbox')
        .filter((checkbox) =>
          ['Choir', 'Cycling'].includes(checkbox.textContent ?? ''),
        )

    expect(customRows().map((row) => row.textContent)).toEqual([
      'Choir',
      'Cycling',
    ])
    const cyclingRow = customRows()[1]!.closest('.person-connections__option')!
    await user.click(
      within(cyclingRow as HTMLElement).getByRole('button', {
        name: 'Make primary',
      }),
    )

    expect(screen.getByLabelText('connection-order')).toHaveTextContent(
      'Cycling|Choir',
    )
    expect(customRows().map((row) => row.textContent)).toEqual([
      'Choir',
      'Cycling',
    ])
  })
})
