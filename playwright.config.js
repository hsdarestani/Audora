const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests-ui',
  testMatch: ['audora-final.spec.js', 'builder-team-selection.spec.js'],
  timeout: 120000,
  expect: { timeout: 12000 },
  retries: 0,
  workers: 1,
  reporter: [['line']],
  use: {
    baseURL: process.env.AUDORA_BASE_URL || 'https://audora.smarbiz.sbs',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
});