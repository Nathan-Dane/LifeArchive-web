/**
 * Architecture tests for the client boundary.
 *
 * These read the source tree instead of exercising behaviour, because the rules
 * they protect are structural: one door to durable state, generated runtime
 * types staying beneath it, and no browser-side persistence or transport
 * mechanics leaking into the interface.
 */

import { describe, expect, it } from 'vitest'

const RAW_SOURCES = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

interface SourceFile {
  /** Path relative to `src`, for example `core/client/index.ts`. */
  readonly path: string
  readonly text: string
  readonly isTest: boolean
}

const SOURCES: readonly SourceFile[] = Object.entries(RAW_SOURCES)
  .map(([key, text]) => ({
    path: key.replace(/^\/src\//, ''),
    text,
    isTest: /\.test\.tsx?$/.test(key),
  }))
  .sort((left, right) => (left.path < right.path ? -1 : 1))

/**
 * Matches `… from '…'`, a dynamic `import('…')`, and a bare side-effect
 * `import '…'`. Only single quotes appear in this repository's sources.
 */
const IMPORT_SPECIFIER =
  /\bfrom\s*'([^']+)'|\bimport\s*\(\s*'([^']+)'|^\s*import\s+'([^']+)'/gm

function importSpecifiers(file: SourceFile): readonly string[] {
  return [...file.text.matchAll(IMPORT_SPECIFIER)].map(
    (match) => match[1] ?? match[2] ?? match[3],
  )
}

/** Resolves a relative specifier to an `src`-relative directory-style path. */
function resolveSpecifier(file: SourceFile, specifier: string): string {
  const segments = file.path.split('/').slice(0, -1)
  for (const segment of specifier.split('/')) {
    if (segment === '.' || segment === '') {
      continue
    }
    if (segment === '..') {
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  return segments.join('/')
}

function relativeImports(file: SourceFile): readonly string[] {
  return importSpecifiers(file)
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => resolveSpecifier(file, specifier))
}

function isWithin(directory: string, target: string): boolean {
  return target === directory || target.startsWith(`${directory}/`)
}

function inArea(file: SourceFile, ...areas: readonly string[]): boolean {
  return areas.some((area) => file.path.startsWith(`${area}/`))
}

const clientSources = SOURCES.filter(
  (file) => isWithin('core/client', file.path) && !file.isTest,
)

function matchedPatterns(patterns: readonly RegExp[]): readonly string[] {
  return clientSources
    .flatMap((file) =>
      patterns
        .filter((pattern) => pattern.test(file.text))
        .map((pattern) => `${file.path} matches ${String(pattern)}`),
    )
    .sort()
}

describe('client boundary', () => {
  it('finds the sources it is meant to police', () => {
    expect(SOURCES.length).toBeGreaterThan(5)
    expect(SOURCES.map((file) => file.path)).toContain('core/client/index.ts')
    expect(clientSources.map((file) => file.path)).toEqual([
      'core/client/LifeArchiveClient.ts',
      'core/client/capabilities.ts',
      'core/client/errors.ts',
      'core/client/index.ts',
      'core/client/types.ts',
    ])
  })

  it('keeps feature and application code out of the runtime and mock layers', () => {
    const offenders = SOURCES.filter(
      (file) =>
        inArea(file, 'features', 'app') &&
        relativeImports(file).some(
          (target) =>
            isWithin('core/runtime', target) || isWithin('core/mock', target),
        ),
    ).map((file) => file.path)
    expect(offenders).toEqual([])
  })

  it('keeps the client module self-contained', () => {
    const offenders = clientSources
      .flatMap((file) =>
        importSpecifiers(file).map((specifier) => ({ file, specifier })),
      )
      .filter(
        ({ file, specifier }) =>
          !specifier.startsWith('.') ||
          !isWithin('core/client', resolveSpecifier(file, specifier)),
      )
      .map(({ file, specifier }) => `${file.path} -> ${specifier}`)
    expect(offenders).toEqual([])
  })

  it('imports no generated runtime declaration anywhere in the app', () => {
    const offenders = SOURCES.flatMap((file) =>
      importSpecifiers(file)
        .filter(
          (specifier) =>
            specifier.endsWith('.d.ts') || /browser-abi/i.test(specifier),
        )
        .map((specifier) => `${file.path} -> ${specifier}`),
    )
    expect(offenders).toEqual([])
  })

  it('lets no raw or untyped value escape a client signature', () => {
    expect(
      matchedPatterns([
        /:\s*unknown\b/,
        /:\s*any\b/,
        /\bas\s+any\b/,
        /\bas\s+unknown\b/,
        /<\s*any\s*>/,
        /Record<\s*string\s*,\s*unknown\s*>/,
      ]),
    ).toEqual([])
  })

  it('keeps persistence, transport, and query mechanics out of the client', () => {
    expect(
      matchedPatterns([
        /\blocalStorage\b/,
        /\bsessionStorage\b/,
        /\bindexedDB\b/,
        /\bsqlite\b/i,
        /\bpostMessage\b/,
        /new\s+Worker\b/,
        /\bSELECT\b[\s\S]{0,80}\bFROM\b/,
        /\bnavigator\s*\.\s*storage\b/,
      ]),
    ).toEqual([])
  })

  it('lets no feature fabricate a core-produced value', () => {
    const offenders = SOURCES.filter(
      (file) =>
        inArea(file, 'features', 'app') &&
        /\bcore(TimeWindow|TrackHistoryCursor)\s*\(/.test(file.text),
    ).map((file) => file.path)
    expect(offenders).toEqual([])
  })
})
