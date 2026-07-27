import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { test } from 'node:test'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'

import { fetchRuntime } from './fetch-runtime.mjs'

const execFileAsync = promisify(execFile)

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function fixture(root) {
  const version = '0.1.0'
  const bundleName = `lifearchive-runtime-web-${version}`
  const bundle = path.join(root, bundleName)
  await mkdir(bundle)
  const payloads = {
    'LICENSE-RUNTIME.txt': 'runtime licence\n',
    'NOTICES.md': 'runtime notices\n',
    'lifearchive_runtime.d.ts': 'export default function runtime(): void\n',
    'lifearchive_runtime.js': 'export default function runtime() {}\n',
    'lifearchive_runtime_bg.wasm': Buffer.from([0, 97, 115, 109]),
  }
  for (const [name, bytes] of Object.entries(payloads)) {
    await writeFile(path.join(bundle, name), bytes)
  }
  const files = await Promise.all(
    Object.keys(payloads).map(async (file) => ({
      path: file,
      sha256: sha256(await readFile(path.join(bundle, file))),
    })),
  )
  await writeFile(
    path.join(bundle, 'runtime-manifest.json'),
    `${JSON.stringify(
      {
        manifestVersion: 1,
        runtimeVersion: version,
        productContract: '5',
        bindingsAbi: '1',
        files,
      },
      null,
      2,
    )}\n`,
  )
  const artifact = path.join(root, `${bundleName}.tar.gz`)
  await execFileAsync('tar', [
    '-czf',
    artifact,
    '--no-recursion',
    '-C',
    root,
    bundleName,
    `${bundleName}/LICENSE-RUNTIME.txt`,
    `${bundleName}/NOTICES.md`,
    `${bundleName}/lifearchive_runtime.d.ts`,
    `${bundleName}/lifearchive_runtime.js`,
    `${bundleName}/lifearchive_runtime_bg.wasm`,
    `${bundleName}/runtime-manifest.json`,
  ])
  return { artifact, version }
}

async function withServer(handler, run) {
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
}

async function writeLock(root, lock) {
  await mkdir(path.join(root, 'runtime'), { recursive: true })
  await writeFile(
    path.join(root, 'runtime/runtime.lock.json'),
    `${JSON.stringify(lock, null, 2)}\n`,
  )
}

test('runtime-less checkout succeeds without making a request', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'runtime-fetch-none-'))
  try {
    await writeLock(root, {
      manifestVersion: 1,
      runtimeVersion: null,
      artifactUrl: null,
      sha256: null,
      productContract: null,
      bindingsAbi: null,
      status: 'not-integrated',
    })
    const result = await fetchRuntime({
      root,
      ciOutput: undefined,
      fetchImpl: () => {
        throw new Error('network must not be used')
      },
    })
    assert.deepEqual(result, { available: false })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('checksum mismatch leaves no installed runtime', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'runtime-fetch-mismatch-'))
  try {
    const { artifact, version } = await fixture(root)
    const bytes = await readFile(artifact)
    await mkdir(path.join(root, 'runtime/installed'), { recursive: true })
    await writeFile(path.join(root, 'runtime/installed/stale'), 'stale')
    await writeLock(root, {
      manifestVersion: 1,
      runtimeVersion: version,
      artifactUrl: `https://releases.example/lifearchive-runtime-web-${version}.tar.gz`,
      sha256: '0'.repeat(64),
      productContract: '5',
      bindingsAbi: '1',
      status: 'pinned',
    })
    await assert.rejects(
      fetchRuntime({
        root,
        ciOutput: undefined,
        fetchImpl: async () => new Response(bytes, { status: 200 }),
      }),
      /whole-artifact checksum mismatch/,
    )
    await assert.rejects(
      readFile(path.join(root, 'runtime/installed/runtime-manifest.json')),
    )
    await assert.rejects(readFile(path.join(root, 'runtime/installed/stale')))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('an exact pin installs only after archive and manifest verification', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'runtime-fetch-success-'))
  try {
    const { artifact, version } = await fixture(root)
    const bytes = await readFile(artifact)
    await writeLock(root, {
      manifestVersion: 1,
      runtimeVersion: version,
      artifactUrl: `https://releases.example/lifearchive-runtime-web-${version}.tar.gz`,
      sha256: sha256(bytes),
      productContract: '5',
      bindingsAbi: '1',
      status: 'pinned',
    })
    const result = await fetchRuntime({
      root,
      ciOutput: undefined,
      fetchImpl: async () => new Response(bytes, { status: 200 }),
    })
    assert.equal(result.available, true)
    assert.equal(
      await readFile(
        path.join(root, 'runtime/installed/lifearchive_runtime.js'),
        'utf8',
      ),
      'export default function runtime() {}\n',
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a manifest identity mismatch leaves no installed runtime', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'runtime-fetch-identity-'))
  try {
    const { artifact, version } = await fixture(root)
    const bytes = await readFile(artifact)
    await writeLock(root, {
      manifestVersion: 1,
      runtimeVersion: version,
      artifactUrl: `https://releases.example/lifearchive-runtime-web-${version}.tar.gz`,
      sha256: sha256(bytes),
      productContract: '6',
      bindingsAbi: '1',
      status: 'pinned',
    })
    await assert.rejects(
      fetchRuntime({
        root,
        ciOutput: undefined,
        fetchImpl: async () => new Response(bytes, { status: 200 }),
      }),
      /manifest does not match the reviewed lock/,
    )
    await assert.rejects(
      readFile(path.join(root, 'runtime/installed/runtime-manifest.json')),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('redirects cannot change the reviewed artifact URL', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'runtime-fetch-redirect-'))
  let redirectedTargetWasRead = false
  try {
    const { artifact, version } = await fixture(root)
    const bytes = await readFile(artifact)
    await withServer(
      (request, response) => {
        if (request.url === '/other') {
          redirectedTargetWasRead = true
          response.end(bytes)
          return
        }
        response.writeHead(302, { Location: '/other' })
        response.end()
      },
      async (origin) => {
        await writeLock(root, {
          manifestVersion: 1,
          runtimeVersion: version,
          artifactUrl: `https://releases.example/lifearchive-runtime-web-${version}.tar.gz`,
          sha256: sha256(bytes),
          productContract: '5',
          bindingsAbi: '1',
          status: 'pinned',
        })
        const reviewedUrl = `${origin}/lifearchive-runtime-web-${version}.tar.gz`
        await assert.rejects(
          fetchRuntime({
            root,
            ciOutput: undefined,
            fetchImpl: (_url, options) => fetch(reviewedUrl, options),
          }),
          /returned HTTP 302/,
        )
      },
    )
    assert.equal(redirectedTargetWasRead, false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
