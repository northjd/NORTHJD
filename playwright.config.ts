import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * Runs serially against a **production** server. Two reasons:
 *
 *   1. The local database is a single PGlite backend (ADR 0001), so parallel workers
 *      would contend for it, and a flaky suite teaches people to ignore failures.
 *   2. `next dev` needs its HMR WebSocket to finish bootstrapping the client runtime.
 *      In sandboxed environments that upgrade is sometimes blocked, and the symptom is
 *      that pages render but never hydrate — every interaction test then fails for a
 *      reason that has nothing to do with the application. `next start` has no HMR and
 *      is what users actually run, so the suite targets that.
 *
 * Set `E2E_BASE_URL` to test against an already-running server.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-GB',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 960 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://127.0.0.1:3000/login',
    reuseExistingServer: true,
    timeout: 300_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
