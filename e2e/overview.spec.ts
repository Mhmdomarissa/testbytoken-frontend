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

test("the latest suite run is a FINISHED run with its verdict and pass rate beside coverage; live ones are only counted", async ({
  page,
}) => {
  await page.goto("/overview");
  const card = page.getByTestId("kpi-latest");
  const link = card.getByRole("link").first();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/runs\/run_/);
  // A finished run: a pass rate WITH its coverage, never the pending text.
  await expect(card).toContainText(/\d+% pass/);
  await expect(card).toContainText(/\d+ of \d+ elements covered/);
  await expect(card).not.toContainText("reported when the run finishes");
  await expect(card).toContainText(/Finished /);
  // The fixtures' live suite runs are counted and linked, not shown.
  const live = card.getByTestId("suite-runs-in-progress");
  await expect(live).toContainText(/\d+ suite runs? in progress/);
  await expect(live).toHaveAttribute("href", "/runs");
});

test("the overview has no verdict of its own: every chip on it is quiet", async ({
  page,
}) => {
  await page.goto("/overview");
  await expect(page.getByTestId("kpi-latest")).toBeVisible();
  await expect(page.getByTestId("recent-runs").locator("table")).toBeVisible();
  await expect(page.locator('[data-variant="filled"]')).toHaveCount(0);
});

test.describe("on a 390px phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("recent runs stack, and a finished run's pass rate and coverage are on screen", async ({
    page,
  }) => {
    await page.goto("/overview");
    const stacked = page.getByTestId("recent-runs-stacked");
    await expect(stacked).toBeVisible();
    // The wide table isn't what's showing at this width.
    await expect(page.getByTestId("recent-runs").locator("table")).toBeHidden();

    const finished = stacked
      .locator("li")
      .filter({ has: page.getByRole("link", { name: "run_fail_1" }) });
    const passCoverage = finished.getByText(/\d+% pass/);
    await expect(passCoverage).toBeVisible();
    await expect(finished.getByText(/elements covered/)).toBeVisible();
    // Visible means inside the screen's width, not rendered off to the side.
    const box = (await passCoverage.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    // The status chip isn't clipped either: wholly inside the screen's width.
    const chip = (await finished.getByText("Failed").boundingBox())!;
    expect(chip.x).toBeGreaterThanOrEqual(0);
    expect(chip.x + chip.width).toBeLessThanOrEqual(390);
    // And the page itself doesn't scroll sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
