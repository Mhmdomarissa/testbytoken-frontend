import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Focus never moves because something finished loading. The share panel
 * used to take focus when the proof arrived, which scrolled a finished run
 * to the bottom of the page - past its verdict - and left focus somewhere
 * the person never put it. It now takes focus only in response to the
 * person's own action.
 */

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("a finished run opens at the top, on its verdict, with focus where the route change put it", async ({
  page,
}) => {
  await page.goto("/runs");
  // A client-side navigation, so focus is ShellMain's to place (B10).
  await page.getByRole("link", { name: "run_fail_1" }).click();
  await expect(page.getByTestId("run-status")).toHaveAttribute(
    "data-status",
    "failed",
  );
  // Let the proof - and with it the share panel - finish loading.
  await expect(page.getByTestId("share-off")).toBeVisible();
  await page.waitForTimeout(500);

  expect(
    await page.evaluate(() => document.activeElement?.tagName),
    "focus moved off <main> when the share panel loaded",
  ).toBe("MAIN");
  expect(
    await page.evaluate(() => document.scrollingElement!.scrollTop),
    "the page scrolled away from the verdict when the share panel loaded",
  ).toBe(0);
  await expect(page.getByTestId("run-status")).toBeInViewport();
});

test("creating a link moves focus to the new link; revoking it moves focus to the button that creates one", async ({
  page,
}) => {
  await page.goto("/runs/run_fail_1");
  await page.getByRole("button", { name: "Create a public link" }).click();
  await expect(page.getByTestId("share-on")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Public link to this proof" }),
  ).toBeFocused();

  await page.getByRole("button", { name: "Revoke link" }).click();
  await expect(page.getByTestId("share-off")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create a public link" }),
  ).toBeFocused();
});
