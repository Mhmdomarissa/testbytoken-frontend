import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * No pass rate for a run that hasn't finished, on any surface that shows
 * one. The runs list once rendered "100% pass" on four RUNNING runs -
 * including run_live_fail_1, which ends at 50%. A rate over the steps so
 * far is a number about a run that hasn't ended.
 *
 * Every surface that can show a pass rate:
 *   - the runs list          (each row)
 *   - the run detail page    (the summary)
 *   - the landing demo       (its report)
 *   - the public proof page and its OG image - both reachable only through
 *     a proof, and a proof exists only for a finished run; asserted below.
 *
 * `queued` never occurs in the mock's timelines (runs start running), so
 * the queued case is covered by RunPassRate's own unit tests.
 */

const TERMINAL = new Set(["passed", "failed", "cancelled", "timed_out"]);

/**
 * Watch a run's summary until it finishes, asserting at every sample that
 * no pass rate is on screen while the status isn't terminal. Returns the
 * terminal status it ended on.
 */
async function watchUntilTerminal(page: Page, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let samples = 0;
  for (;;) {
    const status = await page
      .getByTestId("run-status")
      .getAttribute("data-status")
      .catch(() => null);
    const shown = await page.getByTestId("pass-rate-coverage").count();
    if (status && TERMINAL.has(status)) return { status, samples };
    expect(
      shown,
      `a pass rate was on screen while the run was "${status ?? "unknown"}"`,
    ).toBe(0);
    samples++;
    if (Date.now() > deadline) throw new Error("run never finished");
    await page.waitForTimeout(100);
  }
}

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("runs list: no running row shows a pass rate; every finished row shows one with coverage", async ({
    page,
  }) => {
    await page.goto("/runs");
    const rows = page.getByRole("row").filter({ has: page.getByRole("link") });
    await expect(rows.first()).toBeVisible();

    let running = 0;
    for (const row of await rows.all()) {
      const label = (await row.getByRole("cell").nth(1).innerText()).trim();
      const rate = row.getByTestId("pass-rate-coverage");
      if (/running|queued/i.test(label)) {
        running++;
        await expect(rate).toHaveCount(0);
        await expect(row).toContainText("Reported when the run finishes");
      } else {
        await expect(rate).toHaveCount(1);
        await expect(rate).toContainText("covered");
      }
    }
    // Not vacuous: the fixtures carry live runs that are running right now.
    expect(running).toBeGreaterThan(0);
  });

  test("run detail: no pass rate at any moment of a live run, then the real one when it finishes", async ({
    page,
  }) => {
    await page.goto("/runs/run_live_fail_1");
    const { status, samples } = await watchUntilTerminal(page);
    expect(samples).toBeGreaterThan(5); // it really was watched mid-run
    expect(status).toBe("failed");
    // The pass rate that finally appears is the finished run's own, 50% -
    // not the 100% the first two steps would have suggested.
    await expect(page.getByTestId("pass-rate-coverage")).toContainText(
      "50% pass",
    );
  });

  test("proof page and OG image: a running run has no proof, so neither can show a pass rate", async ({
    page,
  }) => {
    await page.goto("/runs/run_live_pass_1");
    await expect(page.getByTestId("run-status")).toHaveAttribute(
      "data-status",
      "running",
    );
    // Nothing to share, so no public page or OG image, while it runs.
    await expect(
      page.getByRole("heading", { name: "Share this proof" }),
    ).toHaveCount(0);
    const { proofId, proofStatus } = await page.evaluate(async () => {
      const run = await (await fetch("/runs/run_live_pass_1")).json();
      const proof = await fetch(`/proofs/proof_${run.id}`);
      return { proofId: run.proof_id, proofStatus: proof.status };
    });
    expect(proofId).toBeNull();
    expect(proofStatus).toBe(404);
  });
});

test.describe("anonymous visitor", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("landing demo: no pass rate at any moment of the demo run, then the real one", async ({
    page,
  }) => {
    await page.goto("/");
    const launcher = page.getByTestId("demo-launcher");
    await expect(launcher.getByTestId("demo-disclosure")).toContainText(
      "checkout.example.com",
    );
    await launcher.getByRole("button", { name: "Failing step" }).click();
    await launcher
      .getByLabel("What would you like to test?")
      .fill("check the checkout");
    await launcher.getByRole("button", { name: "Propose a plan" }).click();
    await page
      .getByTestId("demo-report")
      .getByRole("button", { name: /Approve and run/ })
      .click();
    await expect(page.getByTestId("run-status")).toBeVisible();

    const { status, samples } = await watchUntilTerminal(page);
    expect(samples).toBeGreaterThan(5);
    expect(status).toBe("failed");
    await expect(page.getByTestId("pass-rate-coverage")).toContainText(
      "0% pass",
    );
  });
});
