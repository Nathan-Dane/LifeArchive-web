#!/usr/bin/env node
/**
 * Production artifact inspection.
 *
 * This is the post-build half of the production boundary. It proves that the
 * development mock and test support were tree-shaken, source maps and user
 * archives were not shipped, runtime downloads were not copied into the public
 * frontend, and executable assets carry Vite content hashes.
 *
 * Usage: node scripts/check-mock-excluded.mjs
 */

import { lstatSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'

const DEFAULT_ROOT = path.resolve(import.meta.dirname, '..')

/** Must stay identical to `DEVELOPMENT_MOCK_MARKER` in the mock module. */
const DEVELOPMENT_MOCK_MARKER = 'lifearchive:development-mock:v1'
const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.mjs',
  '.svg',
  '.txt',
  '.xml',
])
const HASHED_EXECUTABLE = /-[A-Za-z0-9_-]{8,}\.(?:css|js|mjs)$/
const TEST_SUPPORT_NAME =
  /(?:^|[._-])(?:fixture|fixtures|mock|mocks|spec|test|tests)(?:[._-]|$)/i
const ARCHIVE_OR_STORE =
  /(?:\.lifearchive(?:\.tar)?|\.sqlite3?|\.db(?:-wal|-shm)?)$/i
const RUNTIME_METADATA = new Set([
  'local-runtime.json',
  'runtime-manifest.json',
  'runtime.lock.json',
])

function walk(directory, collected = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(absolute, collected)
    } else {
      collected.push(absolute)
    }
  }
  return collected
}

export function inspectProductionArtifact({
  root = DEFAULT_ROOT,
  dist = path.join(root, 'dist'),
} = {}) {
  const offenders = []
  let files
  try {
    files = walk(dist)
  } catch {
    return {
      files: [],
      scripts: [],
      offenders: ['dist/ is missing or unreadable'],
      appVersion: null,
      runtimeVersion: null,
      runtimeStatus: null,
    }
  }

  let packageMetadata
  let runtimeLock
  try {
    packageMetadata = JSON.parse(
      readFileSync(path.join(root, 'package.json'), 'utf8'),
    )
    runtimeLock = JSON.parse(
      readFileSync(path.join(root, 'runtime/runtime.lock.json'), 'utf8'),
    )
  } catch {
    offenders.push('package or runtime lock metadata is missing or malformed')
  }

  const scripts = files.filter((file) =>
    ['.js', '.mjs'].includes(path.extname(file).toLowerCase()),
  )
  if (!statSync(dist).isDirectory()) {
    offenders.push('dist/ is not a directory')
  }
  if (!files.some((file) => path.relative(dist, file) === 'index.html')) {
    offenders.push('dist/index.html is missing')
  }
  if (scripts.length === 0) {
    offenders.push('dist/ contains no JavaScript')
  }

  let appVersionFound = false
  for (const file of files) {
    const relative = path.relative(dist, file).split(path.sep).join('/')
    const basename = path.basename(file)
    const lower = relative.toLowerCase()

    if (lstatSync(file).isSymbolicLink()) {
      offenders.push(`${relative} (symbolic links are not production files)`)
      continue
    }
    if (ARCHIVE_OR_STORE.test(lower)) {
      offenders.push(`${relative} (contains archive or archive-store material)`)
    }
    if (
      lower.endsWith('.wasm') ||
      lower.endsWith('.d.ts') ||
      RUNTIME_METADATA.has(basename.toLowerCase())
    ) {
      offenders.push(`${relative} (contains a runtime payload or its metadata)`)
    }
    if (
      relative.split('/').some((segment) => TEST_SUPPORT_NAME.test(segment))
    ) {
      offenders.push(`${relative} (named for test, fixture, or mock support)`)
    }
    if (lower.endsWith('.map')) {
      offenders.push(`${relative} (source maps are excluded from production)`)
      continue
    }
    const extension = path.extname(file).toLowerCase()
    if (['.css', '.js', '.mjs'].includes(extension)) {
      if (
        !relative.startsWith('assets/') ||
        !HASHED_EXECUTABLE.test(basename)
      ) {
        offenders.push(
          `${relative} (executable asset lacks a production content hash)`,
        )
      }
    }
    if (!TEXT_EXTENSIONS.has(extension)) continue
    const text = readFileSync(file, 'utf8')
    if (text.includes(DEVELOPMENT_MOCK_MARKER)) {
      offenders.push(`${relative} (contains ${DEVELOPMENT_MOCK_MARKER})`)
    }
    if (/sourceMappingURL\s*=/.test(text)) {
      offenders.push(`${relative} (references a source map)`)
    }
    if (
      ['.js', '.mjs'].includes(extension) &&
      typeof packageMetadata?.version === 'string' &&
      text.includes(packageMetadata.version)
    ) {
      appVersionFound = true
    }
  }

  if (
    typeof packageMetadata?.version !== 'string' ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(packageMetadata.version)
  ) {
    offenders.push('package.json does not declare an exact app version')
  } else if (!appVersionFound) {
    offenders.push(
      `built JavaScript does not contain app version ${packageMetadata.version}`,
    )
  }
  if (
    runtimeLock &&
    !(
      (runtimeLock.status === 'not-integrated' &&
        runtimeLock.runtimeVersion === null) ||
      (runtimeLock.status === 'pinned' &&
        typeof runtimeLock.runtimeVersion === 'string')
    )
  ) {
    offenders.push('runtime lock version/status metadata is inconsistent')
  }

  return {
    files,
    scripts,
    offenders,
    appVersion: packageMetadata?.version ?? null,
    runtimeVersion: runtimeLock?.runtimeVersion ?? null,
    runtimeStatus: runtimeLock?.status ?? null,
  }
}

function main() {
  const result = inspectProductionArtifact()
  if (result.offenders.length > 0) {
    console.error('production-artifact: unsafe or unexpected output found.')
    for (const offender of result.offenders) {
      console.error(`    ${offender}`)
    }
    process.exitCode = 1
    return
  }
  console.log(
    `production-artifact: ${result.files.length} files checked; ${result.scripts.length} hashed script(s), app ${result.appVersion}, runtime ${result.runtimeStatus}${result.runtimeVersion ? ` ${result.runtimeVersion}` : ''}.`,
  )
  console.log(
    'production-artifact: no mocks, fixtures, source maps, runtime payloads, or archive material found.',
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
}
