import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Phase B B3 in a real browser, against the mock: register a target
 * (client validation first), see its last scan, trigger a scan and watch
 * it move through the lifecycle mock's real timing, and land on a designed
 * failure state for every failure kind the contract defines.
 */

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.goto("/targets");
  await expect(page.getByTestId("target-tgt_checkout")).toBeVisible();
});

async function register(
  page: Page,
  { name, url, env = "staging" }: { name: string; url: string; env?: string },
) {
  await page.getByRole("button", { name: "Add a target" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Address").fill(url);
  await dialog.getByRole("combobox", { name: "Environment" }).click();
  await page.getByRole("option", { name: env, exact: true }).click();
  await dialog.getByRole("button", { name: "Register target" }).click();
  await expect(dialog).toBeHidden();
  return page.getByRole("row").filter({ hasText: name });
}

test("the list shows every target with its last scan state - never blank", async ({
  page,
}) => {
  await expect(page.locator('[data-testid^="target-"]')).toHaveCount(3);
  await expect(page.getByTestId("target-tgt_checkout")).toContainText(
    "Complete",
  );
  await expect(page.getByTestId("target-tgt_empty")).toContainText(
    "Never scanned",
  );
  // A target whose last scan failed shows WHY on first load, not just "Failed".
  await expect(page.getByTestId("target-tgt_unreachable")).toContainText(
    "Failed",
  );
  await expect(page.getByTestId("scan-failure")).toContainText(
    "legacy-admin.example.com",
  );
  await page.screenshot({ path: "test-results/targets-list.png" });
});

test("client-side validation says what is wrong, sends nothing, and refuses credentials in a URL", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add a target" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Register target" }).click();
  await expect(dialog.getByText("Give the target a name.")).toBeVisible();
  await expect(
    dialog.getByText("Enter the address of the application."),
  ).toBeVisible();
  await expect(dialog.getByText("Choose which environment")).toBeVisible();

  await dialog.getByLabel("Name").fill("Staging");
  await dialog.getByLabel("Address").fill("staging.example.com");
  await dialog.getByRole("button", { name: "Register target" }).click();
  await expect(
    dialog.getByText("Start the address with https://"),
  ).toBeVisible();

  await dialog
    .getByLabel("Address")
    .fill("https://admin:hunter2@staging.example.com");
  await dialog.getByRole("button", { name: "Register target" }).click();
  await expect(
    dialog.getByText(/never take credentials in a URL/),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/targets-validation.png" });

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page.locator('[data-testid^="target-"]')).toHaveCount(3); // nothing was registered
});

test("register, scan, and watch it progress to complete", async ({ page }) => {
  const row = await register(page, {
    name: "Shop",
    url: "https://shop.example.com",
  });
  await expect(row).toContainText("Never scanned");

  await row.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Scan", exact: true }),
  ).toBeDisabled();
  await expect(row).toContainText(/queued|scanning/i);
  await expect(row).toContainText("Scanning", { timeout: 5_000 });
  await page.screenshot({ path: "test-results/targets-scanning.png" });
  await expect(row).toContainText("Complete", { timeout: 10_000 });
  await expect(
    row.getByRole("button", { name: "Scan", exact: true }),
  ).toBeEnabled();
  await expect(
    row.locator("xpath=following-sibling::tr[1]").getByTestId("scan-failure"),
  ).toHaveCount(0);
});

const FAILURES: [
  kind: string,
  url: string,
  headline: RegExp,
  serverMessage: RegExp,
  retry: boolean,
][] = [
  [
    "unreachable",
    "https://unreachable.example.com",
    /couldn't reach the site/i,
    /the name did not resolve/,
    true,
  ],
  [
    "refused",
    "https://refused.example.com",
    /refused our scanner/i,
    /403 Forbidden/,
    true,
  ],
  [
    "timeout",
    "https://slow.example.com",
    /too slow/i,
    /within 30 seconds/,
    true,
  ],
  [
    "internal",
    "https://broken.example.com",
    /our scanner failed/i,
    /This was our fault/,
    true,
  ],
  [
    "blocked_by_guardrail",
    "http://localhost:3000",
    /can't be scanned/i,
    /private or internal address/,
    false,
  ],
];

for (const [kind, url, headline, serverMessage, retry] of FAILURES) {
  test(`a failed scan (${kind}) is a designed state that says what happened and what to do`, async ({
    page,
  }) => {
    const name = `T-${kind}`;
    const row = await register(page, { name, url });
    await row.getByRole("button", { name: "Scan", exact: true }).click();

    // The row right after the target's own row holds its failure panel.
    const panel = row
      .locator("xpath=following-sibling::tr[1]")
      .getByTestId("scan-failure");
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel).toHaveAttribute("data-failure-kind", kind);
    await expect(panel).toContainText(headline);
    // The server's own message is shown too (it carries the specifics).
    await expect(panel).toContainText(serverMessage);
    await expect(row).toContainText("Failed");

    const again = panel.getByRole("button", { name: "Scan again" });
    if (retry) await expect(again).toBeVisible();
    else await expect(again).toHaveCount(0);
    await page.screenshot({ path: `test-results/targets-failed-${kind}.png` });
  });
}

test("Change address from a failed scan edits the target, and the next scan completes", async ({
  page,
}) => {
  const row = page.getByTestId("target-tgt_unreachable");
  await row
    .locator("xpath=following-sibling::tr[1]")
    .getByRole("button", { name: "Change address" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Address")).toHaveValue(
    "https://legacy-admin.example.com",
  );
  await dialog.getByLabel("Address").fill("https://legacy-admin.example.org");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("legacy-admin.example.org");

  await row.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(row).toContainText("Complete", { timeout: 10_000 });
  await expect(
    row.locator("xpath=following-sibling::tr[1]").getByTestId("scan-failure"),
  ).toHaveCount(0);
});
