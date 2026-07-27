import { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import local from '../../eslint-rules/local-plugin.js'

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
        rules: { 'local/no-pointer-only-actions': 'error' },
      },
    ],
    'fixture.tsx',
  )
}

describe('pointer and keyboard parity', () => {
  it('rejects a pointer-only action on static markup', () => {
    expect(lint('const action = <div onClick={close} />')).toEqual([
      expect.objectContaining({ messageId: 'pointerOnly' }),
    ])
  })

  it('accepts native controls and explicit keyboard parity', () => {
    expect(lint('const action = <button onClick={close} />')).toEqual([])
    expect(
      lint('const action = <div onClick={close} onKeyDown={handleKeyDown} />'),
    ).toEqual([])
  })
})
