import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Phase B B10 follow-up: does every route actually get the ShellMain.tsx /
 * PublicMain.tsx guarantee, or did keyboard-spine.spec.ts just happen to
 * walk a lucky subset? This file is the manifest walk - every route this
 * app currently has, reached by clicking a real link (not `page.goto()`,
 * which is a hard navigation and would reset focus for free regardless of
 * whether the fix exists at all), checked for focus after each one.
 *
 * Why this is closeable structurally, and provably so rather than by
 * argument: ShellMain and PublicMain each sit in exactly one layout.tsx,
 * and Next.js App Router composes every page under a layout through it -
 * there is no way to add a page under `(console)/(app)/**` or
 * `(public)/**` that skips its layout; you would have to deliberately
 * build a competing route group outside both, which is a visible
 * restructuring, not a silent omission. Listing every route here isn't
 * what keeps this closed - the layout composition is what does that. This
 * test exists to catch the OTHER way it could break: someone edits
 * ShellMain/PublicMain/useFocusRegionOnChange itself and gets it wrong.
 *
 * What this file does NOT close, and can't: the separate in-place-swap
 * class (compose's form -> plan -> approval, SharePanel's off -> on,
 * ProofView's loading -> ready) has no route to walk - the URL never
 * changes, so there's nothing here to enumerate. A new component
 * elsewhere with the same "button triggers content that unmounts it"
 * shape would need its own useFocusRegionOnChange call and, honestly,
 * its own test noticing if it's missing - that part stays a per-component
 * discipline, the same way remembering to parse a response through its
 * Zod schema is. Not claiming otherwise.
 */

/**
 * Not just "focus left <body>": the sidebar itself persists across a
 * navigation (only the <main> region's content swaps), so a clicked
 * sidebar link keeps focus on itself regardless of whether the fix
 * exists - checking against <body> alone would pass by accident on
 * every one of those clicks and prove nothing. The real claim is that
 * focus landed IN the region that actually changed.
 */
async function expectFocusInMain(page: Page, afterWhat: string) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = document.activeElement;
          if (!el) return "NONE";
          if (el === document.body) return "BODY";
          return el.closest("main") ? "IN_MAIN" : `OUTSIDE_MAIN(${el.tagName})`;
        }),
      { message: `focus after navigating to ${afterWhat}`, timeout: 2_000 },
    )
    .toBe("IN_MAIN");
}

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // Out to the sample report by its client-side link, then back: both are
  // soft navigations inside the (public) group, so both need PublicMain's
  // focus move. (The proof page deliberately carries no link back to `/`:
  // next/link would cost that page ~3 KB against its tight budget.)
  test("the landing page and the sample report it links to each put focus inside main", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("contentinfo")
      .or(page.locator("footer"))
      .getByRole("link", { name: "Sample report" })
      .click();
    await page.waitForURL(/\/p\/share_demo$/);
    await expectFocusInMain(page, "the sample report");

    await page.goBack();
    await page.waitForURL((url) => url.pathname === "/");
    await expectFocusInMain(page, "the landing page");
  });
});

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("every console route reached via the sidebar puts focus inside main, not stuck on the sidebar or lost to <body>", async ({
    page,
  }) => {
    const sidebar = page.locator('[data-slot="sidebar"]');

    for (const name of ["Targets", "Runs", "Suites", "Usage"]) {
      await sidebar.getByRole("link", { name, exact: true }).click();
      await expectFocusInMain(page, name);
    }

    // The console home, reached the only way the sidebar offers: its wordmark.
    await sidebar.getByRole("link", { name: "Test by Token" }).click();
    await page.waitForURL(/\/overview$/);
    await expectFocusInMain(page, "overview");
  });

  test("every route one hop deeper - inventory, compose, login, run detail, and the public proof page", async ({
    page,
  }) => {
    await page.goto("/targets");
    const row = page.getByTestId("target-tgt_checkout");

    await row.getByRole("link", { name: "Inventory" }).click();
    await page.waitForURL(/\/inventory$/);
    await expectFocusInMain(page, "inventory");

    await page.goBack();
    await page.waitForURL(/\/targets$/);
    await row.getByRole("link", { name: "Compose test" }).click();
    await page.waitForURL(/\/compose$/);
    await expectFocusInMain(page, "compose");

    await page.goBack();
    await page.waitForURL(/\/targets$/);
    await row.getByRole("link", { name: "Sign in" }).click();
    await page.waitForURL(/\/login$/);
    await expectFocusInMain(page, "the login handoff");

    // run_fail_1, not run_pass_1: the latter carries B9's fixture-baked
    // demo share (already enabled), so "Create a public link" below
    // wouldn't be there to click.
    await page.goto("/runs");
    await page.getByRole("link", { name: "run_fail_1" }).click();
    await expectFocusInMain(page, "run detail");

    await page.getByRole("button", { name: "Create a public link" }).click();
    await page.getByRole("link", { name: "View public page" }).click();
    await expectFocusInMain(page, "the public proof page");
  });
});
