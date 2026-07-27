/**
 * Architecture tests for the development mock.
 *
 * These read the source tree rather than exercising behaviour, because the
 * rules they protect are structural: the mock must be unreachable from a
 * production build, must not reimplement core-owned policy, and must not
 * persist anything.
 *
 * The bundle itself is checked separately by `scripts/check-mock-excluded.mjs`,
 * which greps the built output. These tests protect the shape that makes that
 * elimination possible in the first place.
 */

import { describe, expect, it } from 'vitest'
import { DEVELOPMENT_MOCK_MARKER } from './developmentOnly'

const RAW_SOURCES = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

interface SourceFile {
  readonly path: string
  readonly text: string
  readonly isTest: boolean
}

const SOURCES: readonly SourceFile[] = Object.entries(RAW_SOURCES)
  .map(([key, text]) => ({
    path: key.replace(/^\/src\//, ''),
    text,
    isTest: /\.test\.tsx?$/.test(key) || key.includes('/src/test/'),
  }))
  .sort((left, right) => (left.path < right.path ? -1 : 1))

const MOCK_SOURCES = SOURCES.filter(
  (file) => file.path.startsWith('core/mock/') && !file.isTest,
)

/** A static import of the mock client, as opposed to a dynamic `import()`. */
const STATIC_MOCK_CLIENT_IMPORT =
  /^\s*import\s[^\n]*?from\s*'[^']*MockLifeArchiveClient'/m

const DYNAMIC_MOCK_CLIENT_IMPORT =
  /\bimport\s*\(\s*'[^']*MockLifeArchiveClient'/

describe('the development mock boundary', () => {
  it('finds the sources it is meant to police', () => {
    expect(MOCK_SOURCES.map((file) => file.path)).toEqual([
      'core/mock/DevelopmentMockBanner.tsx',
      'core/mock/MockLifeArchiveClient.ts',
      'core/mock/callRecorder.ts',
      'core/mock/developmentOnly.ts',
      'core/mock/scenario.ts',
      'core/mock/selectClient.ts',
    ])
  })

  it('is reached only through the selector, and only dynamically', () => {
    const staticImporters = SOURCES.filter(
      (file) => !file.isTest && STATIC_MOCK_CLIENT_IMPORT.test(file.text),
    ).map((file) => file.path)
    expect(staticImporters).toEqual([])

    const dynamicImporters = SOURCES.filter(
      (file) => !file.isTest && DYNAMIC_MOCK_CLIENT_IMPORT.test(file.text),
    ).map((file) => file.path)
    expect(dynamicImporters).toEqual(['core/mock/selectClient.ts'])
  })

  it('guards that dynamic import behind the production build flag', () => {
    const selector = MOCK_SOURCES.find(
      (file) => file.path === 'core/mock/selectClient.ts',
    )
    expect(selector).toBeDefined()
    const text = selector?.text ?? ''
    const guardIndex = text.indexOf('import.meta.env.PROD')
    const importIndex = text.search(DYNAMIC_MOCK_CLIENT_IMPORT)
    expect(guardIndex).toBeGreaterThan(-1)
    expect(importIndex).toBeGreaterThan(guardIndex)
  })

  it('constructs the mock only where the build guard has been asserted', () => {
    const constructors = SOURCES.filter(
      (file) => !file.isTest && /new\s+MockLifeArchiveClient\b/.test(file.text),
    ).map((file) => file.path)
    expect(constructors).toEqual(['core/mock/selectClient.ts'])

    const client = MOCK_SOURCES.find(
      (file) => file.path === 'core/mock/MockLifeArchiveClient.ts',
    )
    expect(client?.text).toMatch(/assertDevelopmentBuild\(/)
  })

  it('keeps the bundle marker a plain literal in exactly one place', () => {
    const declaring = MOCK_SOURCES.filter((file) =>
      file.text.includes(`'${DEVELOPMENT_MOCK_MARKER}'`),
    ).map((file) => file.path)
    expect(declaring).toEqual(['core/mock/developmentOnly.ts'])
  })

  it('reads the build environment in exactly two places', () => {
    const readers = MOCK_SOURCES.filter((file) =>
      /import\.meta\.env/.test(file.text),
    ).map((file) => file.path)
    expect(readers).toEqual([
      'core/mock/developmentOnly.ts',
      'core/mock/selectClient.ts',
    ])
  })

  it('persists nothing and holds no browser storage', () => {
    const offenders = matched([
      /\blocalStorage\b/,
      /\bsessionStorage\b/,
      /\bindexedDB\b/,
      /\bcaches\b/,
      /\bnavigator\s*\.\s*storage\b/,
      /\bdocument\s*\.\s*cookie\b/,
    ])
    expect(offenders).toEqual([])
  })

  it('performs no date arithmetic and mints nothing at random', () => {
    const offenders = matched([
      /\bnew\s+Date\b/,
      /\bDate\s*\.\s*(now|parse|UTC)\b/,
      /\bIntl\s*\./,
      /\bMath\s*\.\s*random\b/,
      /\bcrypto\s*\.\s*randomUUID\b/,
      /\btoISOString\b/,
      /\bgetTime\b/,
    ])
    expect(offenders).toEqual([])
  })

  it('reimplements no core-owned policy', () => {
    const offenders = matched([
      /\bsqlite\b/i,
      /\bSELECT\b[\s\S]{0,80}\bFROM\b/,
      /\bmigrat(e|ion)/i,
      /\bsha256\s*\(/i,
      /\bJSZip\b/,
      /\bcheck(sum|Sum)\s*\(/,
    ])
    expect(offenders).toEqual([])
  })

  it('creates no worker and speaks to no transport', () => {
    const offenders = matched([
      /new\s+Worker\b/,
      /\bpostMessage\b/,
      /\bfetch\s*\(/,
      /\bXMLHttpRequest\b/,
    ])
    expect(offenders).toEqual([])
  })

  it('lets no feature or application code import the mock at all', () => {
    const offenders = SOURCES.filter(
      (file) =>
        (file.path.startsWith('features/') || file.path.startsWith('app/')) &&
        /from\s*'[^']*core\/mock/.test(file.text),
    ).map((file) => file.path)
    expect(offenders).toEqual([])
  })
})

function matched(patterns: readonly RegExp[]): readonly string[] {
  return MOCK_SOURCES.flatMap((file) =>
    patterns
      .filter((pattern) => pattern.test(file.text))
      .map((pattern) => `${file.path} matches ${String(pattern)}`),
  ).sort()
}
