import { describe, expect, it } from 'vitest'
import type { BuildMode } from './developmentOnly'
import { isDevelopmentMockSelected } from './developmentOnly'
import { selectClient } from './selectClient'

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
    await expect(selectClient(mode())).resolves.toEqual({ mode: 'runtime' })
  })

  it('selects the runtime for any value other than the exact opt-in', async () => {
    for (const clientSelection of [
      '',
      'mock',
      'development',
      'Development-Mock',
      'development-mock ',
      'true',
    ]) {
      await expect(selectClient(mode({ clientSelection }))).resolves.toEqual({
        mode: 'runtime',
      })
    }
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
    for (const clientSelection of ['development-mock', null]) {
      await expect(
        selectClient(mode({ DEV: false, PROD: true, clientSelection })),
      ).resolves.toEqual({ mode: 'runtime' })
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
})
