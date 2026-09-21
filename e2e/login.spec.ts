import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Phase B B6 in a real browser: the interactive-login handoff. The customer
 * signs in inside a live browser we hand them; this app only tracks the
 * session's state. Nothing on these pages can receive a credential, and the
 * short-lived ticket in the live-browser URL is never stored or printed.
 */

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

const noCredentialSurface = async (page: Page) => {
  await expect(
    page.locator(
      "input, textarea, select, [type=password], [contenteditable=true]",
    ),
  ).toHaveCount(0);
};

async function startSession(page: Page, targetId = "tgt_checkout") {
  await page.goto(`/targets/${targetId}/login`);
  await page.getByRole("button", { name: "Start a live browser" }).click();
}

test("not started: explains the handoff, promises no credentials touch this app, and has nothing to type into", async ({
  page,
}) => {
  await page.goto("/targets/tgt_checkout/login");
  const notStarted = page.getByTestId("login-not-started");
  await expect(notStarted).toContainText("you do it yourself");
  await expect(notStarted).toContainText(
    "never asks for, receives or stores your password",
  );
  await noCredentialSurface(page);
  await page.screenshot({ path: "test-results/login-not-started.png" });
});

test("provisioning -> ready -> connected -> completed, driven by the server's reported state", async ({
  page,
}) => {
  await startSession(page);
  await expect(page.getByTestId("login-provisioning")).toBeVisible();
  await expect(page.getByTestId("login-ready")).toBeVisible({ timeout: 8_000 });

  // The browser link: new tab, no opener, no referrer, host shown, ticket never shown.
  const link = page.getByTestId("open-browser");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  const href = (await link.getAttribute("href"))!;
  expect(new URL(href).origin).not.toBe(new URL(page.url()).origin);
  const ticket = new URL(href).searchParams.get("ticket")!;
  expect(ticket.length).toBeGreaterThan(4);
  await expect(page.getByTestId("login-ready")).toContainText(
    "live-browser.testbytoken.example",
  );
  await expect(page.locator("body")).not.toContainText(ticket);
  await page.screenshot({ path: "test-results/login-ready.png" });

  // The customer "connects" (server-side), and the state follows.
  await expect(page.getByTestId("login-in_progress")).toBeVisible({
    timeout: 8_000,
  });
  await noCredentialSurface(page);

  await page.getByRole("button", { name: "I've finished signing in" }).click();
  await expect(page.getByTestId("login-completed")).toBeVisible();
  await expect(page.getByTestId("login-completed")).toContainText(
    "We captured your session",
  );
  await page.screenshot({ path: "test-results/login-completed.png" });

  // The ticket went nowhere: not in the address bar, not in web storage.
  expect(page.url()).not.toContain(ticket);
  expect(page.url()).not.toContain("ticket");
  const stored = await page.evaluate(
    () =>
      JSON.stringify({ ...localStorage }) +
      JSON.stringify({ ...sessionStorage }) +
      document.cookie,
  );
  expect(stored).not.toContain(ticket);
  await noCredentialSurface(page);
});

test("saying you're done before the browser was opened fails honestly: we check, we don't take your word", async ({
  page,
}) => {
  await startSession(page);
  await expect(page.getByTestId("login-ready")).toBeVisible({ timeout: 8_000 });
  await page.getByRole("button", { name: "I've finished signing in" }).click();
  const failed = page.getByTestId("login-failed");
  await expect(failed).toBeVisible();
  await expect(failed).toContainText("We didn't see a signed-in session");
  await expect(failed).toContainText("We check for a real signed-in session");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("login-not-started")).toBeVisible();
});

test("a browser that can't start is a designed failure with a retry", async ({
  page,
}) => {
  await startSession(page, "tgt_unreachable");
  const failed = page.getByTestId("login-failed");
  await expect(failed).toBeVisible({ timeout: 8_000 });
  await expect(failed).toContainText("We couldn't start a browser");
  await expect(failed).toContainText("Nothing was captured");
  await page.screenshot({ path: "test-results/login-failed.png" });
});

test("cancelling abandons the session and says nothing was captured", async ({
  page,
}) => {
  await startSession(page);
  await expect(page.getByTestId("login-ready")).toBeVisible({ timeout: 8_000 });
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("login-cancelled")).toContainText(
    "Nothing was captured",
  );
});

test("a scan that parked waiting for a sign-in: sign in, then continue the same scan", async ({
  page,
}) => {
  await page.goto("/targets");
  await page.getByRole("button", { name: "Add a target" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Members");
  await dialog.getByLabel("Address").fill("https://login.example.com");
  await dialog.getByRole("combobox", { name: "Environment" }).click();
  await page.getByRole("option", { name: "staging", exact: true }).click();
  await dialog.getByRole("button", { name: "Register target" }).click();
  const row = page.getByRole("row").filter({ hasText: "Members" });
  await row.getByRole("button", { name: "Scan", exact: true }).click();

  await expect(row).toContainText("Needs sign-in", { timeout: 10_000 });
  await page.screenshot({ path: "test-results/login-parked.png" });
  await row.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login\?scan=scan_/);

  await page.getByRole("button", { name: "Start a live browser" }).click();
  await expect(page.getByTestId("login-in_progress")).toBeVisible({
    timeout: 12_000,
  });
  await page.getByRole("button", { name: "I've finished signing in" }).click();
  await expect(page.getByTestId("login-completed")).toBeVisible();

  // The scan that was waiting is offered, not a new one.
  await page
    .getByRole("button", { name: "Continue the scan that was waiting for you" })
    .click();
  await expect(page).toHaveURL(/\/targets$/);
  await expect(
    page.getByRole("row").filter({ hasText: "Members" }),
  ).toContainText("Complete", { timeout: 10_000 });
});

test("unknown target and unknown session each say so", async ({ page }) => {
  await page.goto("/targets/tgt_nope/login");
  await expect(page.getByText("Target not found")).toBeVisible();
  await page.goto("/targets/tgt_checkout/login?session=lgn_nope");
  await expect(page.getByText("Sign-in not found")).toBeVisible();
});
