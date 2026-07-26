import type { LifeArchiveClient } from '../client'
import { selectClient } from '../mock/selectClient'
import { RuntimeLoader } from '../runtime/RuntimeLoader'
import type { RuntimeLoadState } from '../runtime/runtimeState'

export type AppBootstrapResult =
  | {
      readonly state: 'client'
      readonly client: LifeArchiveClient
      readonly developmentMock: boolean
    }
  | {
      readonly state: 'runtime'
      readonly runtime: RuntimeLoadState
    }

export type AppBootstrap = () => Promise<AppBootstrapResult>

export async function bootstrapAppClient(): Promise<AppBootstrapResult> {
  const selection = await selectClient()
  if (selection.mode === 'development-mock') {
    return {
      state: 'client',
      client: selection.client,
      developmentMock: true,
    }
  }
  return { state: 'runtime', runtime: await new RuntimeLoader().load() }
}
