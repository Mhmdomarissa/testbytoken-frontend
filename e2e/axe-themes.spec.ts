import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * UI v2, V0: axe in BOTH themes. e2e/axe.spec.ts is left exactly as it
 * was; this runs the same WCAG A/AA conformance check with the colour
 * scheme pinned each way, and first proves the page really rendered in
 * that theme (the page's own background colour), so a theme that silently
 * failed to apply can't pass as "checked".
 *
 * The landing page is pinned dark until V7 designs its light version, so
 * it is expected dark under both schemes.
 */

const PAGE_BG = {
  light: "rgb(246, 245, 241)", // --surface-page, light
  dark: "rgb(10, 17, 32)", // --surface-page, dark
} as const;

async function checkPage(
  page: Page,
  path: string,
  expectBg: string,
  // The element whose background is the page ground. The landing paints
  // its own wrapper; everything else paints <body>.
  groundSelector = "body",
) {
  await page.goto(path);
  await expect(page.locator(groundSelector).first()).toHaveCSS(
    "background-color",
    expectBg,
  );
  const results = await new AxeBuilder({ page })
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

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test.describe("public routes", () => {
      test.use({ storageState: { cookies: [], origins: [] } });

      test("sign-in", async ({ page }) => {
        await checkPage(page, "/sign-in", PAGE_BG[scheme]);
      });

      test("the public proof page", async ({ page }) => {
        await checkPage(page, "/p/share_demo", PAGE_BG[scheme]);
      });

      test("the landing page (pinned dark until V7)", async ({ page }) => {
        await checkPage(page, "/", PAGE_BG.dark, "[data-landing]");
      });
    });

    test.describe("console routes", () => {
      test.beforeEach(async ({ page }) => {
        await signIn(page);
      });

      for (const path of [
        "/overview",
        "/targets",
        "/targets/tgt_checkout/login",
        "/targets/tgt_checkout/inventory",
        "/targets/tgt_checkout/compose",
        "/runs",
        "/runs/run_pass_1",
        "/runs/run_fail_1",
        "/suites",
        "/usage",
        "/style-guide",
      ]) {
        test(path, async ({ page }) => {
          await checkPage(page, path, PAGE_BG[scheme]);
        });
      }
    });
  });
}
