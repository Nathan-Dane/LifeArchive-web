import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { tmpdir } from 'node:os'

import { inspectProductionArtifact } from './check-mock-excluded.mjs'

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'production-artifact-'))
  await mkdir(path.join(root, 'dist/assets'), { recursive: true })
  await mkdir(path.join(root, 'runtime'), { recursive: true })
  await writeFile(
    path.join(root, 'package.json'),
    '{"name":"fixture","version":"1.2.3"}\n',
  )
  await writeFile(
    path.join(root, 'runtime/runtime.lock.json'),
    '{"status":"not-integrated","runtimeVersion":null}\n',
  )
  await writeFile(
    path.join(root, 'dist/index.html'),
    '<script type="module" src="/assets/index-AbCd1234.js"></script>\n',
  )
  await writeFile(
    path.join(root, 'dist/assets/index-AbCd1234.js'),
    'const appVersion="1.2.3";\n',
  )
  return root
}

test('accepts a minimal hashed production artifact', async () => {
  const root = await fixture()
  try {
    assert.deepEqual(inspectProductionArtifact({ root }).offenders, [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects production maps, fixtures, runtimes, and both archive forms', async () => {
  const root = await fixture()
  try {
    for (const name of [
      'index-AbCd1234.js.map',
      'mock-fixture-AbCd1234.js',
      'runtime_bg.wasm',
      'Export.lifearchive',
      'Export.lifearchive.tar',
    ]) {
      await writeFile(path.join(root, 'dist/assets', name), 'unsafe\n')
    }
    const offenders = inspectProductionArtifact({ root }).offenders.join('\n')
    assert.match(offenders, /source maps are excluded/)
    assert.match(offenders, /test, fixture, or mock support/)
    assert.match(offenders, /runtime payload/)
    assert.match(offenders, /Export\.lifearchive\b/)
    assert.match(offenders, /Export\.lifearchive\.tar/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects unversioned executable assets and source-map references', async () => {
  const root = await fixture()
  try {
    await writeFile(
      path.join(root, 'dist/assets/worker.js'),
      '//# sourceMappingURL=worker.js.map\n',
    )
    const offenders = inspectProductionArtifact({ root }).offenders.join('\n')
    assert.match(offenders, /lacks a production content hash/)
    assert.match(offenders, /references a source map/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
