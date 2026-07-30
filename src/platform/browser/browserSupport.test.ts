import { describe, expect, it } from 'vitest'
import {
  WEB_V0_1_BROWSER_SUPPORT,
  admitBrowser,
  classifyBrowser,
  type BrowserAdmissionEnvironment,
} from './browserSupport'

const accepted: BrowserAdmissionEnvironment = {
  engine: 'chromium',
  majorVersion: 137,
  deviceClass: 'desktop',
  storageMode: 'regular',
}

describe('v0.1 browser support admission', () => {
  it.each([
    ['chromium', 137],
    ['chromium', 150],
    ['firefox', 153],
    ['firefox', 154],
  ] as const)(
    'accepts qualified desktop %s %i regular storage',
    (engine, majorVersion) => {
      expect(admitBrowser({ ...accepted, engine, majorVersion })).toEqual({
        admitted: true,
      })
    },
  )

  it('does not mistake an unavailable private-mode signal for private storage', () => {
    expect(admitBrowser({ ...accepted, storageMode: 'unclassified' })).toEqual({
      admitted: true,
    })
  })

  it.each([
    [{ ...accepted, engine: 'chromium', majorVersion: 136 }, 'version-too-old'],
    [{ ...accepted, engine: 'firefox', majorVersion: 152 }, 'version-too-old'],
    [{ ...accepted, engine: 'webkit', majorVersion: 26 }, 'engine-unsupported'],
    [
      { ...accepted, engine: 'unknown', majorVersion: null },
      'engine-unsupported',
    ],
    [{ ...accepted, majorVersion: null }, 'version-unavailable'],
    [{ ...accepted, deviceClass: 'mobile' }, 'device-unsupported'],
    [{ ...accepted, deviceClass: 'embedded' }, 'device-unsupported'],
    [{ ...accepted, storageMode: 'private' }, 'storage-private'],
  ] as const)(
    'rejects unsupported environment combinations with a safe reason',
    (environment, reason) => {
      expect(admitBrowser(environment)).toEqual({ admitted: false, reason })
    },
  )

  it('keeps the accepted minimum versions in one exported authority', () => {
    expect(WEB_V0_1_BROWSER_SUPPORT).toEqual({
      engines: {
        chromium: { minimumMajorVersion: 137 },
        firefox: { minimumMajorVersion: 153 },
      },
      deviceClass: 'desktop',
      storageMode: 'regular',
    })
  })
})

describe('browser fact classification', () => {
  it.each([
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      { engine: 'chromium', majorVersion: 137, deviceClass: 'desktop' },
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:153.0) Gecko/20100101 Firefox/153.0',
      { engine: 'firefox', majorVersion: 153, deviceClass: 'desktop' },
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.5 Safari/605.1.15',
      { engine: 'webkit', majorVersion: null, deviceClass: 'desktop' },
    ],
    [
      'Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36',
      { engine: 'chromium', majorVersion: 151, deviceClass: 'mobile' },
    ],
    [
      'Mozilla/5.0 AppleWebKit/537.36 Chrome/151.0.0.0 Electron/40.0.0 Safari/537.36',
      { engine: 'chromium', majorVersion: 151, deviceClass: 'embedded' },
    ],
    [
      'Mozilla/5.0 AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0',
      { engine: 'chromium', majorVersion: 151, deviceClass: 'embedded' },
    ],
    [
      'Mozilla/5.0 AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36 OPR/117.0.0.0',
      { engine: 'chromium', majorVersion: 151, deviceClass: 'embedded' },
    ],
  ] as const)(
    'classifies engine facts without claiming a storage mode',
    (userAgent, expected) => {
      expect(classifyBrowser({ userAgent })).toEqual({
        ...expected,
        storageMode: 'unclassified',
      })
    },
  )
})
