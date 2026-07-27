import assert from 'node:assert/strict'
import { test } from 'node:test'

import { findRepositoryViolations } from './check-repo-safety.mjs'

function userArchiveOffenders(files) {
  return (
    findRepositoryViolations(files).find(
      ({ rule }) => rule.name === 'User archive',
    )?.files ?? []
  )
}

test('repository safety covers both authoritative archive representations', () => {
  assert.deepEqual(
    userArchiveOffenders([
      'evidence/Archive.lifearchive',
      'evidence/Archive.lifearchive.tar',
      'evidence/ARCHIVE.LIFEARCHIVE.TAR',
    ]),
    [
      'evidence/Archive.lifearchive',
      'evidence/Archive.lifearchive.tar',
      'evidence/ARCHIVE.LIFEARCHIVE.TAR',
    ],
  )
})

test('repository safety does not reject unrelated tar files', () => {
  assert.deepEqual(
    userArchiveOffenders([
      'fixtures/example.tar',
      'fixtures/example.tar.gz',
      'docs/lifearchive-target.md',
    ]),
    [],
  )
})
