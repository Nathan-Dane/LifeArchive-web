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
 * - a development build accepts exactly the absent hosted selection,
 *   `development-mock`, or `local-runtime`;
 * - a production build uses the tracked hosted runtime unconditionally,
 *   regardless of environment input.
 *
 * There is no fallback edge. The mock is never what happens when something
 * else fails.
 */

import type { LifeArchiveClient } from '../client'
import {
  currentBuildMode,
  isDevelopmentMockSelected,
  isLocalRuntimeSelected,
  type BuildMode,
} from './developmentOnly'

export type ClientSelection =
  | {
      readonly mode: 'runtime'
      readonly source: 'hosted' | 'local-runtime'
    }
  | {
      readonly mode: 'development-mock'
      readonly client: LifeArchiveClient
      /** True for every mock selection: the shell must show the banner. */
      readonly requiresDevelopmentBanner: true
    }

export class InvalidDevelopmentClientSelectionError extends Error {
  constructor(selection: string) {
    super(
      `Unrecognized VITE_LIFEARCHIVE_CLIENT value: ${JSON.stringify(selection)}`,
    )
    this.name = 'InvalidDevelopmentClientSelectionError'
  }
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
    return { mode: 'runtime', source: 'hosted' }
  }
  if (!mode.DEV || mode.PROD) {
    return { mode: 'runtime', source: 'hosted' }
  }
  if (mode.clientSelection === null) {
    return { mode: 'runtime', source: 'hosted' }
  }
  if (isLocalRuntimeSelected(mode)) {
    return { mode: 'runtime', source: 'local-runtime' }
  }
  if (!isDevelopmentMockSelected(mode)) {
    throw new InvalidDevelopmentClientSelectionError(mode.clientSelection)
  }
  const { MockLifeArchiveClient } = await import('./MockLifeArchiveClient')
  return {
    mode: 'development-mock',
    client: new MockLifeArchiveClient({ buildMode: mode }),
    requiresDevelopmentBanner: true,
  }
}
