/**
 * Tests for the lint rule that keeps copy out of components.
 *
 * The rule is what makes "no user-facing literals" a property of the
 * repository rather than a habit, so it is tested like any other behaviour:
 * the wrong code must be rejected, and the shapes real components use must not
 * be.
 */

import { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import local from '../../eslint-rules/local-plugin.js'

const CONFIG_SOURCES = import.meta.glob('/eslint.config.js', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const linter = new Linter()

function lint(code: string): readonly Linter.LintMessage[] {
  return linter.verify(
    code,
    [
      {
        files: ['**/*.tsx'],
        plugins: { local },
        languageOptions: {
          parser: tseslint.parser as Linter.Parser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        rules: { 'local/no-user-facing-literals': 'error' },
      },
    ],
    'fixture.tsx',
  )
}

function messageIds(code: string): readonly string[] {
  return lint(code).map((message) => message.messageId ?? '')
}

describe('no-user-facing-literals', () => {
  it('rejects element text written into a component', () => {
    expect(messageIds('const a = <h1>Record</h1>')).toEqual(['text'])
  })

  it('rejects a string child in an expression container', () => {
    expect(messageIds("const a = <p>{'Record'}</p>")).toEqual(['text'])
    expect(messageIds('const a = <p>{`Record`}</p>')).toEqual(['text'])
  })

  it('rejects copy hidden in the attributes only a screen reader reads', () => {
    for (const attribute of ['aria-label', 'title', 'placeholder', 'alt']) {
      expect(
        messageIds(`const a = <input ${attribute}="Search" />`),
        attribute,
      ).toEqual(['attribute'])
      expect(
        messageIds(`const a = <input ${attribute}={'Search'} />`),
        attribute,
      ).toEqual(['attribute'])
    }
  })

  it('names the attribute it objects to', () => {
    const [message] = lint('const a = <nav aria-label="Main" />')
    expect(message.message).toContain('aria-label')
  })

  it('accepts text that came from the catalog', () => {
    expect(
      messageIds(`
        const a = (
          <nav aria-label={t('app.navigation.main')}>
            <h1>{t('record.page.title')}</h1>
            <p>{detail}</p>
          </nav>
        )
      `),
    ).toEqual([])
  })

  it('accepts the literals that are identifiers rather than copy', () => {
    expect(
      messageIds(`
        const a = (
          <section className="app-state-screen" id="app-state-title">
            <a href="/record" data-testid="record">{label}</a>
            <input type="text" name="entry" />
          </section>
        )
      `),
    ).toEqual([])
  })

  it('accepts whitespace used to space markup out', () => {
    expect(messageIds("const a = <p>{title}{' '}{detail}</p>")).toEqual([])
    expect(
      messageIds(`
        const a = (
          <p>
            {title} {detail}
          </p>
        )
      `),
    ).toEqual([])
  })
})

describe('the lint rule wiring', () => {
  it('is switched on for components in the repository config', () => {
    const config = Object.values(CONFIG_SOURCES)[0] ?? ''
    expect(config).toContain('local/no-user-facing-literals')
    expect(config).toContain("files: ['src/**/*.tsx']")
  })
})
