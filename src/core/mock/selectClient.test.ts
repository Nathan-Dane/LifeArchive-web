import { describe, expect, it } from 'vitest'
import type { BuildMode } from './developmentOnly'
import {
  isDevelopmentMockSelected,
  isLocalRuntimeSelected,
} from './developmentOnly'
import {
  InvalidDevelopmentClientSelectionError,
  selectClient,
} from './selectClient'

function mode(overrides: Partial<BuildMode> = {}): BuildMode {
  return {
    DEV: true,
    PROD: false,
    clientSelection: null,
    ...overrides,
  }
}

describe('selecting a client', () => {
  it('selects the runtime when nothing asked for the mock', async () => {
    await expect(selectClient(mode())).resolves.toEqual({
      mode: 'runtime',
      source: 'hosted',
    })
  })

  it('rejects every unrecognized development value', async () => {
    for (const clientSelection of [
      '',
      'mock',
      'development',
      'Development-Mock',
      'development-mock ',
      'true',
    ]) {
      await expect(
        selectClient(mode({ clientSelection })),
      ).rejects.toBeInstanceOf(InvalidDevelopmentClientSelectionError)
    }
  })

  it('selects the local runtime only for its exact development opt-in', async () => {
    await expect(
      selectClient(mode({ clientSelection: 'local-runtime' })),
    ).resolves.toEqual({
      mode: 'runtime',
      source: 'local-runtime',
    })
  })

  it('selects the mock only for the explicit development opt-in', async () => {
    const selection = await selectClient(
      mode({ clientSelection: 'development-mock' }),
    )
    expect(selection.mode).toBe('development-mock')
    if (selection.mode !== 'development-mock') throw new Error('unreachable')
    expect(selection.requiresDevelopmentBanner).toBe(true)
    expect(selection.client.runtime.status()).toEqual({
      state: 'available',
      runtime: expect.objectContaining({ mode: 'development-mock' }),
    })
  })

  it('never selects the mock in a production build, opt-in or not', async () => {
    for (const clientSelection of [
      'development-mock',
      'local-runtime',
      'unrecognized',
      null,
    ]) {
      await expect(
        selectClient(mode({ DEV: false, PROD: true, clientSelection })),
      ).resolves.toEqual({ mode: 'runtime', source: 'hosted' })
    }
  })

  it('never selects the mock when the build is not development', () => {
    expect(
      isDevelopmentMockSelected({
        DEV: false,
        PROD: false,
        clientSelection: 'development-mock',
      }),
    ).toBe(false)
    expect(
      isDevelopmentMockSelected({
        DEV: true,
        PROD: true,
        clientSelection: 'development-mock',
      }),
    ).toBe(false)
    expect(
      isDevelopmentMockSelected({
        DEV: true,
        PROD: false,
        clientSelection: 'development-mock',
      }),
    ).toBe(true)
  })

  it('never selects local runtime outside an exact development selection', () => {
    expect(
      isLocalRuntimeSelected({
        DEV: false,
        PROD: true,
        clientSelection: 'local-runtime',
      }),
    ).toBe(false)
    expect(
      isLocalRuntimeSelected({
        DEV: true,
        PROD: false,
        clientSelection: 'local-runtime ',
      }),
    ).toBe(false)
    expect(
      isLocalRuntimeSelected({
        DEV: true,
        PROD: false,
        clientSelection: 'local-runtime',
      }),
    ).toBe(true)
  })
})
