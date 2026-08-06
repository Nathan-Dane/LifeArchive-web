import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pinnedRuntimeDevProxy } from './pinned-runtime-dev-proxy.mjs'

test('development proxies only the exact versioned path from a runtime pin', () => {
  const lock = {
    status: 'pinned',
    artifactUrl:
      'https://lifearchive-runtime.pages.dev/releases/0.1.3/lifearchive-runtime-web-0.1.3.tar.gz',
  }
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
