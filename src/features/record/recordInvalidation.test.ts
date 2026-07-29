import { describe, expect, it } from 'vitest'
import { revision } from '../../core/client'
import { newestRecordInvalidation } from './recordInvalidation'

describe('newestRecordInvalidation', () => {
  it('keeps the numerically newest revision without narrowing u64 text', () => {
    const current = {
      storeInstanceId: 'same-store',
      revision: revision('9999999999999999999'),
    }
    const candidate = {
      storeInstanceId: 'same-store',
      revision: revision('10000000000000000000'),
    }

    expect(newestRecordInvalidation(current, candidate)).toBe(candidate)
    expect(newestRecordInvalidation(candidate, current)).toBe(candidate)
  })

  it('adopts a candidate from a replacement store instance', () => {
    const candidate = {
      storeInstanceId: 'replacement-store',
      revision: revision('1'),
    }

    expect(
      newestRecordInvalidation(
        {
          storeInstanceId: 'old-store',
          revision: revision('20'),
        },
        candidate,
      ),
    ).toBe(candidate)
  })
})
