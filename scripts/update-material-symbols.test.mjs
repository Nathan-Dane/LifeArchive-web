import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  generatedSubsetCss,
  googleFontsCssUrl,
  selectedMaterialIconNames,
  sha256,
  validateSubset,
} from './update-material-symbols.mjs'

test('references the generated local font asset', () => {
  const css = generatedSubsetCss()
  assert.match(css, /@font-face/)
  assert.match(css, /url\('\.\/material-symbols-rounded-subset\.woff2'\)/)
  assert.doesNotMatch(css, /base64/)
  assert.doesNotMatch(css, /https?:\/\//)
})

test('builds one sorted, duplicate-free selection from semantic, shell, and editor glyphs', () => {
  const names = selectedMaterialIconNames()
  assert.equal(names.length, 180)
  assert.deepEqual(names, [...names].sort())
  assert.equal(new Set(names).size, names.length)
  for (const required of [
    'cake',
    'calendar_month',
    'check_box',
    'delete',
    'format_bold',
    'format_clear',
    'format_h1',
    'format_h2',
    'format_indent_increase',
    'format_list_bulleted',
    'format_paragraph',
    'format_quote',
    'grid_view',
    'horizontal_rule',
    'question_mark',
    'redo',
    'settings',
    'star_outline',
    'strikethrough_s',
    'undo',
  ]) {
    assert(names.includes(required), required)
  }
})

test('builds a deterministic subset URL with the selection in the query', () => {
  const url = new URL(googleFontsCssUrl(['cake', 'flag']))
  assert.equal(url.origin, 'https://fonts.googleapis.com')
  assert.equal(url.searchParams.get('icon_names'), 'cake,flag')
  assert.equal(url.searchParams.get('display'), 'block')
})

test('validates bytes, checksum, axes, URL, and exact selection', () => {
  const font = Buffer.concat([Buffer.from('wOF2'), Buffer.from('test-font')])
  const iconNames = ['cake', 'flag']
  const manifest = {
    manifestVersion: 1,
    family: 'Material Symbols Rounded:opsz,wght,FILL,GRAD@24,400,1,0',
    iconNames,
    cssApiUrl: googleFontsCssUrl(iconNames),
    fontSourceUrl: 'https://fonts.gstatic.com/l/font?kit=test',
    byteLength: font.byteLength,
    sha256: sha256(font),
  }
  assert.deepEqual(
    validateSubset({ font, manifest, expectedIconNames: iconNames }),
    [],
  )
  assert(
    validateSubset({
      font,
      manifest,
      expectedIconNames: ['cake', 'flag', 'star'],
    }).includes('manifest icon selection is stale'),
  )
})
