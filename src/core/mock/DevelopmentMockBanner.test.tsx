import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  FORBIDDEN_AVAILABILITY_CLAIMS,
  FORBIDDEN_PERSISTENCE_CLAIMS,
} from '../../test/claims'
import { enMessages } from '../../i18n/messages/en'
import { DevelopmentMockBanner } from './DevelopmentMockBanner'

const NOTICE = enMessages['development.mock.notice']

describe('the development mock banner', () => {
  it('is visible and announced', () => {
    render(<DevelopmentMockBanner notice={NOTICE} />)
    const banner = screen.getByRole('status')
    expect(banner).toBeVisible()
    expect(banner).toHaveTextContent(/development mock/i)
    expect(banner).toHaveTextContent(/not durable/i)
  })

  it('offers no way to dismiss itself', () => {
    render(<DevelopmentMockBanner notice={NOTICE} />)
    expect(screen.queryAllByRole('button')).toEqual([])
    expect(screen.queryAllByRole('link')).toEqual([])
  })

  it('accepts localised copy without inventing wording of its own', () => {
    render(<DevelopmentMockBanner notice="Udviklingsattrap — ikke holdbar." />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Udviklingsattrap — ikke holdbar.',
    )
    expect(screen.queryByText(NOTICE)).toBeNull()
  })

  it('claims nothing about durability or availability', () => {
    for (const pattern of [
      ...FORBIDDEN_PERSISTENCE_CLAIMS,
      ...FORBIDDEN_AVAILABILITY_CLAIMS,
    ]) {
      expect(pattern.test(NOTICE), `notice matches ${String(pattern)}`).toBe(
        false,
      )
    }
  })
})
