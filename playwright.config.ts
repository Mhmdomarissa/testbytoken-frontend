import { defineConfig } from "@playwright/test";

/**
 * Real-browser tests against the dev server + MSW mocks - the layer jsdom
 * can't cover (EventSource, service worker, real cookies). Not wired into
 * CI yet: B10 owns that (browser install + a stable server story). Run
 * with `npm run test:e2e`.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/sign-in",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
