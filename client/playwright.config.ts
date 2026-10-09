import { defineConfig } from '@playwright/test';
const e2ePort = Number(process.env.E2E_PORT || '4173');
const e2eBaseUrl = `http://localhost:${e2ePort}`;

export default defineConfig({
  testDir: './e2e', timeout: 60000, workers: 2,
  use: { baseURL: e2eBaseUrl, headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', serviceWorkers: 'block', screenshot: 'only-on-failure' },
  webServer: { command: `npm run build:web && vite preview --host localhost --port ${e2ePort} --strictPort`, url: e2eBaseUrl, reuseExistingServer: false, timeout: 60000 },
});
