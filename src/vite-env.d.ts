/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The explicit development client selection. Absence selects the tracked
   * hosted pin; `development-mock` and `local-runtime` are the only accepted
   * development values. Production always selects the hosted pin.
   */
  readonly VITE_LIFEARCHIVE_CLIENT?: string
}
