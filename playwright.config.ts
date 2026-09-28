import { defineConfig } from "@playwright/test";

/**
 * Real-browser tests against the MSW mocks - the layer jsdom can't cover
 * (EventSource, service worker, real cookies). Not wired into CI yet: B10
 * owns that (browser install + a stable server story).
 *
 *   npm run test:e2e        against `next dev`
 *   npm run test:e2e:prod   against a production build of the demo
 *                           (`next build && next start`, mocking on) -
 *                           the deploy brief's D1 check that the service
 *                           worker registers, intercepts and wins the
 *                           cold-start race outside development.
 */
const PRODUCTION = process.env.E2E_PRODUCTION_BUILD === "1";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:3000" },
  webServer: PRODUCTION
    ? {
        command: "npm run build && npm run start",
        env: { NEXT_PUBLIC_API_MOCKING: "on" },
        url: "http://localhost:3000/sign-in",
        // Never a dev server that happens to be running: this run exists
        // to test the production build.
        reuseExistingServer: false,
        timeout: 300_000,
      }
    : {
        command: "npm run dev",
        url: "http://localhost:3000/sign-in",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
