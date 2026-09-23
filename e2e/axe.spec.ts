import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Phase B B10: axe on every route, including the public proof page. Axe
 * catches missing labels, contrast, and structural a11y issues - it does
 * NOT catch a focus trap or a lost-focus bug (see e2e/keyboard-spine.spec.ts
 * for that; the brief is explicit that automated tooling won't find it).
 *
 * Each route is checked in the state it's actually reachable in from a
 * cold link - no synthetic DOM states, no props override, the same page
 * a real visitor gets.
 */

async function checkPage(page: Page, path: string) {
  await page.goto(path);
  const results = await new AxeBuilder({ page })
    // Best-practice rules are opinionated style preferences, not WCAG
    // failures - this checks conformance (wcag2a/2aa/21a/21aa), not taste.
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations,
    `${path}:\n${results.violations
      .map(
        (v) =>
          `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))\n` +
          v.nodes.map((n) => `    ${n.target.join(" ")}`).join("\n"),
      )
      .join("\n")}`,
  ).toEqual([]);
}

test.describe("public routes", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sign-in", async ({ page }) => {
    await checkPage(page, "/sign-in");
  });

  test("the public proof page", async ({ page }) => {
    await checkPage(page, "/p/share_demo");
  });
});

test.describe("console routes", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("app home", async ({ page }) => {
    await checkPage(page, "/overview");
  });

  test("targets", async ({ page }) => {
    await checkPage(page, "/targets");
  });

  test("target login handoff", async ({ page }) => {
    await checkPage(page, "/targets/tgt_checkout/login");
  });

  test("inventory", async ({ page }) => {
    await checkPage(page, "/targets/tgt_checkout/inventory");
  });

  test("compose", async ({ page }) => {
    await checkPage(page, "/targets/tgt_checkout/compose");
  });

  test("runs list", async ({ page }) => {
    await checkPage(page, "/runs");
  });

  test("run detail", async ({ page }) => {
    await checkPage(page, "/runs/run_pass_1");
  });

  test("suites", async ({ page }) => {
    await checkPage(page, "/suites");
  });

  test("usage", async ({ page }) => {
    await checkPage(page, "/usage");
  });

  test("style guide", async ({ page }) => {
    await checkPage(page, "/style-guide");
  });
});
