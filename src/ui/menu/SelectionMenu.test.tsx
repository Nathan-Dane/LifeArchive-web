import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { SelectionMenu } from './SelectionMenu'

const OPTIONS = [
  { value: 'one', label: 'One' },
  { value: 'two', label: 'Two' },
] as const

function Harness({
  multiple,
  allowPrimary,
}: {
  readonly multiple: boolean
  readonly allowPrimary: boolean
}) {
  const [selected, setSelected] = useState<readonly ('one' | 'two')[]>([])
  const [primary, setPrimary] = useState<'one' | 'two' | null>(null)
  return (
    <>
      <SelectionMenu
        options={OPTIONS}
        selected={selected}
        primary={primary}
        multiple={multiple}
        allowPrimary={allowPrimary}
        menuLabel="Choose values"
        triggerLabel="Manage values"
        renderAssigned={({ label }, main) => (
          <span>{`${label}${main ? ' (main)' : ''}`}</span>
        )}
        renderOption={({ label }) => <span>{label}</span>}
        mainAction={({ label }) => ({
          label: 'Main',
          accessibleLabel: `Make ${label} main`,
        })}
        onSelectionChange={(values) => {
          setSelected(values)
          if (primary && !values.includes(primary)) {
            setPrimary(values[0] ?? null)
          }
        }}
        onPrimaryChange={setPrimary}
      />
      <output aria-label="selected-values">{selected.join('|')}</output>
      <output aria-label="primary-value">{primary}</output>
    </>
  )
}

describe('SelectionMenu', () => {
  it('supports shared multi-selection and optional main-item choice', async () => {
    const user = userEvent.setup()
    render(<Harness multiple allowPrimary />)

    await user.click(screen.getByRole('button', { name: 'Manage values' }))
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'One' }))
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Two' }))
    await user.click(screen.getByRole('menuitem', { name: 'Make Two main' }))

    expect(screen.getByLabelText('selected-values')).toHaveTextContent(
      'one|two',
    )
    expect(screen.getByLabelText('primary-value')).toHaveTextContent('two')
    expect(
      screen.getByRole('menuitem', { name: 'Make Two main' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('supports a single-choice menu without primary-item controls', async () => {
    const user = userEvent.setup()
    render(<Harness multiple={false} allowPrimary={false} />)

    await user.click(screen.getByRole('button', { name: 'Manage values' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'One' }))

    expect(screen.getByLabelText('selected-values')).toHaveTextContent('one')
    expect(screen.queryByRole('menuitem', { name: /main/i })).toBeNull()
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
    )
  })
})
