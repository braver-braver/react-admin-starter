import { defineConfig } from 'playwright/test'

const base = process.env.DEMO_SERVE_BASE ?? '/react-admin-starter/'
export default defineConfig({
  testDir: './e2e',
  testMatch: 'demo.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:5192${base}`,
    browserName: 'chromium',
    locale: 'zh-CN',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'demo-desktop', use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'demo-mobile',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'node scripts/serve-demo.mjs',
    url: `http://127.0.0.1:5192${base}versions.html`,
    reuseExistingServer: false,
  },
})
