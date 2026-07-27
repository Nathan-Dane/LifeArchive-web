/**
 * The build-mode selector.
 *
 * This is the only place that may reach the development mock, and it reaches it
 * through a dynamic import inside a branch that a production build proves
 * false. Nothing else in the tree imports `MockLifeArchiveClient` statically,
 * so a production bundle contains no mock module to instantiate.
 *
 * Selection is explicit in both directions:
 *
 * - a development build uses the runtime unless `VITE_LIFEARCHIVE_CLIENT` is
 *   exactly `development-mock`;
 * - a production build uses the runtime unconditionally, and an absent or
 *   incompatible runtime stays an explicit unavailable state.
 *
 * There is no fallback edge. The mock is never what happens when something
 * else fails.
 */

import type { LifeArchiveClient } from '../client'
import {
  currentBuildMode,
  isDevelopmentMockSelected,
  type BuildMode,
} from './developmentOnly'

export type ClientSelection =
  | { readonly mode: 'runtime' }
  | {
      readonly mode: 'development-mock'
      readonly client: LifeArchiveClient
      /** True for every mock selection: the shell must show the banner. */
      readonly requiresDevelopmentBanner: true
    }

/**
 * Chooses which client the application should use.
 *
 * `runtime` means "load the pinned runtime", not "a client is available": the
 * runtime loader still decides whether it is, and reports why when it is not.
 */
export async function selectClient(
  mode: BuildMode = currentBuildMode(),
): Promise<ClientSelection> {
  if (import.meta.env.PROD) {
    /* Statically true in a production build, so everything below it is dead
       code and the dynamic import is never emitted. */
    return { mode: 'runtime' }
  }
  if (!isDevelopmentMockSelected(mode)) {
    return { mode: 'runtime' }
  }
  const { MockLifeArchiveClient } = await import('./MockLifeArchiveClient')
  return {
    mode: 'development-mock',
    client: new MockLifeArchiveClient({ buildMode: mode }),
    requiresDevelopmentBanner: true,
  }
}
