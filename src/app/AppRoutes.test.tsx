import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  FORBIDDEN_AVAILABILITY_CLAIMS,
  FORBIDDEN_PERSISTENCE_CLAIMS,
} from '../test/claims'
import { renderAppAt } from '../test/render'

const ROUTES = ['/', '/record', '/timeline', '/settings'] as const

describe('application shell', () => {
  it('redirects / to /record', () => {
    renderAppAt('/')
    expect(screen.getByRole('heading', { name: 'Record' })).toBeInTheDocument()
  })

  it('reaches /record', () => {
    renderAppAt('/record')
    expect(screen.getByRole('heading', { name: 'Record' })).toBeInTheDocument()
  })

  it('reaches /timeline', () => {
    renderAppAt('/timeline')
    expect(
      screen.getByRole('heading', { name: 'Timeline' }),
    ).toBeInTheDocument()
  })

  it('reaches /settings', () => {
    renderAppAt('/settings')
    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
  })

  it('navigates between routes from the main navigation', async () => {
    const user = userEvent.setup()
    renderAppAt('/')
    const nav = screen.getByRole('navigation', { name: 'Main' })

    await user.click(within(nav).getByRole('link', { name: 'Timeline' }))
    expect(
      screen.getByRole('heading', { name: 'Timeline' }),
    ).toBeInTheDocument()

    await user.click(within(nav).getByRole('link', { name: 'Settings' }))
    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()

    await user.click(within(nav).getByRole('link', { name: 'Record' }))
    expect(screen.getByRole('heading', { name: 'Record' })).toBeInTheDocument()
  })

  it.each(ROUTES)('makes no persistence claim on %s', (path) => {
    const { container } = renderAppAt(path)
    const text = container.textContent ?? ''

    for (const claim of FORBIDDEN_PERSISTENCE_CLAIMS) {
      expect(text).not.toMatch(claim)
    }
  })

  it.each(ROUTES)(
    'does not claim a runtime or archive is available on %s',
    (path) => {
      const { container } = renderAppAt(path)
      const text = container.textContent ?? ''

      for (const claim of FORBIDDEN_AVAILABILITY_CLAIMS) {
        expect(text).not.toMatch(claim)
      }
    },
  )
})
