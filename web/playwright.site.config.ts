import { defineConfig, devices } from '@playwright/test'

// The built project site (vite.site.config.ts), served the way GitHub Pages serves it.
const BASE_URL = 'http://127.0.0.1:4180/room-climate-monitor/'

export default defineConfig({
  testDir: 'e2e-site',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'zh-CN',
    // Service workers stay allowed: the tests check that the demo never registers one.
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], locale: 'zh-CN' } },
    { name: 'mobile', use: { ...devices['Pixel 7'], locale: 'zh-CN' } },
  ],
  webServer: {
    command: 'pnpm build:site && pnpm preview:site',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
