import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * UI v2 V1: the console shell. New behaviour gets new tests; nothing in
 * the existing specs is changed.
 */
test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("the theme can be overridden, is remembered, and 'System' hands it back", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/targets");
  const html = page.locator("html");
  await expect(html).toHaveClass(/\blight\b/);

  await page.getByRole("button", { name: /^Theme:/ }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(html).toHaveClass(/\bdark\b/);

  // Remembered across a full load, even though the system says light.
  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(10, 17, 32)",
  );

  await page.getByRole("button", { name: /^Theme:/ }).click();
  await page.getByRole("menuitemradio", { name: "System" }).click();
  await expect(html).toHaveClass(/\blight\b/);
});

test("⌘B collapses the sidebar to an icon rail; its links keep their names", async ({
  page,
}) => {
  await page.goto("/targets");
  const sidebar = page.locator('[data-slot="sidebar"]');
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
  await page.keyboard.press("ControlOrMeta+b");
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await expect(
    sidebar.getByRole("link", { name: "Runs", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+b");
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
});

test("breadcrumbs: the section links back, the current crumb is not a link", async ({
  page,
}) => {
  await page.goto("/runs/run_fail_1");
  const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(crumbs.getByRole("link", { name: "Runs" })).toHaveAttribute(
    "href",
    "/runs",
  );
  const current = crumbs.locator('[aria-current="page"]');
  await expect(current).toHaveText("run_fail_1");
  await expect(crumbs.getByRole("link", { name: "run_fail_1" })).toHaveCount(0);
});

test("New test: every target is listed; only a scanned one can be chosen, and Enter goes to compose", async ({
  page,
}) => {
  await page.goto("/overview");
  await page.getByRole("button", { name: "New test" }).click();
  const dialog = page.getByRole("dialog", { name: "New test" });
  await expect(dialog).toBeVisible();

  // Unscanned and failed targets are listed, disabled, with their reason.
  await expect(
    dialog.getByRole("option", { name: /Freshly added target.*Never scanned/ }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    dialog.getByRole("option", { name: /Legacy admin.*Last scan failed/ }),
  ).toHaveAttribute("aria-disabled", "true");

  // Exactly one ready target: preselected, but the picker still asks.
  const checkout = dialog.getByRole("option", { name: /^Checkout/ });
  await expect(checkout).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/targets\/tgt_checkout\/compose$/);
});

test("the engine card says what this page last heard, and when", async ({
  page,
}) => {
  await page.goto("/targets");
  const card = page.getByTestId("engine-status");
  await expect(card).toContainText("Engine ready");
  await expect(card).toContainText(/Checked (just now|\d+ s ago)/);
});

test("with demo mode off (this build), there is no demo banner", async ({
  page,
}) => {
  await page.goto("/targets");
  await expect(page.getByRole("note", { name: "Demonstration" })).toHaveCount(
    0,
  );
});

test("the user menu opens, offers the theme, and signs out", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/targets");
  await page.getByRole("button", { name: "demo@testbytoken.example" }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(
    menu.getByRole("menuitemradio", { name: "System" }),
  ).toBeVisible();
  await menu.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(/\/sign-in$/);
  expect(errors).toEqual([]);
});
