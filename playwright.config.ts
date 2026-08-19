import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: "pnpm --filter @coolpath/api dev",
      url: "http://127.0.0.1:8787/healthz",
      env: { COOLPATH_MODE: "mock", DATABASE_URL: ":memory:" },
      reuseExistingServer: !process.env.CI
    },
    {
      command: "pnpm --filter @coolpath/web dev --host 127.0.0.1",
      url: "http://127.0.0.1:5173",
      env: { VITE_DISABLE_THREE: "true" },
      reuseExistingServer: !process.env.CI
    }
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ]
});
