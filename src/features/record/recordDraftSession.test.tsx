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

function ExitGuardHarness({
  flush,
  hasPendingWriting,
  leave,
}: {
  readonly flush: () => Promise<void>
  readonly hasPendingWriting: () => boolean
  readonly leave: () => void
}) {
  const guard = useRecordDraftSessionGuard()
  useEffect(
    () => guard.register({ hasPendingWriting, flush }),
    [flush, guard, hasPendingWriting],
  )
  return (
    <button type="button" onClick={() => guard.flushBeforeExit(leave)}>
      Leave Record
    </button>
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

  it('leaves Record only when a completed flush has no pending writing', async () => {
    let pendingWriting = true
    const leave = vi.fn()
    const user = userEvent.setup()
    render(
      <ExitGuardHarness
        hasPendingWriting={() => pendingWriting}
        flush={async () => undefined}
        leave={leave}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Leave Record' }))
    expect(leave).not.toHaveBeenCalled()

    pendingWriting = false
    await user.click(screen.getByRole('button', { name: 'Leave Record' }))
    await vi.waitFor(() => expect(leave).toHaveBeenCalledOnce())
  })

  it('keeps Record mounted when its draft flush rejects', async () => {
    const leave = vi.fn()
    const user = userEvent.setup()
    render(
      <ExitGuardHarness
        hasPendingWriting={() => true}
        flush={async () => Promise.reject(new Error('save failed'))}
        leave={leave}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Leave Record' }))
    await Promise.resolve()
    expect(leave).not.toHaveBeenCalled()
  })
})
