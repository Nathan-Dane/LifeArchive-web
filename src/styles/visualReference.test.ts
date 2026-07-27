/**
 * The visual reference is a reference.
 *
 * Two rules make that true rather than aspirational: the file stays exactly as
 * it was supplied, so a later comparison is meaningful, and no application
 * source reads it, imports it, or reuses its DOM vocabulary. Reproducing the
 * hierarchy is the point; reproducing the markup is how a mock's placeholders,
 * hard-coded claims, and unapproved affordances arrive in a product by
 * accident.
 */

import { describe, expect, it } from 'vitest'

const REFERENCE_PATH = '/docs/reference/record-v0.1.0.html'

const REFERENCE = import.meta.glob('/docs/reference/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Recorded in `docs/reference/README.md`. */
const REFERENCE_SHA256 =
  'f54e344b53dce40733e3623fd7ae553bc81d047aa0e01fad743da25115101329'

const SOURCES = import.meta.glob('/src/**/*.{ts,tsx,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const APPLICATION_SOURCES = Object.entries(SOURCES).filter(
  ([path]) => !path.endsWith('visualReference.test.ts'),
)

/**
 * Class names that exist only in the reference. Ours are named for the shell
 * they belong to, so a match here means markup came across rather than intent.
 */
const REFERENCE_CLASS_NAMES = [
  'site-nav',
  'main-body',
  'owned-area',
  'details-shell',
  'primary-nav',
  'nav-item',
  'top-action',
  'panel-action',
  'record-item',
  'calendar-frame',
  'week-strip',
  'writing-area',
  'entry-kind',
  'compact-card',
  'media-card',
  'paper',
]

describe('the visual reference', () => {
  it('is byte-identical to the file that was supplied', async () => {
    const source = REFERENCE[REFERENCE_PATH]
    expect(source, REFERENCE_PATH).toBeDefined()
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(source),
    )
    const hex = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
    expect(hex).toBe(REFERENCE_SHA256)
  })

  it('is read by no application source', () => {
    for (const [path, source] of APPLICATION_SOURCES) {
      expect(source, path).not.toContain('docs/reference')
      expect(source, path).not.toContain('record-v0.1.0')
    }
  })

  it('lends the shell its hierarchy and none of its markup', () => {
    for (const [path, source] of APPLICATION_SOURCES) {
      for (const className of REFERENCE_CLASS_NAMES) {
        expect(source, `${path} uses "${className}"`).not.toMatch(
          new RegExp(`\\b${className}\\b`),
        )
      }
    }
  })

  it('leaves the affordances the scope has not approved out of the shell', () => {
    for (const [path, source] of APPLICATION_SOURCES) {
      for (const unapproved of ['People', 'Places', 'Related']) {
        expect(source, `${path} mentions ${unapproved}`).not.toMatch(
          new RegExp(`>${unapproved}<|'${unapproved}'|"${unapproved}"`),
        )
      }
    }
  })
})
