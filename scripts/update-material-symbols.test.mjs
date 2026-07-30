import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  generatedSubsetCss,
  googleFontsCssUrl,
  selectedMaterialIconNames,
  sha256,
  validateSubset,
} from './update-material-symbols.mjs'

test('embeds the generated font bytes in a local stylesheet', () => {
  const css = generatedSubsetCss(Buffer.from('woff2-test'))
  assert.match(css, /@font-face/)
  assert.match(css, /url\('data:font\/woff2;base64,d29mZjItdGVzdA=='\)/)
  assert.doesNotMatch(css, /https?:\/\//)
})

test('builds one sorted, duplicate-free selection from semantic and UI glyphs', () => {
  const names = selectedMaterialIconNames()
  assert.equal(names.length, 162)
  assert.deepEqual(names, [...names].sort())
  assert.equal(new Set(names).size, names.length)
  for (const required of [
    'cake',
    'calendar_month',
    'check_box',
    'grid_view',
    'question_mark',
    'settings',
    'star_outline',
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
