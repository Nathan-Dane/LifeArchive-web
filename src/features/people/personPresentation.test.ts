import { describe, expect, it } from 'vitest'
import { personInitials } from './personPresentation'

describe('personInitials', () => {
  it('uses whole Unicode grapheme clusters and never splits emoji', () => {
    expect(personInitials('👨‍👩‍👧‍👦 Rivera')).toBe('👨‍👩‍👧‍👦R')
    expect(personInitials('e\u0301lodie')).toBe('E\u0301L')
  })
})
