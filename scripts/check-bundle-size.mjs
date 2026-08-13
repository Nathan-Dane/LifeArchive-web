#!/usr/bin/env node
/**
 * Deterministic production bundle-size budgets.
 *
 * The named budgets keep the primary application, editor, stylesheet, worker,
 * and icon font visible. Aggregate budgets catch growth moved into route or
 * helper chunks. Values are raw emitted bytes so the result does not depend on
 * a compressor version or network transfer negotiation.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'

const DEFAULT_DIST = path.resolve(import.meta.dirname, '../dist')

export const BUNDLE_SIZE_BUDGETS = Object.freeze({
  mainJavaScript: 600 * 1024,
  editorJavaScript: 300 * 1024,
  stylesheet: 160 * 1024,
  runtimeWorker: 18 * 1024,
  iconFont: 30 * 1024,
  allJavaScript: 1120 * 1024,
  allAssets: 1280 * 1024,
})

const NAMED_ASSETS = Object.freeze([
  {
    key: 'mainJavaScript',
    label: 'main JavaScript',
    matches: (name, file) =>
      /^index-[A-Za-z0-9_-]{8,}\.js$/.test(name) &&
      file.htmlEntry === true,
  },
  {
    key: 'editorJavaScript',
    label: 'editor JavaScript',
    matches: (name) =>
      /^MarkdownWritingSurface-[A-Za-z0-9_-]{8,}\.js$/.test(name),
  },
  {
    key: 'stylesheet',
    label: 'application stylesheet',
    matches: (name) => /^index-[A-Za-z0-9_-]{8,}\.css$/.test(name),
  },
  {
    key: 'runtimeWorker',
    label: 'runtime worker',
    matches: (name) => /^runtime\.worker-[A-Za-z0-9_-]{8,}\.js$/.test(name),
  },
  {
    key: 'iconFont',
    label: 'icon font',
    matches: (name) =>
      /^material-symbols-rounded-subset-[A-Za-z0-9_-]{8,}\.woff2$/.test(name),
  },
])

function walk(directory, collected = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(absolute, collected)
    else if (entry.isFile()) collected.push(absolute)
  }
  return collected
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

export function inspectBundleSize({
  dist = DEFAULT_DIST,
  budgets = BUNDLE_SIZE_BUDGETS,
} = {}) {
  let files
  try {
    const entryAsset = readEntryAsset(dist)
    files = walk(dist).map((absolute) => ({
      absolute,
      relative: path.relative(dist, absolute).split(path.sep).join('/'),
      size: statSync(absolute).size,
      htmlEntry:
        path.relative(dist, absolute).split(path.sep).join('/') === entryAsset,
    }))
  } catch {
    return {
      files: [],
      measurements: {},
      violations: ['dist/ is missing or unreadable'],
    }
  }

  const assets = files.filter((file) => file.relative.startsWith('assets/'))
  const measurements = {}
  const violations = []

  for (const asset of NAMED_ASSETS) {
    const matches = assets.filter((file) =>
      asset.matches(path.posix.basename(file.relative), file),
    )
    if (matches.length !== 1) {
      violations.push(
        `${asset.label}: expected exactly one hashed asset, found ${matches.length}`,
      )
      continue
    }
    measurements[asset.key] = matches[0].size
  }

  measurements.allJavaScript = assets
    .filter((file) => file.relative.endsWith('.js'))
    .reduce((total, file) => total + file.size, 0)
  measurements.allAssets = assets.reduce((total, file) => total + file.size, 0)

  for (const [key, maximum] of Object.entries(budgets)) {
    const actual = measurements[key]
    if (actual === undefined) continue
    if (actual > maximum) {
      violations.push(
        `${key}: ${formatBytes(actual)} exceeds ${formatBytes(maximum)} (${actual - maximum} bytes over)`,
      )
    }
  }

  return { files, measurements, violations }
}

function readEntryAsset(dist) {
  try {
    const html = readFileSync(path.join(dist, 'index.html'), 'utf8')
    const source = html.match(
      /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/iu,
    )?.[1]
    return source ? source.replace(/^\//u, '') : null
  } catch {
    return null
  }
}

function main() {
  const result = inspectBundleSize()
  if (result.violations.length > 0) {
    console.error('bundle-size: production bundle exceeds its checked budget.')
    for (const violation of result.violations) {
      console.error(`    ${violation}`)
    }
    process.exitCode = 1
    return
  }

  const summary = Object.entries(result.measurements)
    .map(([key, bytes]) => `${key} ${formatBytes(bytes)}`)
    .join(', ')
  console.log(`bundle-size: ${summary}.`)
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
}
