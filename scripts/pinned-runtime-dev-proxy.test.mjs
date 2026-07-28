import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { pinnedRuntimeDevProxy } from './pinned-runtime-dev-proxy.mjs'

const root = path.resolve(import.meta.dirname, '..')

test('development proxies only the exact versioned path from the runtime pin', async () => {
  const lock = JSON.parse(
    await readFile(path.join(root, 'runtime/runtime.lock.json'), 'utf8'),
  )
  const artifact = new URL(lock.artifactUrl)

  assert.deepEqual(pinnedRuntimeDevProxy(lock), {
    [artifact.pathname]: {
      target: artifact.origin,
      changeOrigin: true,
      secure: true,
    },
  })
})

test('development opens no proxy when a runtime is not integrated', () => {
  assert.deepEqual(
    pinnedRuntimeDevProxy({
      status: 'not-integrated',
      artifactUrl: null,
    }),
    {},
  )
})

test('development rejects an unsafe pinned artifact URL', () => {
  assert.throws(
    () =>
      pinnedRuntimeDevProxy({
        status: 'pinned',
        artifactUrl: 'http://example.test/runtime.tar.gz',
      }),
    /not proxy-safe/,
  )
})
