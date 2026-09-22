import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";
import { PAGE_XSS_TITLE } from "../src/mocks/data";

/**
 * Phase B B10: the hostile-content fixture (docs/PHASE_A.md's A6 task,
 * `src/mocks/xss-safety.test.tsx`), driven through every REAL screen that
 * renders text a scanned site could have produced - not just proven inert
 * once, in isolation, and assumed to generalise. React's default JSX
 * interpolation is what keeps this safe everywhere; this file is the
 * regression guard that it's actually being used everywhere, in a real
 * browser, on the actual fixture data each screen reads.
 *
 * Six screens total prove this fixture inert: the original Phase A
 * component-level test, inventory (e2e/inventory.spec.ts, already covers
 * a page title AND an element label), and the four covered here - targets,
 * compose, run detail, and the public proof page.
 */

test.describe("targets", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.goto("/targets");
  });

  test("a hostile target name renders as inert text, not markup", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Add a target" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(PAGE_XSS_TITLE);
    await dialog.getByLabel("Address").fill("https://xss-target.example.com");
    await dialog.getByRole("combobox", { name: "Environment" }).click();
    await page.getByRole("option", { name: "staging", exact: true }).click();
    await dialog.getByRole("button", { name: "Register target" }).click();
    await expect(dialog).toBeHidden();

    const row = page
      .getByRole("row")
      .filter({ has: page.getByText(PAGE_XSS_TITLE) });
    await expect(row).toBeVisible();
    await expect(page.locator("img[src='x']")).toHaveCount(0);
  });
});

test.describe("compose", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("an ambiguous element's locator (a real crawl can carry an injected attribute) renders as inert text", async ({
    page,
  }) => {
    await page.goto("/targets/tgt_checkout/compose");
    await page.getByLabel("What do you want to test?").fill("checkout");
    await page.getByRole("button", { name: "Propose a plan" }).click();

    const ambiguous = page.getByTestId("plan-step-pstp_4");
    await expect(ambiguous).toBeVisible();
    await expect(ambiguous.getByTestId("step-binding")).toContainText(
      PAGE_XSS_TITLE,
    );
    await expect(page.locator("img[src='x']")).toHaveCount(0);
  });
});

test.describe("run detail and the proof page", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("a failure message that echoes page content renders as inert text on the run screen", async ({
    page,
  }) => {
    await page.goto("/runs/run_fail_1");
    const failing = page.getByTestId("step-stp_2");
    await expect(failing).toContainText(PAGE_XSS_TITLE);
    await expect(page.locator("img[src='x']")).toHaveCount(0);
  });

  test("the same failure message, and the uncovered list's own locator, are still inert once shared publicly", async ({
    page,
  }) => {
    await page.goto("/runs/run_fail_1");
    await page.getByRole("button", { name: "Create a public link" }).click();
    await expect(page.getByTestId("share-on")).toBeVisible();
    await page.getByRole("link", { name: "View public page" }).click();
    await page.waitForURL(/\/p\//);
    await expect(page.getByTestId("proof-verdict")).toBeVisible();

    const failing = page.getByTestId("step-stp_2");
    await expect(failing).toContainText(PAGE_XSS_TITLE);
    await expect(page.getByTestId("uncovered-list")).toContainText(
      PAGE_XSS_TITLE,
    );
    await expect(page.locator("img[src='x']")).toHaveCount(0);
    await page.screenshot({
      path: "test-results/proof-hostile-content.png",
      fullPage: true,
    });
  });
});
