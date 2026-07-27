/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The explicit development client selection. Only `development-mock` selects
   * the non-durable development client, and only in a development build.
   */
  readonly VITE_LIFEARCHIVE_CLIENT?: string
}
