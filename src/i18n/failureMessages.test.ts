import { describe, expect, it } from 'vitest'
import {
  clientFailure,
  KNOWN_FAILURE_CODES,
  type ClientFailure,
} from '../core/client'
import { defaultLocalisation, type AppLocalisation } from './context'
import {
  failureMessage,
  failureMessageKeys,
  hasFailureMessage,
} from './failureMessages'
import { createLocalisation } from './localisation'
import { enMessages } from './messages/en'

function failure(fields: Partial<ClientFailure> = {}): ClientFailure {
  return clientFailure({
    area: 'storage',
    code: 'ioFailure',
    phase: 'open',
    retryable: true,
    ...fields,
  })
}

const localisation: AppLocalisation = defaultLocalisation()

describe('failure wording', () => {
  it('looks up the area-specific key before the plain code', () => {
    expect(failureMessageKeys(failure())).toEqual([
      'failure.storage.ioFailure',
      'failure.ioFailure',
      'failure.generic',
    ])
  })

  it('has a sentence for every code the client expects one for', () => {
    for (const code of KNOWN_FAILURE_CODES) {
      const message = failureMessage(localisation, failure({ code }))
      expect(message, code).toBe(enMessages[`failure.${code}`])
      expect(hasFailureMessage(localisation, code)).toBe(true)
    }
  })

  it('falls back generically for a code this build has never seen', () => {
    const unseen = failure({ code: 'someFutureOperationCode' })
    expect(failureMessage(localisation, unseen)).toBe(
      enMessages['failure.generic'],
    )
    expect(hasFailureMessage(localisation, unseen.code)).toBe(false)
  })

  it('never shows the raw code as if it were copy', () => {
    const unseen = failure({ code: 'someFutureOperationCode' })
    expect(failureMessage(localisation, unseen)).not.toContain(unseen.code)
  })

  it('prefers area-specific wording when a catalog supplies it', () => {
    const specific = createLocalisation('en', {
      ...enMessages,
      'failure.media.ioFailure': 'That file could not be read.',
    }) as AppLocalisation
    expect(
      failureMessage(specific, failure({ area: 'media', code: 'ioFailure' })),
    ).toBe('That file could not be read.')
    expect(failureMessage(specific, failure({ area: 'storage' }))).toBe(
      enMessages['failure.ioFailure'],
    )
  })
})
