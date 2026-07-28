import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { installLocalRuntime } from './install-local-runtime.mjs'

const execFileAsync = promisify(execFile)
const repositoryRoot = path.resolve(import.meta.dirname, '..')

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function fixture(root, change = {}) {
  const policy = JSON.parse(
    await readFile(
      path.join(repositoryRoot, 'runtime/web-runtime-policy.json'),
      'utf8',
    ),
  )
  const publicRoot = path.join(root, 'public')
  await mkdir(path.join(publicRoot, 'runtime'), { recursive: true })
  await writeFile(
    path.join(publicRoot, 'runtime/web-runtime-policy.json'),
    `${JSON.stringify(policy, null, 2)}\n`,
  )
  const trackedLock = '{"tracked":"production pin stays unchanged"}\n'
  await writeFile(
    path.join(publicRoot, 'runtime/runtime.lock.json'),
    trackedLock,
  )

  const version = '0.1.0-local.1'
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
  const manifest = {
    manifestVersion: policy.manifestVersion,
    runtimeVersion: version,
    productContract: policy.productContract,
    bindingsAbi: policy.bindingsAbi,
    capabilities: policy.capabilities,
    files,
    ...change,
  }
  await writeFile(
    path.join(bundle, 'runtime-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  const artifact = path.join(root, `${bundleName}.tar.gz`)
  await execFileAsync('tar', [
    '-czf',
    artifact,
    '--no-recursion',
    '-C',
    root,
    bundleName,
    ...[
      'LICENSE-RUNTIME.txt',
      'NOTICES.md',
      'lifearchive_runtime.d.ts',
      'lifearchive_runtime.js',
      'lifearchive_runtime_bg.wasm',
      'runtime-manifest.json',
    ].map((name) => `${bundleName}/${name}`),
  ])
  const digest = sha256(await readFile(artifact))
  const sidecar = `${artifact}.sha256`
  await writeFile(sidecar, `${digest}  ${path.basename(artifact)}\n`)
  return { artifact, digest, publicRoot, sidecar, trackedLock }
}

test('installs verified local bytes and a checksum-qualified receipt without editing the production lock', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'local-runtime-install-'))
  try {
    const fixed = await fixture(root)
    await installLocalRuntime({
      artifactInput: fixed.artifact,
      sidecarInput: fixed.sidecar,
      root: fixed.publicRoot,
    })

    assert.equal(
      await readFile(
        path.join(fixed.publicRoot, 'runtime/runtime.lock.json'),
        'utf8',
      ),
      fixed.trackedLock,
    )
    const receipt = JSON.parse(
      await readFile(
        path.join(fixed.publicRoot, 'runtime/installed/local-runtime.json'),
        'utf8',
      ),
    )
    assert.equal(receipt.receiptVersion, 1)
    assert.equal(receipt.source, 'lifearchive:local-runtime-source:v1')
    assert.equal(receipt.lock.sha256, fixed.digest)
    assert.equal(receipt.lock.status, 'pinned')
    assert.equal(receipt.artifactFile, path.basename(fixed.artifact))
    await access(
      path.join(
        fixed.publicRoot,
        'runtime/installed',
        path.basename(fixed.artifact),
      ),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects sidecar and capability mismatches before replacing installed material', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'local-runtime-reject-'))
  try {
    const fixed = await fixture(root, { capabilities: [] })
    const installed = path.join(fixed.publicRoot, 'runtime/installed')
    await mkdir(installed, { recursive: true })
    await writeFile(path.join(installed, 'preserved'), 'existing\n')

    await assert.rejects(
      installLocalRuntime({
        artifactInput: fixed.artifact,
        sidecarInput: fixed.sidecar,
        root: fixed.publicRoot,
      }),
      /capability inventory is incompatible/,
    )
    assert.equal(
      await readFile(path.join(installed, 'preserved'), 'utf8'),
      'existing\n',
    )

    await writeFile(fixed.sidecar, `${'0'.repeat(64)}  wrong.tar.gz\n`)
    await assert.rejects(
      installLocalRuntime({
        artifactInput: fixed.artifact,
        sidecarInput: fixed.sidecar,
        root: fixed.publicRoot,
      }),
      /checksum sidecar does not match/,
    )
    assert.equal(
      await readFile(path.join(installed, 'preserved'), 'utf8'),
      'existing\n',
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects product contract and bindings ABI mismatches', async () => {
  for (const change of [{ productContract: '999' }, { bindingsAbi: '999' }]) {
    const root = await mkdtemp(path.join(tmpdir(), 'local-runtime-policy-'))
    try {
      const fixed = await fixture(root, change)
      await assert.rejects(
        installLocalRuntime({
          artifactInput: fixed.artifact,
          sidecarInput: fixed.sidecar,
          root: fixed.publicRoot,
        }),
        change.productContract
          ? /product contract is incompatible/
          : /bindings ABI is incompatible/,
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }
})
