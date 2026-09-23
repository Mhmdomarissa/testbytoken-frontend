import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * The public landing page (docs/PHASE_LANDING_POLISH.md, Part L) and its
 * demo launcher. Everything the report shows must have come from the mock
 * through the real contract - these assert the page says exactly what the
 * mock reports for each scenario, including the failing ones.
 */

test.describe("anonymous visitor", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  async function propose(page: Page, scenario: string, intent: string) {
    await page.goto("/");
    const launcher = page.getByTestId("demo-launcher");
    // The launcher reads the sample target before it can propose.
    await expect(launcher.getByTestId("demo-disclosure")).toContainText(
      "checkout.example.com",
    );
    await launcher.getByRole("button", { name: scenario }).click();
    await launcher.getByLabel("What would you like to test?").fill(intent);
    await launcher.getByRole("button", { name: "Propose a plan" }).click();
    return page.getByTestId("demo-report");
  }

  test("a failing-step scenario is reported as failed, with coverage, the failure, and what was left out", async ({
    page,
  }) => {
    const report = await propose(page, "Failing step", "check the checkout");
    await report.getByRole("button", { name: /Approve and run/ }).click();

    const summary = report.getByTestId("run-summary");
    await expect(summary.getByTestId("run-status")).toHaveAttribute(
      "data-status",
      "failed",
      { timeout: 15_000 },
    );
    // Pass rate never ships alone.
    await expect(summary.getByTestId("pass-rate-coverage")).toContainText(
      "0% pass",
    );
    await expect(summary.getByTestId("pass-rate-coverage")).toContainText(
      "2 of 5 plan steps covered",
    );
    const steps = report.getByTestId("step-list");
    await expect(steps).toContainText("Fail");
    await expect(steps).toContainText("Skipped after prior failure");
    // What wasn't approved is shown, not hidden.
    await expect(report).toContainText("What was approved, and what wasn't");
    await expect(report).toContainText("Sign in with the account password");
    await expect(report.getByTestId("proof-hash")).toContainText("sha256:");
  });

  test("a normal scenario reports the verdict the mock sent, with coverage beside it", async ({
    page,
  }) => {
    const report = await propose(page, "Normal run", "check the checkout");
    await report.getByRole("button", { name: /Approve and run/ }).click();
    const summary = report.getByTestId("run-summary");
    await expect(summary.getByTestId("run-status")).toHaveAttribute(
      "data-status",
      "passed",
      { timeout: 15_000 },
    );
    await expect(summary.getByTestId("pass-rate-coverage")).toContainText(
      "100% pass",
    );
    await expect(summary.getByTestId("pass-rate-coverage")).toContainText(
      "2 of 5 plan steps covered",
    );
  });

  test("an unplannable scenario shows the planner's own failure, and trying again keeps the request", async ({
    page,
  }) => {
    const report = await propose(page, "Unplannable", "anything at all");
    await expect(report.getByTestId("plan-failed")).toContainText(
      "The planner couldn't produce a plan.",
    );
    await report
      .getByRole("button", { name: "Change the request and try again" })
      .click();
    await expect(page.getByTestId("demo-report")).toHaveCount(0);
    await expect(page.getByLabel("What would you like to test?")).toHaveValue(
      "anything at all",
    );
  });

  test("read-only by construction: a plan with a write step approved is refused before anything runs", async ({
    page,
  }) => {
    // "writes:" is the mock's cue to plan as if the account could write.
    const report = await propose(page, "Normal run", "writes: buy something");
    await report
      .getByRole("button", { name: /Approve and run 3 steps/ })
      .click();
    await expect(report.getByRole("alert")).toContainText(
      "The demo only runs steps that read",
    );
    await expect(report.getByTestId("demo-run")).toHaveCount(0);
  });

  test("text that looks like markup is shown as text, and nothing it contains runs", async ({
    page,
  }) => {
    let dialog = false;
    page.on("dialog", async (d) => {
      dialog = true;
      await d.dismiss();
    });
    const hostile = `<img src=x onerror="alert(1)">`;
    const report = await propose(page, "Normal run", hostile);
    await expect(report).toContainText(hostile);
    await expect(report.locator("img[src=x]")).toHaveCount(0);
    expect(dialog).toBe(false);
  });

  test("starting over puts focus back on the form, not <body>", async ({
    page,
  }) => {
    const report = await propose(page, "Normal run", "check the checkout");
    await report.getByRole("button", { name: /Approve and run/ }).click();
    await expect(report.getByTestId("run-status")).toHaveAttribute(
      "data-status",
      "passed",
      { timeout: 15_000 },
    );
    await report.getByRole("button", { name: "Run another test" }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.activeElement?.closest("[data-testid=demo-launcher]") !==
            null,
        ),
      )
      .toBe(true);
  });

  test("axe, with a plan up for review", async ({ page }) => {
    const report = await propose(page, "Normal run", "check the checkout");
    await expect(
      report.getByRole("button", { name: /Approve and run/ }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
      ),
    ).toEqual([]);
  });

  test("axe, with a finished report on the page", async ({ page }) => {
    const report = await propose(page, "Failing step", "check the checkout");
    await report.getByRole("button", { name: /Approve and run/ }).click();
    await expect(report.getByTestId("run-status")).toHaveAttribute(
      "data-status",
      "failed",
      { timeout: 15_000 },
    );
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
      ),
    ).toEqual([]);
  });
});

test("a signed-in visitor at / is redirected to /overview by the server, never shown the landing page", async ({
  page,
}) => {
  await signIn(page);
  const response = await page.goto("/");
  // An HTTP redirect, not a client-side one: the document request for /
  // never returned a page.
  expect(response?.request().redirectedFrom()?.url()).toMatch(/\/$/);
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByTestId("demo-launcher")).toHaveCount(0);
});
