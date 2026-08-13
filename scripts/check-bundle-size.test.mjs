import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { BUNDLE_SIZE_BUDGETS, inspectBundleSize } from './check-bundle-size.mjs'

const NAMED_FIXTURES = {
  'index-AbCd1234.js': 'mainJavaScript',
  'MarkdownWritingSurface-AbCd1234.js': 'editorJavaScript',
  'index-AbCd1234.css': 'stylesheet',
  'runtime.worker-AbCd1234.js': 'runtimeWorker',
  'material-symbols-rounded-subset-AbCd1234.woff2': 'iconFont',
}

async function fixture(overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'bundle-size-'))
  const dist = path.join(root, 'dist')
  const assets = path.join(dist, 'assets')
  await mkdir(assets, { recursive: true })
  for (const [name, key] of Object.entries(NAMED_FIXTURES)) {
    const size = overrides[name] ?? Math.min(BUNDLE_SIZE_BUDGETS[key], 1024)
    await writeFile(path.join(assets, name), Buffer.alloc(size))
  }
  await writeFile(path.join(dist, 'index.html'), '<main></main>\n')
  return { root, dist, assets }
}

test('accepts the expected production assets within every budget', async () => {
  const { root, dist } = await fixture()
  try {
    const result = inspectBundleSize({ dist })
    assert.deepEqual(result.violations, [])
    assert.equal(result.measurements.mainJavaScript, 1024)
    assert.equal(result.measurements.iconFont, 1024)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects a named asset one byte above its budget', async () => {
  const name = 'MarkdownWritingSurface-AbCd1234.js'
  const { root, dist } = await fixture({
    [name]: BUNDLE_SIZE_BUDGETS.editorJavaScript + 1,
  })
  try {
    assert.match(
      inspectBundleSize({ dist }).violations.join('\n'),
      /editorJavaScript: .*1 bytes over/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects missing and duplicate named production assets', async () => {
  const { root, dist, assets } = await fixture()
  try {
    await rm(path.join(assets, 'runtime.worker-AbCd1234.js'))
    await writeFile(path.join(assets, 'index-EfGh5678.css'), '')
    const violations = inspectBundleSize({ dist }).violations.join('\n')
    assert.match(violations, /runtime worker: expected exactly one .* found 0/)
    assert.match(
      violations,
      /application stylesheet: expected exactly one .* found 2/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('aggregate JavaScript budget catches growth moved to another chunk', async () => {
  const { root, dist, assets } = await fixture()
  try {
    await writeFile(
      path.join(assets, 'route-AbCd1234.js'),
      Buffer.alloc(BUNDLE_SIZE_BUDGETS.allJavaScript),
    )
    assert.match(
      inspectBundleSize({ dist }).violations.join('\n'),
      /allJavaScript: .* exceeds/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
