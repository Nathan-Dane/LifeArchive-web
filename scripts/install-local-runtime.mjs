#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import {
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { fetchRuntime } from './fetch-runtime.mjs'

const execFileAsync = promisify(execFile)
const root = path.resolve(import.meta.dirname, '..')

function fail(message) {
  throw new Error(`local runtime install: ${message}`)
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function main() {
  const [artifactInput, sidecarInput] = process.argv.slice(2)
  if (!artifactInput || !sidecarInput) {
    fail(
      'usage: pnpm runtime:install-local <artifact.tar.gz> <artifact.tar.gz.sha256>',
    )
  }
  const artifact = path.resolve(artifactInput)
  const sidecar = path.resolve(sidecarInput)
  const bytes = await readFile(artifact)
  const digest = sha256(bytes)
  const sidecarText = await readFile(sidecar, 'utf8')
  const expectedSidecar = `${digest}  ${path.basename(artifact)}\n`
  if (sidecarText !== expectedSidecar) {
    fail('checksum sidecar does not match the selected artifact')
  }

  const { stdout } = await execFileAsync('tar', [
    '-xOf',
    artifact,
    `${path.basename(artifact).replace(/\.tar\.gz$/, '')}/runtime-manifest.json`,
  ])
  const manifest = JSON.parse(stdout)
  const lock = {
    manifestVersion: manifest.manifestVersion,
    runtimeVersion: manifest.runtimeVersion,
    artifactUrl: `https://local-runtime.invalid/${path.basename(artifact)}`,
    sha256: digest,
    productContract: manifest.productContract,
    bindingsAbi: manifest.bindingsAbi,
    status: 'pinned',
  }

  const temporaryRoot = await mkdtemp(
    path.join(tmpdir(), 'lifearchive-local-runtime-'),
  )
  try {
    await mkdir(path.join(temporaryRoot, 'runtime'), { recursive: true })
    await writeFile(
      path.join(temporaryRoot, 'runtime', 'runtime.lock.json'),
      `${JSON.stringify(lock, null, 2)}\n`,
    )
    const result = await fetchRuntime({
      root: temporaryRoot,
      ciOutput: null,
      fetchImpl: async (input) => {
        if (String(input) !== lock.artifactUrl) {
          return new Response(null, { status: 404 })
        }
        return new Response(bytes, {
          status: 200,
          headers: { 'Content-Length': String(bytes.byteLength) },
        })
      },
    })
    if (!result.available) fail('verified installer did not produce a runtime')

    const installed = path.join(root, 'runtime', 'installed')
    const staged = `${installed}.next`
    await rm(staged, { recursive: true, force: true })
    await rename(result.installed, staged)
    await copyFile(artifact, path.join(staged, path.basename(artifact)))
    await writeFile(
      path.join(staged, 'local-runtime.json'),
      `${JSON.stringify(
        { lock, artifactFile: path.basename(artifact) },
        null,
        2,
      )}\n`,
    )
    await rm(installed, { recursive: true, force: true })
    await rename(staged, installed)
    console.log(
      `local runtime install: verified and installed ${path.basename(artifact)}`,
    )
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
