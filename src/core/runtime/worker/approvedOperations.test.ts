import { describe, expect, it } from 'vitest'
import { WEB_V0_1_CAPABILITIES } from '../runtimeCompatibility'
import {
  approvedRuntimeOperations,
  isApprovedRuntimeOperation,
} from './approvedOperations'
import { WORKER_PROTOCOL_VERSION, isMainToWorkerMessage } from './protocol'

describe('runtime worker operation admission', () => {
  it('equals the reviewed Product browser capability inventory', () => {
    expect(approvedRuntimeOperations()).toEqual(
      WEB_V0_1_CAPABILITIES.map(([operation]) => operation),
    )
  })

  it('rejects operations outside that inventory before dispatch', () => {
    expect(isApprovedRuntimeOperation('person.create')).toBe(true)
    expect(isApprovedRuntimeOperation('person.rawQuery')).toBe(false)
    expect(
      isMainToWorkerMessage({
        type: 'request',
        protocolVersion: WORKER_PROTOCOL_VERSION,
        generation: 'generation-1',
        requestId: 'request-1',
        operation: 'person.rawQuery',
        payload: {},
      }),
    ).toBe(false)
  })
})
