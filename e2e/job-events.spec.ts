import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * docs/PHASE_B0_5.md A2: `useJobEvents` in a real browser, against the
 * mock. jsdom has no EventSource, so this is the only place the hook has
 * ever run. Asserts live arrival, resume via ?since=, that a dropped
 * connection surfaces as a visible state, and that a legitimately quiet
 * stream is NOT mistaken for a dead one.
 */

const text = (page: import("@playwright/test").Page, id: string) =>
  page.getByTestId(id).textContent();

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("events arrive live, in order, not all at once", async ({ page }) => {
  await page.goto("/dev/job-events?job=run_live_pass_1");

  await expect(page.getByTestId("step-0")).toBeVisible();
  // Steps land ~1.2s apart: when step 1 is on screen, the last one is not.
  await expect(page.getByTestId("step-1")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId("step-4")).toHaveCount(0);

  await expect(page.getByTestId("status")).toHaveText("passed", {
    timeout: 10_000,
  });
  await expect(page.locator('[data-testid^="step-"]')).toHaveCount(5);
  await expect(page.getByTestId("reconnects")).toHaveText("0");
});

test("a finished job's stream closes and stays closed - no reconnect loop", async ({
  page,
}) => {
  const eventRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/jobs/run_live_pass_1/events"))
      eventRequests.push(req.url());
  });
  await page.goto("/dev/job-events?job=run_live_pass_1");
  await expect(page.getByTestId("status")).toHaveText("passed", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("connection")).toHaveText("closed");

  const countAtDone = eventRequests.length;
  await page.waitForTimeout(4_000); // longer than the max first backoff step
  expect(eventRequests.length).toBe(countAtDone);
  await expect(page.getByTestId("connection")).toHaveText("closed");
});

test("a dropped connection is a visible state, and the client resumes via ?since= without gaps or duplicates", async ({
  page,
}) => {
  const eventRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/jobs/run_live_drop_1/events"))
      eventRequests.push(req.url());
  });

  await page.goto("/dev/job-events?job=run_live_drop_1");
  await expect(page.getByTestId("status")).toHaveText("passed", {
    timeout: 20_000,
  });

  // The drop was surfaced, not swallowed.
  await expect(page.getByTestId("history")).toContainText("reconnecting");
  expect(Number(await text(page, "reconnects"))).toBeGreaterThanOrEqual(1);

  // Resume: the reconnect asked for events after the last one it had.
  expect(eventRequests.length).toBeGreaterThanOrEqual(2);
  expect(eventRequests[0]).not.toContain("since=");
  expect(eventRequests.slice(1).some((u) => /since=\d+/.test(u))).toBe(true);

  // Nothing lost, nothing doubled: exactly steps 0..4, once each.
  await expect(page.locator('[data-testid^="step-"]')).toHaveCount(5);
  for (let i = 0; i < 5; i++) {
    await expect(page.getByTestId(`step-${i}`)).toHaveText(`${i}:pass`);
  }
  // Ids 0..8 are the nine frames (four steps are reported `running` before
  // they finish), and 9 is `done`: numbered by position, none skipped.
  await expect(page.getByTestId("last-event-id")).toHaveText("9");
});

test("a legitimately quiet stream is not mistaken for a dead one", async ({
  page,
}) => {
  const eventRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/jobs/run_live_stall_1/events"))
      eventRequests.push(req.url());
  });
  await page.goto("/dev/job-events?job=run_live_stall_1");

  // Two steps, then the engine goes silent for ~13s before timing out.
  await expect(page.getByTestId("step-1")).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(7_000);
  await expect(page.getByTestId("connection")).toHaveText("open");
  await expect(page.getByTestId("reconnects")).toHaveText("0");
  expect(eventRequests.length).toBe(1); // it did not reconnect over silence
  await expect(page.getByTestId("status")).not.toHaveText("timed_out");

  await expect(page.getByTestId("status")).toHaveText("timed_out", {
    timeout: 15_000,
  });
});
