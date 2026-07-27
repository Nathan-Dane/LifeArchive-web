/**
 * The token set is checked, not merely written.
 *
 * Two appearances are easy to specify and easy to half-specify: a colour added
 * for dark and forgotten for light is invisible until someone reads in the
 * other appearance. These tests hold the pair rule, the contrast the pairs have
 * to reach in *both* appearances, and the correspondence between the
 * breakpoint tokens and the media queries that repeat their values.
 */

import { describe, expect, it } from 'vitest'

const STYLESHEETS = import.meta.glob('/src/styles/*.css', {
  query: '?inline',
  import: 'default',
  eager: true,
}) as Record<string, string>

function styles(name: string): string {
  const source = STYLESHEETS[`/src/styles/${name}`]
  if (source === undefined) throw new Error(`No stylesheet named ${name}`)
  return source
}

const TOKENS_CSS = styles('tokens.css')
const LAYOUT_CSS = styles('layout.css')
const TYPOGRAPHY_CSS = styles('typography.css')
const GLOBAL_CSS = styles('global.css')
const ALL_CSS = [TOKENS_CSS, LAYOUT_CSS, TYPOGRAPHY_CSS, GLOBAL_CSS]

interface AppearancePair {
  readonly light: string
  readonly dark: string
}

/** Every `--token: light-dark(light, dark)` declaration in `tokens.css`. */
function colourPairs(): ReadonlyMap<string, AppearancePair> {
  const pairs = new Map<string, AppearancePair>()
  const declaration =
    /(--[a-z0-9-]+):\s*light-dark\(\s*(#[0-9a-f]{3,8})\s*,\s*(#[0-9a-f]{3,8})\s*\)/g
  for (const [, token, light, dark] of TOKENS_CSS.matchAll(declaration)) {
    pairs.set(token!, { light: light!, dark: dark! })
  }
  return pairs
}

const COLOURS = colourPairs()

function channel(hex: string, offset: number): number {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  return (
    0.2126 * channel(hex, 1) +
    0.7152 * channel(hex, 3) +
    0.0722 * channel(hex, 5)
  )
}

/** WCAG 2.1 contrast ratio. */
function contrast(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (first, second) => second - first,
  )
  return (lighter! + 0.05) / (darker! + 0.05)
}

function ratio(
  foreground: string,
  background: string,
  appearance: keyof AppearancePair,
): number {
  const front = COLOURS.get(foreground)
  const back = COLOURS.get(background)
  if (!front || !back) {
    throw new Error(`Unknown token in pair: ${foreground} on ${background}`)
  }
  return contrast(front[appearance], back[appearance])
}

/** Every surface a foreground colour is allowed to sit on. */
const SURFACES = [
  '--color-page',
  '--color-page-warm',
  '--color-surface',
  '--color-surface-alt',
  '--color-surface-raised',
] as const

describe('the colour tokens', () => {
  it('specifies both appearances for every colour', () => {
    /*
     * Gold is bright in both appearances, so the label on a gold control is
     * the same near-black either way. It is the one pair allowed to match.
     */
    const MAY_MATCH = new Set(['--color-on-accent'])
    expect(COLOURS.size).toBeGreaterThan(0)
    for (const [token, pair] of COLOURS) {
      expect(pair.light, token).toMatch(/^#[0-9a-f]{6}$/)
      expect(pair.dark, token).toMatch(/^#[0-9a-f]{6}$/)
      if (!MAY_MATCH.has(token)) {
        expect(pair.light, token).not.toBe(pair.dark)
      }
    }
  })

  it('names the appearances the stylesheet can be switched to', () => {
    for (const appearance of ['light', 'dark', 'system']) {
      expect(TOKENS_CSS).toContain(`:root[data-appearance='${appearance}']`)
    }
  })

  it('leaves no colour outside the token set', () => {
    /*
     * `global.css` is the aggregate — it inlines the imported files — so the
     * rule is checked on the stylesheets that are supposed to consume tokens
     * rather than define them.
     */
    for (const css of [LAYOUT_CSS, TYPOGRAPHY_CSS]) {
      expect(css).not.toMatch(/:\s*#[0-9a-f]{3,8}\b/i)
      expect(css).not.toMatch(/\b(rgb|hsl)a?\(/i)
    }
  })
})

describe('contrast in both appearances', () => {
  it('reads body and secondary text on every surface', () => {
    for (const appearance of ['light', 'dark'] as const) {
      for (const surface of SURFACES) {
        expect(
          ratio('--color-text-primary', surface, appearance),
          `${appearance} primary on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          ratio('--color-text-secondary', surface, appearance),
          `${appearance} secondary on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('keeps tertiary below the text thresholds, so nothing readable uses it', () => {
    /*
     * Tertiary is the de-emphasised mark: out-of-month days, empty-state dots,
     * the dimmed half of a pair. It lands between 2.8:1 and 4.3:1 depending on
     * the surface — under the 4.5:1 that text needs — which is exactly why no
     * type style is allowed to reach for it. The assertion is the floor that
     * keeps it perceptible, and the second expectation is the rule that keeps
     * it away from words.
     */
    for (const appearance of ['light', 'dark'] as const) {
      for (const surface of SURFACES) {
        expect(
          ratio('--color-text-tertiary', surface, appearance),
          `${appearance} tertiary on ${surface}`,
        ).toBeGreaterThanOrEqual(2.8)
      }
    }
    expect(TYPOGRAPHY_CSS).not.toContain('--color-text-tertiary')
  })

  it('reads the label on a filled accent control', () => {
    for (const appearance of ['light', 'dark'] as const) {
      expect(
        ratio('--color-on-accent', '--color-accent', appearance),
        appearance,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('shows the focus ring against every surface', () => {
    for (const appearance of ['light', 'dark'] as const) {
      for (const surface of SURFACES) {
        expect(
          ratio('--color-focus-ring', surface, appearance),
          `${appearance} focus ring on ${surface}`,
        ).toBeGreaterThanOrEqual(3)
      }
    }
    expect(GLOBAL_CSS).toContain('outline: 2px solid var(--color-focus-ring)')
  })

  it('keeps meaning colours visible on the page', () => {
    for (const appearance of ['light', 'dark'] as const) {
      for (const token of [
        '--color-destructive',
        '--color-success',
        '--color-note',
      ]) {
        expect(
          ratio(token, '--color-page', appearance),
          `${appearance} ${token}`,
        ).toBeGreaterThanOrEqual(2.9)
      }
    }
  })

  it('uses compliant text tokens for normal Settings copy', () => {
    expect(LAYOUT_CSS).toMatch(
      /\.archive-health-card__facts dt\s*\{[^}]*color:\s*var\(--color-text-secondary\)/s,
    )
    expect(LAYOUT_CSS).toMatch(
      /\.settings-group__footer\s*\{[^}]*color:\s*var\(--color-text-secondary\)/s,
    )
    for (const appearance of ['light', 'dark'] as const) {
      expect(
        ratio('--color-text-secondary', '--color-surface', appearance),
        `${appearance} normal Settings text`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('the responsive breakpoints', () => {
  const breakpoints = ['details', 'navigation', 'compact', 'tight'] as const

  it('records every breakpoint as a token', () => {
    for (const name of breakpoints) {
      expect(TOKENS_CSS).toMatch(
        new RegExp(`--breakpoint-${name}:\\s*(\\d+)px`),
      )
    }
  })

  it('stages the widths from widest to narrowest', () => {
    const widths = breakpoints.map((name) =>
      Number(
        new RegExp(`--breakpoint-${name}:\\s*(\\d+)px`).exec(TOKENS_CSS)?.[1],
      ),
    )
    expect(widths).toEqual([...widths].sort((a, b) => b - a))
    expect(new Set(widths).size).toBe(widths.length)
  })

  it('uses only breakpoint widths in the media queries that stage the shell', () => {
    const declared = new Set(
      breakpoints.map((name) =>
        Number(
          new RegExp(`--breakpoint-${name}:\\s*(\\d+)px`).exec(TOKENS_CSS)?.[1],
        ),
      ),
    )
    const used = [...LAYOUT_CSS.matchAll(/max-width:\s*(\d+)px/g)].map(
      (match) => Number(match[1]),
    )
    expect(used.length).toBeGreaterThan(0)
    for (const width of used) expect(declared, `${width}px`).toContain(width)
  })

  it('collapses details before navigation', () => {
    const detailsAt = LAYOUT_CSS.indexOf('shell-action--details')
    const navigationAt = LAYOUT_CSS.indexOf('shell-action--navigation')
    expect(detailsAt).toBeGreaterThan(-1)
    expect(navigationAt).toBeGreaterThan(detailsAt)
  })

  it('reflows Settings facts and wraps archive actions at compact widths', () => {
    expect(LAYOUT_CSS).toMatch(
      /@media \(max-width: 680px\)[\s\S]*?\.settings-value-list > div\s*\{[^}]*grid-template-columns:\s*1fr/,
    )
    expect(LAYOUT_CSS).toMatch(
      /\.archive-import__actions,\s*\.archive-operation__actions\s*\{[^}]*flex-wrap:\s*wrap/s,
    )
    expect(LAYOUT_CSS).toMatch(
      /\.archive-operation__actions\[hidden\]\s*\{[^}]*display:\s*none/s,
    )
  })
})

describe('delivery safety', () => {
  it('asks for no font, image, or stylesheet over the network', () => {
    for (const css of ALL_CSS) {
      expect(css).not.toContain('@font-face')
      expect(css).not.toMatch(/url\(\s*['"]?(https?:)?\/\//i)
    }
  })

  it('references nothing from the site root, so a base path still works', () => {
    for (const css of ALL_CSS) {
      expect(css).not.toMatch(/url\(\s*['"]?\//)
    }
  })
})
