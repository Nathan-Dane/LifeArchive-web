import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'

const root = path.resolve(import.meta.dirname, '..')

test('public CI is safe for fork pull requests', async () => {
  const workflow = await readFile(
    path.join(root, '.github/workflows/ci.yml'),
    'utf8',
  )
  assert.match(workflow, /^\s*pull_request:\s*$/m)
  assert.match(workflow, /permissions:\n[ ]{2}contents: read\n/)
  assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./)
  assert.doesNotMatch(
    workflow,
    /LifeArchive\.git|api\.github\.com.*LifeArchive/,
  )
  assert.match(workflow, /pnpm runtime:fetch/)
})

test('CI uses the same authoritative check command documented for local use', async () => {
  const [workflow, packageText, readme, agents] = await Promise.all([
    readFile(path.join(root, '.github/workflows/ci.yml'), 'utf8'),
    readFile(path.join(root, 'package.json'), 'utf8'),
    readFile(path.join(root, 'README.md'), 'utf8'),
    readFile(path.join(root, 'AGENTS.md'), 'utf8'),
  ])
  const packageMetadata = JSON.parse(packageText)

  assert.match(workflow, /run: pnpm check/)
  assert.match(readme, /`pnpm check` is the authoritative local and CI/)
  assert.match(agents, /pnpm check/)
  assert.match(packageMetadata.scripts.check, /pnpm test:policy/)
  assert.match(packageMetadata.scripts.check, /pnpm safety:production/)
})
