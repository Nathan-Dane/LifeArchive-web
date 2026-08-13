import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { inspectSourceArchitecture } from './check-source-architecture.mjs'

async function fixture(files) {
  const root = await mkdtemp(path.join(tmpdir(), 'source-architecture-'))
  await writeFile(
    path.join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'esnext',
        moduleResolution: 'bundler',
        target: 'es2023',
      },
      include: ['src'],
    }),
  )
  for (const [relative, contents] of Object.entries(files)) {
    const absolute = path.join(root, relative)
    await mkdir(path.dirname(absolute), { recursive: true })
    await writeFile(absolute, contents)
  }
  return root
}

async function inspect(files) {
  const root = await fixture(files)
  return {
    root,
    result: inspectSourceArchitecture({
      root,
      configPath: path.join(root, 'tsconfig.json'),
    }),
  }
}

test('accepts an acyclic client, platform, and feature dependency direction', async () => {
  const { root, result } = await inspect({
    'src/core/client/types.ts': 'export interface Value { id: string }\n',
    'src/platform/files/read.ts':
      "import type { Value } from '../../core/client/types'\nexport const read = (value: Value) => value\n",
    'src/features/record/view.ts':
      "import { read } from '../../platform/files/read'\nexport const value = read({ id: '1' })\n",
  })
  try {
    assert.deepEqual(result.violations, [])
    assert.equal(result.files.length, 3)
    assert.equal(result.edgeCount, 2)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('detects cycles through re-exports, type imports, and lazy imports', async () => {
  const { root, result } = await inspect({
    'src/features/record/a.ts':
      "export type { B } from './b'\nexport const load = () => import('./c')\n",
    'src/features/record/b.ts':
      "import type { C } from './c'\nexport type B = C\n",
    'src/features/record/c.ts':
      "import type { B } from './a'\nexport type C = B\n",
  })
  try {
    assert.match(result.violations.join('\n'), /import cycle:/)
    assert.match(result.violations.join('\n'), /src\/features\/record\/a\.ts/)
    assert.match(result.violations.join('\n'), /src\/features\/record\/c\.ts/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects durable-boundary and foundational-layer inversions', async () => {
  const { root, result } = await inspect({
    'src/core/client/types.ts': 'export const value = 1\n',
    'src/core/runtime/worker.ts': 'export const worker = 1\n',
    'src/features/record/view.ts':
      "import { worker } from '../../core/runtime/worker'\nexport { worker }\n",
    'src/platform/files/read.ts':
      "import { worker } from '../../features/record/view'\nexport { worker }\n",
  })
  try {
    const violations = result.violations.join('\n')
    assert.match(
      violations,
      /features reach durable state only through core\/client/,
    )
    assert.match(
      violations,
      /platform adapters must remain below application and presentation layers/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('ignores tests but rejects production imports of excluded fixtures', async () => {
  const { root, result } = await inspect({
    'src/core/client/types.ts': 'export const value = 1\n',
    'src/core/client/types.test.ts':
      "import { value } from '../../features/record/view'\nexport { value }\n",
    'src/features/record/fixtures/value.ts': 'export const fixture = 1\n',
    'src/features/record/view.ts':
      "import { fixture } from './fixtures/value'\nexport { fixture }\n",
  })
  try {
    assert.equal(result.files.includes('src/core/client/types.test.ts'), false)
    assert.match(
      result.violations.join('\n'),
      /imports excluded test\/fixture source/,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
