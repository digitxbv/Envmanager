import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4400',
    trace: 'on-first-retry',
    screenshot: 'off',
    video: 'off',
    headless: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4400',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      POSTHOG_PUBLIC_KEY: process.env.POSTHOG_PUBLIC_KEY || 'phc_mSUtA90ar4560h6u9oMOCAfE7YTvHL8aXftP5B81dE',
      POSTHOG_HOST: process.env.POSTHOG_HOST || 'https://e.envmanager.com',
    },
  },
});
