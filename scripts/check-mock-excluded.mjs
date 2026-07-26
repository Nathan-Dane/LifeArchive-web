#!/usr/bin/env node
/**
 * Production bundle check: the development mock must not be shippable.
 *
 * `src/core/mock/selectClient.ts` reaches the mock only through a dynamic
 * import inside a branch that `import.meta.env.PROD` makes statically false, so
 * a production build should drop the module entirely. This check proves that
 * claim against the built output instead of trusting it.
 *
 * It greps every emitted asset for a marker string that exists nowhere except
 * the mock. A string literal survives minification, so its absence is real
 * evidence that the module was eliminated.
 *
 * Run it after `pnpm build`. It fails if `dist/` is missing or empty, so a
 * stale or absent build cannot pass silently.
 *
 * Usage: node scripts/check-mock-excluded.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dirname, '..')
const DIST = path.join(ROOT, 'dist')

/** Must stay identical to `DEVELOPMENT_MOCK_MARKER` in the mock module. */
const MARKER = 'lifearchive:development-mock:v1'

/** Extensions worth reading. Everything emitted by Vite that can hold code. */
const TEXT_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.html',
  '.map',
])

function walk(directory, collected = []) {
  let entries
  try {
    entries = readdirSync(directory, { withFileTypes: true })
  } catch {
    return null
  }
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(absolute, collected)
      continue
    }
    collected.push(absolute)
  }
  return collected
}

const files = walk(DIST)
if (files === null) {
  console.error(
    'mock-exclusion: dist/ is missing. Run `pnpm build` before this check.',
  )
  process.exit(1)
}

const scripts = files.filter((file) => path.extname(file) === '.js')
if (scripts.length === 0) {
  console.error(
    'mock-exclusion: dist/ contains no JavaScript. Run `pnpm build` before this check.',
  )
  process.exit(1)
}

const offenders = []
for (const file of files) {
  if (!TEXT_EXTENSIONS.has(path.extname(file))) continue
  const relative = path.relative(ROOT, file).split(path.sep).join('/')
  if (path.basename(file).toLowerCase().includes('mock')) {
    offenders.push(`${relative} (a chunk named for the mock was emitted)`)
    continue
  }
  const text = readFileSync(file, 'utf8')
  if (text.includes(MARKER)) {
    offenders.push(`${relative} (contains ${MARKER})`)
  }
}

if (offenders.length > 0) {
  console.error(
    'mock-exclusion: the development mock survived into the production build.',
  )
  for (const offender of offenders) {
    console.error(`    ${offender}`)
  }
  console.error(
    '\nThe mock must be reachable only through the dynamic import in',
  )
  console.error(
    'src/core/mock/selectClient.ts, guarded by import.meta.env.PROD.',
  )
  process.exit(1)
}

console.log(
  `mock-exclusion: ${files.length} built files checked, no development mock found.`,
)
console.log(
  `mock-exclusion: ${statSync(DIST).isDirectory() ? 'dist/' : DIST} contains ${scripts.length} script(s).`,
)
