import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  FORBIDDEN_AVAILABILITY_CLAIMS,
  FORBIDDEN_PERSISTENCE_CLAIMS,
} from '../../test/claims'
import {
  DEVELOPMENT_MOCK_NOTICE,
  DevelopmentMockBanner,
} from './DevelopmentMockBanner'

describe('the development mock banner', () => {
  it('is visible and announced', () => {
    render(<DevelopmentMockBanner />)
    const banner = screen.getByRole('status')
    expect(banner).toBeVisible()
    expect(banner).toHaveTextContent(/development mock/i)
    expect(banner).toHaveTextContent(/not durable/i)
  })

  it('offers no way to dismiss itself', () => {
    render(<DevelopmentMockBanner />)
    expect(screen.queryAllByRole('button')).toEqual([])
    expect(screen.queryAllByRole('link')).toEqual([])
  })

  it('accepts localised copy without inventing wording of its own', () => {
    render(<DevelopmentMockBanner notice="Udviklingsattrap — ikke holdbar." />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Udviklingsattrap — ikke holdbar.',
    )
    expect(screen.queryByText(DEVELOPMENT_MOCK_NOTICE)).toBeNull()
  })

  it('claims nothing about durability or availability', () => {
    for (const pattern of [
      ...FORBIDDEN_PERSISTENCE_CLAIMS,
      ...FORBIDDEN_AVAILABILITY_CLAIMS,
    ]) {
      expect(
        pattern.test(DEVELOPMENT_MOCK_NOTICE),
        `notice matches ${String(pattern)}`,
      ).toBe(false)
    }
  })
})
