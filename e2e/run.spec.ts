import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Phase B B7 in a real browser: watching a run. All four lifecycle
 * scenarios from Phase A, cancel, and a long run - each driven against the
 * mock's real timing, reading only what the server reported.
 */

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

/** Records every distinct connection-banner state the user was ever shown - a 40ms flicker is still a state. */
async function recordBannerStates(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __states: string[] }).__states = seen;
    const read = () => {
      const s = document
        .querySelector('[data-testid="connection-banner"]')
        ?.getAttribute("data-state");
      if (s && seen[seen.length - 1] !== s) seen.push(s);
    };
    new MutationObserver(read).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });
  });
}
const bannerStates = (page: Page) =>
  page.evaluate(() => (window as unknown as { __states: string[] }).__states);

const status = (page: Page) => page.getByTestId("run-status");

test("clean run: steps arrive live, the CURRENT step is the one the server says is running, and no pass rate until it finishes", async ({
  page,
}) => {
  await recordBannerStates(page);
  await page.goto("/runs/run_live_pass_1");

  await expect(status(page)).toHaveAttribute("data-status", "running");
  await expect(page.getByTestId("no-result-yet")).toContainText(
    "The pass rate is reported when the run finishes",
  );
  await expect(page.getByTestId("pass-rate-coverage")).toHaveCount(0);

  // A step the server reports as `running` is highlighted, and only one is.
  const current = page.locator('[data-current="true"]');
  await expect(current).toHaveCount(1, { timeout: 5_000 });
  await expect(current).toContainText("In progress");
  await expect(current).toHaveAttribute("aria-current", "step");
  await page.screenshot({ path: "test-results/run-live.png", fullPage: true });

  // Not all at once: while step 2 is on screen, the last is not.
  await expect(page.getByTestId("step-stp_2")).toBeVisible({ timeout: 6_000 });
  await expect(page.getByTestId("step-stp_4")).toHaveCount(0);

  // Ends in the server's verdict, with coverage beside the pass rate.
  await expect(status(page)).toHaveAttribute("data-status", "passed", {
    timeout: 12_000,
  });
  await expect(page.locator('[data-current="true"]')).toHaveCount(0);
  await expect(page.locator('[data-testid^="step-stp_"]')).toHaveCount(5);
  await expect(
    page.locator('[data-testid^="step-stp_"][data-status="pass"]'),
  ).toHaveCount(5);
  const result = page.getByTestId("pass-rate-coverage");
  await expect(result).toContainText("100% pass");
  await expect(result).toContainText("of 24 elements covered");
  await expect(page.getByTestId("connection-banner")).toHaveAttribute(
    "data-state",
    "finished",
  );
  await expect(page.getByTestId("reconcile-notes")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/run-passed.png",
    fullPage: true,
  });
  expect(await bannerStates(page)).not.toContain("reconnecting");
});

test("failure partway: the real message is shown in full, the failing step is a failure, later steps are skipped and shown", async ({
  page,
}) => {
  await page.goto("/runs/run_live_fail_1");
  await expect(status(page)).toHaveAttribute("data-status", "failed", {
    timeout: 12_000,
  });
  const failing = page.getByTestId("step-stp_2");
  await expect(failing).toHaveAttribute("data-status", "fail");
  await expect(failing).toContainText(
    'Expected element "#confirm-button" to be visible within 5000ms, but it was not found on the page.',
  );
  await expect(failing).toContainText("Asserts: is visible within 5000ms");
  const skipped = page.getByTestId("step-stp_3");
  await expect(skipped).toHaveAttribute("data-status", "skipped");
  await expect(skipped).toContainText("Skipped after prior failure");
  await expect(page.getByTestId("pass-rate-coverage")).toContainText("% pass");
  await page.screenshot({
    path: "test-results/run-failed.png",
    fullPage: true,
  });
});

test("a stalled engine: the screen says the connection is healthy but quiet, then shows timed out - which is not a failure", async ({
  page,
}) => {
  await recordBannerStates(page);
  await page.goto("/runs/run_live_stall_1");
  await expect(status(page)).toHaveAttribute("data-status", "running");

  // Two steps, then silence: the banner says so instead of freezing.
  await expect(page.getByTestId("step-stp_1")).toBeVisible({ timeout: 6_000 });
  const banner = page.getByTestId("connection-banner");
  await expect(banner).toHaveAttribute("data-state", "quiet", {
    timeout: 15_000,
  });
  await expect(banner).toContainText("No new step for");
  await expect(banner).toContainText("The engine is quiet");
  await page.screenshot({ path: "test-results/run-quiet.png", fullPage: true });

  await expect(status(page)).toHaveAttribute("data-status", "timed_out", {
    timeout: 20_000,
  });
  await expect(status(page)).toContainText("Timed out");
  await expect(page.getByTestId("run-timed-out")).toContainText(
    "engine stopped responding",
  );
  await expect(page.getByTestId("run-timed-out")).toContainText(
    "different from a failed step",
  );
  // The engine's own marker for it is a step, and it is not a "passed" anything.
  await expect(page.getByTestId("step-stp_timeout")).toHaveAttribute(
    "data-status",
    "fail",
  );
  expect(await bannerStates(page)).toContain("quiet");
  await page.screenshot({
    path: "test-results/run-timed-out.png",
    fullPage: true,
  });
});

test("a dropped connection is a visible state, and the run resumes without gaps or duplicates", async ({
  page,
}) => {
  await recordBannerStates(page);
  await page.goto("/runs/run_live_drop_1");
  await expect(status(page)).toHaveAttribute("data-status", "passed", {
    timeout: 20_000,
  });

  // The user WAS told the stream dropped (the state existed, even briefly).
  expect(await bannerStates(page)).toContain("reconnecting");
  // ...and told afterwards that it happened and was resumed.
  await expect(page.getByTestId("connection-banner")).toContainText(
    "dropped and reconnected 1 time",
  );
  await expect(page.getByTestId("connection-banner")).toContainText(
    "nothing is skipped or repeated",
  );
  // Exactly the five steps, once each, all passed.
  await expect(page.locator('[data-testid^="step-stp_"]')).toHaveCount(5);
  await expect(
    page.locator('[data-testid^="step-stp_"][data-status="pass"]'),
  ).toHaveCount(5);
  await expect(page.getByTestId("reconcile-notes")).toHaveCount(0);
});

test("a long run is windowed: a bounded number of rows are mounted, the list still says how long it is, and failures are always readable in full", async ({
  page,
}) => {
  await page.goto("/runs/run_long_1");
  const list = page.getByTestId("step-list");
  await expect(list).toHaveAttribute("data-windowed", "true");

  const rendered = await page
    .locator(
      '[data-testid="step-list"] [data-testid^="step-stp_"], [data-testid="step-list"] li[data-testid^="step-"]',
    )
    .count();
  expect(rendered).toBeGreaterThan(0);
  expect(rendered).toBeLessThan(64);
  await expect(list.locator("li").first()).toHaveAttribute(
    "aria-setsize",
    "64",
  );
  await expect(page.getByText("All 64 steps.")).toBeVisible();

  // The failure is in the summary in full, without scrolling to it.
  const summary = page.getByTestId("failures-summary");
  await expect(summary).toContainText("Failed and warning steps (2)");
  await expect(summary).toContainText(
    'Expected element ".upsell-banner" to be visible, but it was not rendered for this session.',
  );

  // Scrolling to the end mounts the last row.
  await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(list.locator('li[aria-posinset="64"]')).toBeVisible();
  await page.screenshot({ path: "test-results/run-long.png", fullPage: true });
});

test("cancel: confirm first, then the SERVER's answer decides what the screen shows; unstarted steps are skipped", async ({
  page,
}) => {
  // Start a real run through the UI (a client-side navigation keeps the mock's memory).
  await page.goto("/targets");
  await page
    .getByTestId("target-tgt_checkout")
    .getByRole("link", { name: "Compose test" })
    .click();
  await page
    .getByLabel("What do you want to test?")
    .fill("writes: Buy something");
  await page.getByRole("button", { name: "Propose a plan" }).click();
  await expect(page.getByText("Proposed - nothing has run")).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Approve and run 3 steps" }).click();
  await page.getByRole("link", { name: "Watch this run" }).click();
  await expect(page).toHaveURL(/\/runs\/run_/);
  await expect(status(page)).toHaveAttribute("data-status", "running");

  await page.getByRole("button", { name: "Cancel run" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Cancel this run?");
  // Backing out changes nothing.
  await dialog.getByRole("button", { name: "Keep running" }).click();
  await expect(dialog).toBeHidden();
  await expect(status(page)).toHaveAttribute("data-status", "running");

  await page.getByRole("button", { name: "Cancel run" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel run" })
    .click();
  await expect(status(page)).toHaveAttribute("data-status", "cancelled", {
    timeout: 8_000,
  });
  await expect(page.getByTestId("run-cancelled")).toContainText(
    "Steps that had not run are shown as skipped",
  );
  await expect(
    page.locator('[data-testid^="step-"][data-status="skipped"]').first(),
  ).toBeVisible();
  // A finished run offers no cancel.
  await expect(page.getByRole("button", { name: "Cancel run" })).toHaveCount(0);
  await page.screenshot({
    path: "test-results/run-cancelled.png",
    fullPage: true,
  });
});

test("a finished run offers no cancel, and an unknown run says so", async ({
  page,
}) => {
  await page.goto("/runs/run_pass_1");
  await expect(status(page)).toHaveAttribute("data-status", "passed");
  await expect(page.getByRole("button", { name: "Cancel run" })).toHaveCount(0);
  await page.goto("/runs/run_nope");
  await expect(page.getByText("Run not found")).toBeVisible();
});

test("the runs list links to each run", async ({ page }) => {
  await page.goto("/runs");
  await page.getByRole("link", { name: "run_pass_1" }).click();
  await expect(page).toHaveURL(/\/runs\/run_pass_1$/);
});
