import { expect, test } from "@playwright/test";

/**
 * Phase B B10: a cold start - a fresh browser profile, no cache, no
 * service worker registered yet, straight through the spine. Every other
 * e2e file in this suite is tested WARM in one sense or another: MSW's
 * worker already registered and running from a previous navigation in the
 * same test, or storage/state left over from a prior step in the same
 * file. Playwright already gives each test file its own isolated browser
 * context (no cookies, no storage, no service worker registration carried
 * over from another file) - what this file adds on top is the assertion
 * nothing else makes: zero console errors and zero uncaught page errors
 * across the FIRST real run through the spine, and that the first paint of
 * each screen already has the right content - no silent race that
 * "resolves itself" on a second look, which a test that only checks the
 * end state would never catch.
 *
 * MockingProvider.tsx exists specifically to close a race like this (it
 * blocks rendering until the mock's service worker has actually started,
 * rather than firing a request against the real network first and
 * failing) - this is the test that actually drives a cold visit and would
 * fail if that race ever came back.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("sign-in through a completed scan, cold, with no console or page errors along the way", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

  // The very first request this browser ever makes to the app.
  await page.goto("/sign-in");
  await expect(page.getByLabel("Email")).toBeVisible();

  await page.getByLabel("Email").fill("dev@example.com");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page
    .getByRole("button", { name: "Continue (dev - no backend yet)" })
    .click();
  await page.waitForURL(/\/overview$/);

  // The app home renders real content on the FIRST paint, not a
  // permanently-stuck skeleton or an error that only clears on reload.
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Targets" }).click();
  await page.waitForURL(/\/targets$/);
  // The fixture targets load first try - the classic MSW-not-ready-yet
  // race would show an error state here, not a silent retry.
  await expect(page.getByTestId("target-tgt_checkout")).toBeVisible();
  await expect(page.getByTestId("target-tgt_checkout")).toContainText(
    "Complete",
  );

  await page.getByRole("button", { name: "Add a target" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Cold Start");
  await dialog.getByLabel("Address").fill("https://cold-start.example.com");
  await dialog.getByRole("combobox", { name: "Environment" }).click();
  await page.getByRole("option", { name: "staging", exact: true }).click();
  await dialog.getByRole("button", { name: "Register target" }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole("row").filter({ hasText: "Cold Start" });
  await row.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(row).toContainText("Complete", { timeout: 10_000 });

  await row.getByRole("link", { name: "Inventory" }).click();
  await page.waitForURL(/\/inventory$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /element inventory/ }),
  ).toBeVisible();
  await expect(page.getByTestId("module-mod_checkout")).toBeVisible();

  await page.screenshot({
    path: "test-results/cold-start-end.png",
    fullPage: true,
  });

  expect(errors, errors.join("\n")).toEqual([]);
});

test("a direct deep link into the console, cold, with no sign-in flow to warm up the mock first", async ({
  page,
  context,
}) => {
  // The sign-in flow itself takes real wall-clock time (typing, two
  // clicks), which is enough for MockingProvider's worker.start() to
  // resolve well before any authenticated screen fetches - this is a
  // harder case: a bookmarked or shared authenticated URL, hard-loaded
  // with nothing before it to warm anything up. MockingProvider blocking
  // on worker.start() (rather than the old fire-and-forget) is what this
  // exercises; see its file comment for the bug this once was.
  await context.addCookies([
    {
      name: "session",
      value: "demo_user",
      domain: "localhost",
      path: "/",
    },
  ]);

  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

  await page.goto("/targets");
  await expect(page.getByTestId("target-tgt_checkout")).toBeVisible();
  await expect(page.getByTestId("target-tgt_checkout")).toContainText(
    "Complete",
  );

  expect(errors, errors.join("\n")).toEqual([]);
});
