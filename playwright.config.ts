import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `http://localhost:${PORT}`
const ADAPTER_HARNESS_PORT = 4187
const IS_CI = Boolean(process.env.CI)

/**
 * Production-unavailable coverage plus the real browser archive adapter.
 * Archive adapter tests use a source-served test harness and explicitly
 * simulate the still-unintegrated runtime side of the handoff.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 1 : 0,
  workers: IS_CI ? 1 : undefined,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  globalTimeout: 10 * 60_000,
  reporter: IS_CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium-151', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-153', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: [
    {
      command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
      url: BASE_URL,
      timeout: 120_000,
      reuseExistingServer: !IS_CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `pnpm dev --port ${ADAPTER_HARNESS_PORT} --strictPort`,
      url: `http://localhost:${ADAPTER_HARNESS_PORT}/e2e/archive-transfer.html`,
      timeout: 120_000,
      reuseExistingServer: !IS_CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})
