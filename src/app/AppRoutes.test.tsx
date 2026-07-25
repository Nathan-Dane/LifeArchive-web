import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from './AppRoutes'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('application shell', () => {
  it('redirects / to /record', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'Record' })).toBeInTheDocument()
  })

  it('reaches /record', () => {
    renderAt('/record')
    expect(screen.getByRole('heading', { name: 'Record' })).toBeInTheDocument()
  })

  it('reaches /timeline', () => {
    renderAt('/timeline')
    expect(
      screen.getByRole('heading', { name: 'Timeline' }),
    ).toBeInTheDocument()
  })

  it('reaches /settings', () => {
    renderAt('/settings')
    expect(
      screen.getByRole('heading', { name: 'Settings' }),
    ).toBeInTheDocument()
  })

  it('does not claim that a production runtime or archive is available', () => {
    const { container } = renderAt('/record')
    const text = container.textContent ?? ''

    for (const claim of [
      /archive (is )?(open|loaded|ready|available)/i,
      /\bsaved\b/i,
      /\bpersist(ed|ent)?\b/i,
      /\bsync(ed|ing)?\b/i,
      /runtime (is )?(ready|available|connected)/i,
    ]) {
      expect(text).not.toMatch(claim)
    }
  })
})
