import { describe, expect, it } from 'vitest'
import { KNOWN_FAILURE_CODES } from '../core/client'
import {
  FORBIDDEN_AVAILABILITY_CLAIMS,
  FORBIDDEN_PERSISTENCE_CLAIMS,
} from '../test/claims'
import { mergeCatalogs } from './catalog'
import { CATALOG_LOCALE, enMessages, FEATURE_CATALOGS } from './messages/en'

const PHRASES = Object.entries(enMessages).flatMap(
  ([key, entry]: [string, unknown]) =>
    typeof entry === 'string'
      ? [[key, entry] as const]
      : Object.values(entry as object)
          .filter((phrase): phrase is string => typeof phrase === 'string')
          .map((phrase) => [key, phrase] as const),
)

const RESULT_DERIVED_PERSISTENCE_CLAIM_KEYS = new Set([
  'record.editor.status.saved',
  'record.event.status.saved',
])

describe('the English catalog', () => {
  it('is the locale it says it is', () => {
    expect(CATALOG_LOCALE).toBe('en')
  })

  it('lets no feature redefine another feature s key', () => {
    expect(() => mergeCatalogs(...FEATURE_CATALOGS)).not.toThrow()
    expect(Object.keys(enMessages).length).toBe(
      FEATURE_CATALOGS.reduce(
        (total, catalog) => total + Object.keys(catalog).length,
        0,
      ),
    )
  })

  it('namespaces every key under its feature', () => {
    for (const key of Object.keys(enMessages)) {
      expect(key, key).toMatch(/^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/)
    }
  })

  it('holds complete, trimmed phrases', () => {
    for (const [key, phrase] of PHRASES) {
      expect(phrase, key).not.toBe('')
      expect(phrase, key).toBe(phrase.trim())
    }
  })

  it('leaves no placeholder unnamed', () => {
    for (const [key, phrase] of PHRASES) {
      for (const match of phrase.matchAll(/\{([^}]*)\}/g)) {
        expect(match[1], key).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/)
      }
    }
  })

  it('keeps persistence claims limited to result-derived status keys', () => {
    for (const [key, phrase] of PHRASES) {
      const claims = RESULT_DERIVED_PERSISTENCE_CLAIM_KEYS.has(key)
        ? FORBIDDEN_AVAILABILITY_CLAIMS
        : [...FORBIDDEN_PERSISTENCE_CLAIMS, ...FORBIDDEN_AVAILABILITY_CLAIMS]
      for (const claim of claims) {
        expect(claim.test(phrase), `${key} matches ${String(claim)}`).toBe(
          false,
        )
      }
    }
  })

  it('has wording for every failure code the client expects one for', () => {
    for (const code of KNOWN_FAILURE_CODES) {
      expect(Object.hasOwn(enMessages, `failure.${code}`), code).toBe(true)
    }
    expect(Object.hasOwn(enMessages, 'failure.generic')).toBe(true)
  })
})
