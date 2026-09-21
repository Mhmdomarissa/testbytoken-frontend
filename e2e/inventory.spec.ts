import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Phase B B4 in a real browser: the element inventory, and the states
 * around it (never scanned, not finished, failed, empty, unknown target,
 * hostile content).
 */

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

async function openCheckoutInventory(page: Page) {
  await page.goto("/targets");
  await page
    .getByTestId("target-tgt_checkout")
    .getByRole("link", { name: "Inventory" })
    .click();
  await expect(
    page.getByRole("heading", { name: /Checkout - element inventory/ }),
  ).toBeVisible();
  await expect(page.getByTestId("module-mod_checkout")).toBeVisible();
  await expect(page.locator('[data-testid^="element-"]').first()).toBeVisible();
}

test("shows what the system knows, and surfaces what it cannot locate", async ({
  page,
}) => {
  await openCheckoutInventory(page);

  const summary = page.getByTestId("inventory-summary");
  await expect(summary).toContainText("30 elements");
  await expect(summary).toContainText("21 uniquely locatable");

  // The callout is up front, not buried, and states the number.
  const callout = page.getByTestId("not-unique-callout");
  await expect(callout).toContainText(
    "9 of 30 elements can't be uniquely located",
  );

  // Every row says what it is: role, label, locator, how it is found.
  const submit = page.getByTestId("element-el_submit");
  await expect(submit).toContainText("button");
  await expect(submit).toContainText("Submit");
  await expect(submit).toContainText("#submit");
  await expect(submit).toContainText("css");
  await expect(submit).toContainText("Unique");

  // Not-unique elements come first on their page, marked with words and a reason.
  const firstRow = page
    .getByTestId("module-mod_checkout")
    .locator("tbody tr")
    .first();
  await expect(firstRow).toHaveAttribute("data-locatable", "no");
  await expect(firstRow).toContainText("Not unique");
  await expect(page.getByTestId("element-el_duplicate")).toContainText(
    "duplicate locator",
  );
  await expect(page.locator('[data-locatable="no"]')).toHaveCount(9);
  await page.screenshot({
    path: "test-results/inventory-main.png",
    fullPage: true,
  });
});

test("a module where nothing can be uniquely located says so, prominently", async ({
  page,
}) => {
  await openCheckoutInventory(page);
  await expect(page.getByTestId("module-none-locatable")).toContainText(
    "None of these elements can be uniquely located",
  );
  // Its server-reported header agrees with its inventory: no disagreement banner.
  await expect(page.getByTestId("inventory-disagreement")).toHaveCount(0);
});

test("searching narrows the list and says what it hid; the filter is reversible", async ({
  page,
}) => {
  await openCheckoutInventory(page);
  await page.getByLabel("Search elements").fill("cvc");
  await expect(page.locator('[data-testid^="element-"]')).toHaveCount(1);
  await expect(page.getByTestId("element-el_checkout_3")).toBeVisible();
  await expect(page.getByTestId("module-mod_checkout")).toContainText(
    "Showing 1 of 24 elements in this module (filtered)",
  );
  await expect(page.getByTestId("module-mod_settings")).toContainText(
    "No elements in this module match",
  );

  await page.getByLabel("Search elements").fill("zzz-no-such");
  await expect(page.locator('[data-testid^="element-"]')).toHaveCount(0);

  await page.getByLabel("Search elements").fill("");
  await expect(page.locator('[data-testid^="element-"]')).toHaveCount(30);
});

test("'Show only these' isolates the not-uniquely-locatable elements", async ({
  page,
}) => {
  await openCheckoutInventory(page);
  await page.getByRole("button", { name: "Show only these" }).click();
  await expect(page.locator('[data-testid^="element-"]')).toHaveCount(9);
  await expect(page.locator('[data-locatable="yes"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Show all elements" }).click();
  await expect(page.locator('[data-testid^="element-"]')).toHaveCount(30);
});

test("hostile content is inert text and cannot break the layout", async ({
  page,
}) => {
  await openCheckoutInventory(page);

  // A label that is markup renders as the characters, not as an element.
  const hostile = page.getByTestId("element-el_checkout_15");
  await expect(hostile).toContainText("<img src=x onerror=alert(1)> Gift note");
  await expect(page.locator("img[src='x']")).toHaveCount(0);

  // The XSS page title (module 2) is visible as text.
  await expect(page.getByTestId("module-mod_settings")).toContainText(
    "<img src=x onerror=alert(1)>",
  );

  // Long label / very long locator: truncated, page does not scroll sideways.
  await expect(page.getByTestId("element-el_long_label")).toBeVisible();
  await expect(
    page.getByTestId("element-el_checkout_long_locator"),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // Nothing scraped became a link: only our own navigation links exist here.
  const hrefs = await page
    .locator("main a")
    .evaluateAll((as) =>
      as.map((a) => (a as HTMLAnchorElement).getAttribute("href")),
    );
  for (const href of hrefs) expect(href).toMatch(/^\/targets/);
});

test("a scan that found nothing is a designed empty state", async ({
  page,
}) => {
  await page.goto("/targets");
  await page.getByRole("button", { name: "Add a target" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Blank");
  await dialog.getByLabel("Address").fill("https://empty.example.com");
  await dialog.getByRole("combobox", { name: "Environment" }).click();
  await page.getByRole("option", { name: "staging", exact: true }).click();
  await dialog.getByRole("button", { name: "Register target" }).click();
  const row = page.getByRole("row").filter({ hasText: "Blank" });
  await row.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(row).toContainText("Complete", { timeout: 10_000 });
  await row.getByRole("link", { name: "Inventory" }).click();

  await expect(page.getByText("The scan found nothing to test")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to targets" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/inventory-empty.png" });
});

test("no inventory yet: never scanned, failed, and unknown targets each say why", async ({
  page,
}) => {
  await page.goto("/targets/tgt_empty/inventory");
  await expect(page.getByText("This target hasn't been scanned")).toBeVisible();

  await page.goto("/targets/tgt_unreachable/inventory");
  await expect(
    page.getByText("There is no finished scan to show yet"),
  ).toBeVisible();
  await expect(page.getByText("Failed", { exact: true })).toBeVisible();

  await page.goto("/targets/tgt_nope/inventory");
  await expect(page.getByText("Target not found")).toBeVisible();
});
