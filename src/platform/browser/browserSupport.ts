/**
 * The complete public v0.1 browser-admission authority.
 *
 * Capability probes remain necessary, but are not release qualification.
 * Changing an engine, minimum version, device class, or storage mode here
 * requires new persistence-gate evidence.
 */
export const WEB_V0_1_BROWSER_SUPPORT = {
  engines: {
    chromium: { minimumMajorVersion: 151 },
    firefox: { minimumMajorVersion: 153 },
  },
  deviceClass: 'desktop',
  storageMode: 'regular',
} as const

export type BrowserEngine = 'chromium' | 'firefox' | 'webkit' | 'unknown'
export type BrowserDeviceClass = 'desktop' | 'mobile' | 'embedded' | 'unknown'
export type BrowserStorageMode = 'regular' | 'private' | 'unclassified'

export interface BrowserAdmissionEnvironment {
  readonly engine: BrowserEngine
  readonly majorVersion: number | null
  readonly deviceClass: BrowserDeviceClass
  readonly storageMode: BrowserStorageMode
}

export type BrowserAdmissionFailureReason =
  | 'engine-unsupported'
  | 'version-unavailable'
  | 'version-too-old'
  | 'device-unsupported'
  | 'storage-private'

export type BrowserAdmissionDecision =
  | { readonly admitted: true }
  | {
      readonly admitted: false
      /**
       * Safe for user-facing diagnostic selection. It contains no user agent,
       * platform path, origin, archive identifier, or archive content.
       */
      readonly reason: BrowserAdmissionFailureReason
    }

export function admitBrowser(
  environment: BrowserAdmissionEnvironment,
): BrowserAdmissionDecision {
  if (environment.engine !== 'chromium' && environment.engine !== 'firefox') {
    return { admitted: false, reason: 'engine-unsupported' }
  }
  if (environment.deviceClass !== WEB_V0_1_BROWSER_SUPPORT.deviceClass) {
    return { admitted: false, reason: 'device-unsupported' }
  }
  if (environment.storageMode === 'private') {
    return { admitted: false, reason: 'storage-private' }
  }
  /*
   * `unclassified` is absence of a browser fact, not evidence of private
   * storage. Browsers expose no reliable standards-based private/incognito
   * signal, so rejecting this value would reject every normal browser too.
   * An explicitly identified private context still fails above; persistence
   * grant and durability remain separate runtime/platform facts.
   */
  if (environment.majorVersion === null) {
    return { admitted: false, reason: 'version-unavailable' }
  }
  const minimum =
    WEB_V0_1_BROWSER_SUPPORT.engines[environment.engine].minimumMajorVersion
  if (environment.majorVersion < minimum) {
    return { admitted: false, reason: 'version-too-old' }
  }
  return { admitted: true }
}

/**
 * Classifies only facts exposed by the browser. Private/incognito state has no
 * reliable standards-based signal, so it deliberately remains unclassified.
 * Admission treats that as unknown rather than private; actual persistence
 * grant and runtime durability are reported independently.
 */
export function classifyBrowser(
  navigatorValue: Pick<Navigator, 'userAgent'> | undefined,
): BrowserAdmissionEnvironment {
  const userAgent = navigatorValue?.userAgent ?? ''
  const embedded =
    /\b(?:Electron|EdgA?|EdgiOS|FBAN|FBAV|Instagram|Line|SamsungBrowser|OPR|Vivaldi)\b/i.test(
      userAgent,
    ) || /;\s*wv\)/i.test(userAgent)
  const mobile = /\b(?:Android|Mobile|iPhone|iPad|iPod|Windows Phone)\b/i.test(
    userAgent,
  )

  const firefox = /\bFirefox\/(\d+)(?:[.\s]|$)/i.exec(userAgent)
  const chromium = /\b(?:Chromium|Chrome)\/(\d+)(?:[.\s]|$)/i.exec(userAgent)
  const webkit = /\bAppleWebKit\//i.test(userAgent) && !chromium && !firefox

  return {
    engine: firefox
      ? 'firefox'
      : chromium
        ? 'chromium'
        : webkit
          ? 'webkit'
          : 'unknown',
    majorVersion: parseMajorVersion(firefox?.[1] ?? chromium?.[1]),
    deviceClass: embedded
      ? 'embedded'
      : mobile
        ? 'mobile'
        : userAgent
          ? 'desktop'
          : 'unknown',
    storageMode: 'unclassified',
  }
}

function parseMajorVersion(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const version = Number(value)
  return Number.isSafeInteger(version) ? version : null
}
