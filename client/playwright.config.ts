import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 60000, workers: 2,
  use: { baseURL: 'http://localhost:4173', headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', serviceWorkers: 'block', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run build:web && vite preview --host localhost --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: false, timeout: 60000 },
});
