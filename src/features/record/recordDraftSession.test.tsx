import { useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useRecordDraftSessionGuard } from './recordDraftSession'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function GuardHarness({
  flush,
  first,
  second,
}: {
  readonly flush: () => Promise<void>
  readonly first: () => void
  readonly second: () => void
}) {
  const guard = useRecordDraftSessionGuard()
  useEffect(
    () =>
      guard.register({
        hasPendingWriting: () => true,
        flush,
      }),
    [flush, guard],
  )
  return (
    <>
      <button type="button" onClick={() => guard.flushBefore(first)}>
        First destination
      </button>
      <button type="button" onClick={() => guard.flushBefore(second)}>
        Second destination
      </button>
    </>
  )
}

describe('Record draft navigation guard', () => {
  it('waits for the pending flush and lets only the latest destination land', async () => {
    const pending = deferred()
    const first = vi.fn()
    const second = vi.fn()
    const user = userEvent.setup()
    render(
      <GuardHarness
        flush={() => pending.promise}
        first={first}
        second={second}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'First destination' }))
    await user.click(screen.getByRole('button', { name: 'Second destination' }))
    expect(first).not.toHaveBeenCalled()
    expect(second).not.toHaveBeenCalled()

    pending.resolve()
    await vi.waitFor(() => expect(second).toHaveBeenCalledOnce())
    expect(first).not.toHaveBeenCalled()
  })
})
