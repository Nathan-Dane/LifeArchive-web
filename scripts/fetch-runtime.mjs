#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import {
  mkdtemp,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const DEFAULT_ROOT = path.resolve(import.meta.dirname, '..')
const SHA256 = /^[0-9a-f]{64}$/
const SEMVER =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$/
const EXACT_VERSION = /^(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*)){0,2}$/
const MAX_ARTIFACT_BYTES = 128 * 1024 * 1024

function fail(message) {
  throw new Error(`runtime fetch: ${message}`)
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function parseLock(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    input.manifestVersion !== 1
  ) {
    fail('runtime.lock.json has an unsupported shape')
  }

  if (input.status === 'not-integrated') {
    const nullable = [
      'runtimeVersion',
      'artifactUrl',
      'sha256',
      'productContract',
      'bindingsAbi',
    ]
    if (nullable.some((field) => input[field] !== null)) {
      fail('a not-integrated lock must not pin runtime metadata')
    }
    return input
  }

  if (
    input.status !== 'pinned' ||
    !SEMVER.test(input.runtimeVersion) ||
    !SHA256.test(input.sha256) ||
    !EXACT_VERSION.test(input.productContract) ||
    !EXACT_VERSION.test(input.bindingsAbi)
  ) {
    fail('runtime.lock.json does not contain an exact pin')
  }

  let url
  try {
    url = new URL(input.artifactUrl)
  } catch {
    fail('artifactUrl is not a URL')
  }
  const expectedName = `lifearchive-runtime-web-${input.runtimeVersion}.tar.gz`
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    path.posix.basename(url.pathname) !== expectedName ||
    /(^|[./_-])(latest|main|master)([./_-]|$)/i.test(url.pathname)
  ) {
    fail('artifactUrl is not an immutable HTTPS URL for the pinned version')
  }
  return input
}

function expectedEntries(version) {
  const root = `lifearchive-runtime-web-${version}`
  return [
    `${root}/`,
    `${root}/LICENSE-RUNTIME.txt`,
    `${root}/NOTICES.md`,
    `${root}/lifearchive_runtime.d.ts`,
    `${root}/lifearchive_runtime.js`,
    `${root}/lifearchive_runtime_bg.wasm`,
    `${root}/runtime-manifest.json`,
  ]
}

async function validateExtractedBundle(bundleRoot, lock) {
  const manifest = JSON.parse(
    await readFile(path.join(bundleRoot, 'runtime-manifest.json'), 'utf8'),
  )
  if (
    manifest.manifestVersion !== lock.manifestVersion ||
    manifest.runtimeVersion !== lock.runtimeVersion ||
    manifest.productContract !== lock.productContract ||
    manifest.bindingsAbi !== lock.bindingsAbi
  ) {
    fail('runtime manifest does not match the reviewed lock')
  }
  if (!Array.isArray(manifest.files) || manifest.files.length !== 5) {
    fail('runtime manifest file inventory is invalid')
  }

  const allowed = new Set(
    expectedEntries(lock.runtimeVersion)
      .slice(1)
      .map((entry) => path.posix.basename(entry))
      .filter((entry) => entry !== 'runtime-manifest.json'),
  )
  const seen = new Set()
  for (const file of manifest.files) {
    if (
      !file ||
      typeof file.path !== 'string' ||
      !allowed.has(file.path) ||
      seen.has(file.path) ||
      !SHA256.test(file.sha256)
    ) {
      fail('runtime manifest file inventory is invalid')
    }
    const bytes = await readFile(path.join(bundleRoot, file.path))
    if (digest(bytes) !== file.sha256) {
      fail(`payload checksum mismatch for ${file.path}`)
    }
    seen.add(file.path)
  }
  if (seen.size !== allowed.size) {
    fail('runtime manifest file inventory is incomplete')
  }
}

async function downloadReviewedUrl(url, fetchImpl) {
  const response = await fetchImpl(url, {
    method: 'GET',
    redirect: 'manual',
    headers: { Accept: 'application/gzip' },
  })
  if (response.status !== 200) {
    fail(`reviewed artifact URL returned HTTP ${response.status}`)
  }
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ARTIFACT_BYTES) {
    fail('artifact exceeds the download size limit')
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) {
    fail('artifact exceeds the download size limit')
  }
  return bytes
}

function writeCiOutput(available, outputPath) {
  if (!outputPath) return Promise.resolve()
  return writeFile(outputPath, `available=${available ? 'true' : 'false'}\n`, {
    flag: 'a',
  })
}

export async function fetchRuntime({
  root = DEFAULT_ROOT,
  fetchImpl = fetch,
  ciOutput = process.env.GITHUB_OUTPUT,
} = {}) {
  const runtimeRoot = path.join(root, 'runtime')
  const lock = parseLock(
    JSON.parse(
      await readFile(path.join(runtimeRoot, 'runtime.lock.json'), 'utf8'),
    ),
  )
  if (lock.status === 'not-integrated') {
    await writeCiOutput(false, ciOutput)
    console.log(
      'runtime fetch: no runtime is pinned; verified runtime-less path',
    )
    return { available: false }
  }

  await mkdir(runtimeRoot, { recursive: true })
  const installed = path.join(runtimeRoot, 'installed')
  await rm(installed, { recursive: true, force: true })
  const temporaryRoot = await mkdtemp(
    path.join(runtimeRoot, '.runtime-download-'),
  )
  try {
    const bytes = await downloadReviewedUrl(lock.artifactUrl, fetchImpl)
    if (digest(bytes) !== lock.sha256) {
      fail('whole-artifact checksum mismatch')
    }

    const artifact = path.join(
      temporaryRoot,
      path.basename(new URL(lock.artifactUrl).pathname),
    )
    await writeFile(artifact, bytes)
    const { stdout } = await execFileAsync('tar', ['-tzf', artifact], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    })
    const entries = stdout.trimEnd().split('\n')
    if (
      entries.length !== expectedEntries(lock.runtimeVersion).length ||
      entries.some(
        (entry, index) => entry !== expectedEntries(lock.runtimeVersion)[index],
      )
    ) {
      fail('runtime archive content allowlist changed')
    }

    await execFileAsync('tar', ['-xzf', artifact, '-C', temporaryRoot])
    const bundleName = `lifearchive-runtime-web-${lock.runtimeVersion}`
    const bundleRoot = path.join(temporaryRoot, bundleName)
    await validateExtractedBundle(bundleRoot, lock)

    await rename(bundleRoot, installed)
    await writeCiOutput(true, ciOutput)
    console.log(`runtime fetch: verified and installed ${bundleName}`)
    return { available: true, installed }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  fetchRuntime().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
