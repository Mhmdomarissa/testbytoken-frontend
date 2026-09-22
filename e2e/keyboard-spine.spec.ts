import { expect, test, type Page } from "@playwright/test";

/**
 * Phase B B10: the whole spine, one sitting, keyboard only - sign-in,
 * target, scan, inventory, compose, approve, watch, result, share.
 *
 * Per-screen keyboard tests (e.g. plan.spec.ts's Tab-order test) each start
 * with page.goto(), a full navigation that resets focus for free - that
 * can't catch a client-side (next/link) transition that drops focus to
 * <body> and leaves a keyboard/screen-reader user stranded with no sense
 * of where they are. This test never calls page.goto() after the first
 * line: every hop is a real keyboard activation of the thing the PREVIOUS
 * screen actually rendered, and after every one, focus is checked before
 * anything else.
 *
 * Elements are focused directly (`.focus()`) rather than Tabbed to one at
 * a time from a page's top - full Tab-order coverage per screen is
 * plan.spec.ts's job. What this test uniquely proves is activation via a
 * real keyboard event (Enter/Space, not `.click()`) and where focus lands
 * afterward, continuously across every hop in the spine.
 */

/** document.activeElement's tag+testid+text, or "BODY" if focus was dropped. */
async function activeElementSummary(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    const testid = el.getAttribute("data-testid");
    const text = el.textContent?.trim().slice(0, 40) ?? "";
    return `${el.tagName}${testid ? `[data-testid=${testid}]` : ""} "${text}"`;
  });
}

/**
 * Focus never lands on <body> after a client-side transition - that's a
 * stranded keyboard user. Polls briefly rather than checking once:
 * `waitForURL`/an in-place UI update resolving is not the same instant
 * React's own effects (where the fix lives) actually flush - a real user
 * has the same short gap, not a synchronous guarantee either.
 */
async function expectFocusNotLost(page: Page, afterWhat: string) {
  await expect
    .poll(() => activeElementSummary(page), {
      message: `focus after ${afterWhat}`,
      timeout: 2_000,
    })
    .not.toBe("BODY");
}

test("the entire spine, keyboard only, in one sitting: sign-in through share", async ({
  page,
}) => {
  // --- Sign-in ---
  await page.goto("/sign-in");
  await page.getByLabel("Email").focus();
  await page.keyboard.type("dev@example.com");
  await page.getByRole("button", { name: "Send magic link" }).focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Continue (dev - no backend yet)" })
    .focus();
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await expectFocusNotLost(page, "sign-in");

  // Sign-in lands on the app home, not /targets directly.
  await page.getByRole("link", { name: "Targets" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/targets$/);
  await expectFocusNotLost(page, "navigating from home to targets");

  // --- Target: register a fresh one (its own scan starts clean) ---
  await page.getByRole("button", { name: "Add a target" }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").focus();
  await page.keyboard.type("Keyboard Spine");
  await dialog.getByLabel("Address").focus();
  await page.keyboard.type("https://keyboard-spine.example.com");
  await dialog.getByRole("combobox", { name: "Environment" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("option", { name: "staging", exact: true }).focus();
  await page.keyboard.press("Enter");
  await dialog.getByRole("button", { name: "Register target" }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expectFocusNotLost(page, "registering a target (dialog close)");

  const row = page.getByRole("row").filter({ hasText: "Keyboard Spine" });
  await expect(row).toBeVisible();

  // --- Scan ---
  await row.getByRole("button", { name: "Scan", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(row).toContainText("Complete", { timeout: 10_000 });

  // --- Inventory ---
  await row.getByRole("link", { name: "Inventory" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/inventory$/);
  await expectFocusNotLost(page, "navigating to inventory");
  await expect(
    page.getByRole("heading", { level: 1, name: /element inventory/ }),
  ).toBeVisible();

  // --- Compose ---
  await page.goBack();
  await page.waitForURL(/\/targets$/);
  const composeRow = page
    .getByRole("row")
    .filter({ hasText: "Keyboard Spine" });
  await composeRow.getByRole("link", { name: "Compose test" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/compose$/);
  await expectFocusNotLost(page, "navigating to compose");

  await page.getByLabel("What do you want to test?").focus();
  await page.keyboard.type("writes: keyboard spine intent");
  await page.getByRole("button", { name: "Propose a plan" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Proposed - nothing has run")).toBeVisible({
    timeout: 10_000,
  });
  await expectFocusNotLost(page, "a plan proposal arriving in place");

  // --- Approve ---
  await page
    .getByRole("button", { name: /^Approve and run \d+ steps?$/ })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("run-started")).toBeVisible({
    timeout: 10_000,
  });
  await expectFocusNotLost(page, "approving a plan (run started in place)");

  // --- Watch ---
  await page.getByRole("link", { name: "Watch this run" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/runs\/run_/);
  await expectFocusNotLost(page, "navigating to watch the run");

  // --- Result ---
  await expect(page.getByTestId("run-status")).toHaveAttribute(
    "data-status",
    /passed|failed/,
    { timeout: 20_000 },
  );
  await expectFocusNotLost(page, "a run finishing in place");

  // --- Share ---
  await page.getByRole("button", { name: "Create a public link" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("share-on")).toBeVisible();
  await expectFocusNotLost(
    page,
    "creating a share link (panel updated in place)",
  );

  await page.getByRole("link", { name: "View public page" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/p\//);
  await expectFocusNotLost(page, "navigating to the public proof page");
  await expect(page.getByTestId("proof-verdict")).toBeVisible();

  await page.screenshot({
    path: "test-results/keyboard-spine-end.png",
    fullPage: true,
  });
});
