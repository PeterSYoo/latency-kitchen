import { defineConfig, devices } from '@playwright/test';

// WebKit needs system libraries that CI installs (`playwright install --with-deps`).
// Locally, set PW_ALL=1 to include it.
const all = Boolean(process.env.CI || process.env.PW_ALL);

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:5174/latency-kitchen/' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /phone\.spec/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testMatch: /levels\.spec/ },
    ...(all ? [{ name: 'webkit', use: { ...devices['Desktop Safari'] }, testMatch: /levels\.spec/ }] : []),
    { name: 'phone-chrome', use: { ...devices['Pixel 7'] }, testMatch: /phone\.spec/ },
    ...(all ? [{ name: 'phone-safari', use: { ...devices['iPhone 14'] }, testMatch: /phone\.spec/ }] : []),
  ],
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174/latency-kitchen/',
    reuseExistingServer: !process.env.CI,
  },
});
