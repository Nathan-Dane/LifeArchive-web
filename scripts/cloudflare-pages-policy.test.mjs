import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const publicDirectory = path.join(root, 'public')

function significantLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}

test('Cloudflare Pages applies the required isolation and privacy headers', async () => {
  const headers = significantLines(
    await readFile(path.join(publicDirectory, '_headers'), 'utf8'),
  )

  assert.deepEqual(headers, [
    '/*',
    'Cross-Origin-Embedder-Policy: require-corp',
    'Cross-Origin-Opener-Policy: same-origin',
    'Cross-Origin-Resource-Policy: same-origin',
    'X-Content-Type-Options: nosniff',
    'Referrer-Policy: no-referrer',
  ])
})

test('Cloudflare Pages proxies every BrowserRouter entry point to the shell', async () => {
  const [redirectsText, viteConfig] = await Promise.all([
    readFile(path.join(publicDirectory, '_redirects'), 'utf8'),
    readFile(path.join(root, 'vite.config.ts'), 'utf8'),
  ])
  const redirects = significantLines(redirectsText)

  assert.deepEqual(redirects, [
    '/record / 200',
    '/timeline / 200',
    '/settings / 200',
    '/settings/archive / 200',
  ])
  assert.ok(
    redirects.every((redirect) => !redirect.startsWith('/* ')),
    'a catch-all Pages proxy would replace real asset responses with HTML',
  )
  assert.match(viteConfig, /^\s*base: '\/',\s*$/m)
  await access(path.join(root, 'index.html'))
})
