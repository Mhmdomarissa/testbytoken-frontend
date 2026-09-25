import { expect, test, type Locator } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * UI v2 V2: the overview dashboard renders only what GET /overview says.
 * New tests for new behaviour; no existing spec is changed except
 * cold-start's heading literal (the page title is now "Overview").
 */
test.beforeEach(async ({ page }) => {
  await signIn(page);
});

async function number(el: Locator): Promise<number> {
  return Number((await el.textContent())?.trim());
}

test("the KPIs, the chart and its text alternative all show the same server numbers", async ({
  page,
}) => {
  await page.goto("/overview");
  const runsCard = page.getByTestId("kpi-runs");
  await expect(runsCard).toBeVisible();

  // The runs KPI total is the sum of its own printed counts.
  const total = await number(runsCard.locator("p.text-3xl"));
  const counts = await runsCard
    .locator("li span.font-semibold")
    .allTextContents();
  expect(counts.reduce((n, c) => n + Number(c), 0)).toBe(total);

  // The chart's hidden table: one row per day in range (30 by default),
  // and its per-verdict columns add up to the same totals as the KPI.
  const table = page.getByTestId("runs-chart").locator("table");
  await expect(table.locator("tbody tr")).toHaveCount(30);
  const rows = await table
    .locator("tbody tr")
    .evaluateAll((trs) =>
      trs.map((tr) =>
        [...tr.querySelectorAll("td")].map((td) => Number(td.textContent)),
      ),
    );
  const tableTotal = rows.flat().reduce((n, c) => n + c, 0);
  expect(tableTotal).toBe(total);

  // The time zone is stated.
  await expect(page.getByTestId("runs-chart")).toContainText(/Days in /);
});

test("the range switch changes the window, and the URL says so", async ({
  page,
}) => {
  await page.goto("/overview");
  const table = page.getByTestId("runs-chart").locator("table");
  await expect(table.locator("tbody tr")).toHaveCount(30);

  await page.getByRole("button", { name: "7 days" }).click();
  await expect(page).toHaveURL(/range=7d/);
  await expect(page.getByRole("button", { name: "7 days" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(table.locator("tbody tr")).toHaveCount(7);
});

test("if /overview fails, every card says so with a retry - never zeros", async ({
  page,
}) => {
  await page.goto("/overview?simulate_error=true");
  const failed = page.getByTestId("overview-failed");
  await expect(failed).toBeVisible();
  await expect(failed.getByText("Couldn't load")).toHaveCount(6);
  await expect(failed.getByRole("button", { name: "Retry" })).toHaveCount(6);
  // No KPI number was drawn from nothing.
  await expect(page.getByTestId("kpi-runs")).toHaveCount(0);
  await expect(failed.locator("p.text-3xl")).toHaveCount(0);
});

test("a workspace with no targets gets the getting-started checklist, from server counts", async ({
  page,
}) => {
  await page.goto("/overview?simulate=new_account");
  const checklist = page.getByTestId("getting-started");
  await expect(checklist).toBeVisible();
  await expect(checklist).toContainText("0 of 4 done");
  await expect(checklist.locator('[data-done="false"]')).toHaveCount(4);
  // The KPI row is replaced, not shown with zeros.
  await expect(page.getByTestId("kpi-runs")).toHaveCount(0);
  // The chart still says, plainly, that nothing has finished.
  await expect(page.getByTestId("runs-chart")).toContainText(
    "No finished runs in these 30 days.",
  );
});

test("the latest suite run links to that run, and its verdict is the page's one filled chip", async ({
  page,
}) => {
  await page.goto("/overview");
  const card = page.getByTestId("kpi-latest");
  const link = card.getByRole("link").first();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/runs\/run_/);
  await expect(page.locator('[data-variant="filled"]')).toHaveCount(1);
  await expect(card.locator('[data-variant="filled"]')).toHaveCount(1);
});
