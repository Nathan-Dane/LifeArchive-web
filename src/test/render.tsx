import { render, type RenderResult } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from '../app/AppRoutes'

/**
 * Renders the application shell at a given path, without the browser history
 * the real `App` uses, so route behaviour can be asserted directly.
 */
export function renderAppAt(path: string): RenderResult {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}
