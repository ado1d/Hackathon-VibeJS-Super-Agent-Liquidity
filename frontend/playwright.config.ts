import { defineConfig, devices } from '@playwright/test'

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: { baseURL: externalBaseUrl || 'http://127.0.0.1:4173', trace: 'on-first-retry' },
  webServer: externalBaseUrl
    ? undefined
    : { command: 'npm run build && npx vite preview --host 127.0.0.1', port: 4173, reuseExistingServer: true },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
    { name: 'mobile-768', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
  ],
})
