import { describe, expect, it } from 'vitest'
import type { SemanticId } from '../core/client'
import type { AppLocalisation } from './context'
import { createLocalisation } from './localisation'
import { enMessages } from './messages/en'
import { semanticName, semanticNameKey } from './semanticNames'

/**
 * Record and Timeline own semantic names. The named case exercises the
 * complete Record catalogue and a Timeline-local extension.
 */
const withNames = createLocalisation('en', {
  ...enMessages,
  'record.semantic.icon.birthday': 'Birthday',
  'timeline.semantic.tag.travel': 'Travel',
}) as AppLocalisation

const plain = createLocalisation('en', enMessages) as AppLocalisation

function id(value: string): SemanticId {
  return value
}

describe('semantic names', () => {
  it('builds the key the owning feature supplies', () => {
    expect(semanticNameKey('record', 'icon', id('birthday'))).toBe(
      'record.semantic.icon.birthday',
    )
  })

  it('uses the owning feature s name when it has one', () => {
    expect(semanticName(withNames, 'record', 'icon', id('birthday'))).toEqual({
      text: 'Birthday',
      accessibleName: 'Birthday',
      recognised: true,
    })
    expect(semanticName(withNames, 'timeline', 'tag', id('travel')).text).toBe(
      'Travel',
    )
  })

  it('keeps an unknown ID exactly as the core spelled it', () => {
    for (const value of [
      'birthday.future',
      'Anniversary_2',
      'core.icon.unheard-of',
      'ÅRSDAG',
      'tag with spaces',
    ]) {
      const resolved = semanticName(plain, 'record', 'icon', id(value))
      expect(resolved.text).toBe(value)
      expect(resolved.recognised).toBe(false)
    }
  })

  it('gives an unknown ID a neutral localised accessible name', () => {
    expect(
      semanticName(plain, 'record', 'icon', id('unheard-of')).accessibleName,
    ).toBe('Unrecognised icon unheard-of')
    expect(
      semanticName(plain, 'timeline', 'tag', id('unheard-of')).accessibleName,
    ).toBe('Unrecognised tag unheard-of')
  })

  it('does not let one feature s name answer for another s', () => {
    expect(
      semanticName(withNames, 'timeline', 'icon', id('birthday')).recognised,
    ).toBe(false)
  })
})
