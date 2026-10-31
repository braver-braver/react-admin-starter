import { defineConfig } from 'playwright/test'

// Own both servers: never silently test a stale developer instance.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    browserName: 'chromium',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    colorScheme: 'light',
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testMatch: ['app.e2e.ts', 'system.e2e.ts'],
      use: {
        baseURL: 'http://127.0.0.1:5190',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      testMatch: ['app.e2e.ts', 'system.e2e.ts'],
      use: {
        baseURL: 'http://127.0.0.1:5190',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'production',
      testMatch: 'production.e2e.ts',
      use: { baseURL: 'http://127.0.0.1:5191' },
    },
    {
      // The same production build, with /api proxied to the conformance
      // stand-in back end (a test double) as a same-origin API.
      name: 'production-api',
      testMatch: 'production-api.e2e.ts',
      use: { baseURL: 'http://127.0.0.1:5193' },
    },
  ],
  webServer: [
    {
      command: 'pnpm dev --host 127.0.0.1 --port 5190 --strictPort',
      url: 'http://127.0.0.1:5190/sign-in',
      env: { VITE_ENABLE_MOCKS: 'true' },
      reuseExistingServer: false,
    },
    {
      command: 'pnpm preview --host 127.0.0.1 --port 5191 --strictPort',
      url: 'http://127.0.0.1:5191/sign-in',
      reuseExistingServer: false,
    },
    {
      command: 'node scripts/serve-stand-in.mjs 5194',
      // 401 without a session: the stand-in is up.
      url: 'http://127.0.0.1:5194/api/v1/auth/session',
      reuseExistingServer: false,
    },
    {
      command: 'pnpm preview --host 127.0.0.1 --port 5193 --strictPort',
      url: 'http://127.0.0.1:5193/sign-in',
      env: { VITE_API_PROXY_TARGET: 'http://127.0.0.1:5194' },
      reuseExistingServer: false,
    },
  ],
})
