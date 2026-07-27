#!/usr/bin/env node
/**
 * Repository safety check.
 *
 * This is a boundary tripwire, not a security scanner. It catches the obvious,
 * mechanical mistakes that would break the public/private split described in
 * `docs/architecture/repository-boundary.md`: private runtime artifacts, Rust
 * source, archive databases, keys, secrets, or a copy of the sibling private
 * repository committed into this public tree.
 *
 * It only inspects files Git tracks (or, outside a Git checkout, the working
 * tree minus ignored directories). It cannot tell you a repository is clean —
 * only that these specific mistakes are absent.
 *
 * Usage: node scripts/check-repo-safety.mjs
 */

import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'

const ROOT = path.resolve(import.meta.dirname, '..')

/** Directories never walked in the non-Git fallback. */
const SKIPPED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
])

/**
 * Wasm fixtures that are deliberately committed. Every entry must be a
 * repository-relative path and must be reviewed before it is added.
 */
const APPROVED_WASM_FIXTURES = new Set([])

/** Each rule reports the paths it objects to. */
const RULES = [
  {
    name: 'Compiled Wasm',
    why: 'The proprietary runtime is downloaded, never committed.',
    matches: (file) =>
      file.endsWith('.wasm') && !APPROVED_WASM_FIXTURES.has(file),
  },
  {
    name: 'Private key material',
    why: 'Keys and certificates never belong in a repository.',
    matches: (file) =>
      /(^|\/)(id_rsa|id_dsa|id_ecdsa|id_ed25519)$/.test(file) ||
      /\.(pem|key|p12|pfx|jks|keystore|asc|gpg)$/.test(file),
  },
  {
    name: 'Environment secrets',
    why: 'Secrets belong in the CI secret store, not in Git.',
    matches: (file) => {
      const name = path.posix.basename(file)
      if (!/^\.env(\..+)?$/.test(name)) return false
      return !/\.(example|sample|template)$/.test(name)
    },
  },
  {
    name: 'Copy of the private repository',
    why: 'The private repository is a sibling, never a nested copy.',
    matches: (file) =>
      /(^|\/)LifeArchive\//.test(file) ||
      /(^|\/)(Cargo\.toml|Cargo\.lock)$/.test(file) ||
      /\.(xcodeproj|xcworkspace)\//.test(file),
  },
  {
    name: 'Rust source',
    why: 'Rust source is private and stays in the private repository.',
    matches: (file) =>
      file.endsWith('.rs') && (/^src\//.test(file) || /^runtime\//.test(file)),
  },
  {
    name: 'Archive database',
    why: 'Archive stores are user data and are never committed.',
    matches: (file) => /\.(sqlite|sqlite3|db|db-wal|db-shm)$/.test(file),
  },
  {
    name: 'User archive',
    why: '.lifearchive directories and .lifearchive.tar transports are user archives, not repository content.',
    matches: (file) => {
      const lower = file.toLowerCase()
      return (
        lower.endsWith('.lifearchive') || lower.endsWith('.lifearchive.tar')
      )
    },
  },
]

export function findRepositoryViolations(files) {
  return RULES.map((rule) => ({
    rule,
    files: files.filter((file) => rule.matches(file)),
  })).filter((violation) => violation.files.length > 0)
}

function listTrackedFiles() {
  try {
    const output = execFileSync('git', ['ls-files', '-z'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return output.split('\0').filter(Boolean)
  } catch {
    return null
  }
}

function walkWorkingTree(directory = ROOT, collected = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue
      walkWorkingTree(path.join(directory, entry.name), collected)
      continue
    }
    if (entry.isFile() || entry.isSymbolicLink()) {
      const absolute = path.join(directory, entry.name)
      collected.push(path.relative(ROOT, absolute).split(path.sep).join('/'))
    }
  }
  return collected
}

function describeSize(file) {
  try {
    return `${statSync(path.join(ROOT, file)).size} bytes`
  } catch {
    return 'missing on disk'
  }
}

function main() {
  const tracked = listTrackedFiles()
  const files = tracked ?? walkWorkingTree()
  const source = tracked ? 'tracked by Git' : 'in the working tree'
  const violations = findRepositoryViolations(files)

  if (violations.length === 0) {
    console.log(
      `repo-safety: ${files.length} files ${source} checked, no forbidden material found.`,
    )
    console.log(
      'repo-safety: this is a boundary tripwire for obvious mistakes, not a complete security scan.',
    )
    return
  }

  console.error(
    'repo-safety: forbidden material found in the public repository.',
  )
  for (const { rule, files: offending } of violations) {
    console.error(`\n  ${rule.name} — ${rule.why}`)
    for (const file of offending) {
      console.error(`    ${file} (${describeSize(file)})`)
    }
  }
  console.error(
    '\nRemove these files, and if they were committed, rewrite the history that contains them.',
  )
  process.exitCode = 1
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
}
