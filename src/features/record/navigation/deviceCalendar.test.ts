/**
 * The device facts are observations, and these tests hold them to that.
 *
 * The one date this module produces must be the reader's civil day in their
 * own zone — not the runtime's, not UTC's unless that is theirs — and it must
 * come out in canonical `YYYY-MM-DD` whatever calendar or digits the platform
 * locale would otherwise prefer.
 */

import { describe, expect, it } from 'vitest'
import { isCivilDate } from '../../../core/client'
import {
  civilDateOf,
  createDeviceCalendar,
  deviceCalendar,
  ISO_WEEK_RULES,
  resetDeviceCalendar,
} from './deviceCalendar'

const MIDNIGHT_UTC = new Date('2025-06-14T00:30:00Z')

describe('the civil day this device is on', () => {
  it('reads the day in the zone it is asked about', () => {
    expect(civilDateOf(MIDNIGHT_UTC, 'UTC')).toBe('2025-06-14')
    /* Half past midnight in UTC is still the previous evening further west. */
    expect(civilDateOf(MIDNIGHT_UTC, 'America/New_York')).toBe('2025-06-13')
    expect(civilDateOf(MIDNIGHT_UTC, 'Pacific/Auckland')).toBe('2025-06-14')
  })

  it('produces canonical text whatever the platform locale prefers', () => {
    const date = civilDateOf(MIDNIGHT_UTC, 'Asia/Kolkata')
    expect(isCivilDate(date)).toBe(true)
    expect(date).toBe('2025-06-14')
  })

  it('is read afresh, so a device that passes midnight is not stale', () => {
    let instant = new Date('2025-06-14T23:59:00Z')
    const device = createDeviceCalendar({
      timeZoneId: 'UTC',
      now: () => instant,
    })
    expect(device.today()).toBe('2025-06-14')
    instant = new Date('2025-06-15T00:01:00Z')
    expect(device.today()).toBe('2025-06-15')
  })
})

describe('the week conventions passed to the core', () => {
  it('uses one ISO identity policy for every archive reader', () => {
    expect(createDeviceCalendar().weekRules).toBe(ISO_WEEK_RULES)
    expect(ISO_WEEK_RULES).toEqual({
      firstWeekday: 2,
      minimumDaysInFirstWeek: 4,
    })
  })
})

describe('the shared device facts', () => {
  it('keep one identity, so a request is not repeated for a new object', () => {
    resetDeviceCalendar()
    const first = deviceCalendar()
    expect(deviceCalendar()).toBe(first)
    resetDeviceCalendar()
    expect(deviceCalendar()).not.toBe(first)
  })
})
