import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  workers: 2,
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
    serviceWorkers: "block",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run preview",
    url: "http://localhost:5173",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
