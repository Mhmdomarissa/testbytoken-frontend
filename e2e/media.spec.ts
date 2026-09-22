import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Regression test for a real bug found building B8: MSW's browser worker
 * only intercepts same-origin subresource loads. The mock's report_url and
 * screenshot_url fixtures point at fake external domains
 * (api.testbytoken.example, screenshots.testbytoken.example) that don't
 * resolve in a real browser - a `fetch()` in a test still "worked" (MSW
 * patches `fetch` directly, regardless of target origin), which is exactly
 * why this went unnoticed until something actually rendered an <img> or an
 * <iframe>. Fixed by rehosting those URLs onto the request's own origin
 * (respond.ts's `rehostMediaUrls`) before they reach the client.
 *
 * Reads the URLs from the RENDERED page (real <img>/<iframe> elements),
 * not a second manual `fetch()` to the same path as the page's own data
 * call - doing that raced against the page's own navigation request to the
 * identical URL and intermittently got the app's own HTML page back
 * instead of the mock's JSON (a separate, narrower quirk in how the mock's
 * API paths can collide with same-named page routes - not reproducible
 * through normal use, only through a redundant same-URL fetch immediately
 * after navigating there).
 */
test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("a step screenshot actually loads as an image, same-origin", async ({
  page,
}) => {
  await page.goto("/runs/run_pass_1");
  const thumb = page.getByTestId("screenshot-thumb").first();
  await expect(thumb).toBeVisible();
  const img = thumb.locator("img");
  const src = await img.getAttribute("src");
  expect(src).toBeTruthy();
  expect(new URL(src!, page.url()).origin).toBe(new URL(page.url()).origin);
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);

  await thumb.click();
  const dialogImg = page.getByRole("dialog").locator("img");
  await expect
    .poll(() => dialogImg.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);
  await page.screenshot({ path: "test-results/run-screenshot-lightbox.png" });
});

test("the engine's report actually loads (its real content, not a 404), sandboxed, and its hostile script never reaches this page", async ({
  page,
}) => {
  const hostileMessages: string[] = [];
  await page.exposeFunction("__recordMessage", (data: string) => {
    hostileMessages.push(data);
  });
  await page.addInitScript(() => {
    window.addEventListener("message", (e) =>
      (
        window as unknown as { __recordMessage: (d: string) => void }
      ).__recordMessage(String(e.data)),
    );
  });

  await page.goto("/runs/run_pass_1");
  const frame = page.getByTestId("engine-report");
  await expect(frame).toBeVisible();
  // srcDoc, not src: the content arrived over fetch(), not an iframe
  // navigation (see EngineReport.tsx's comment on why).
  expect(await frame.getAttribute("src")).toBeNull();
  expect(await frame.getAttribute("srcdoc")).toBeTruthy();
  expect(await frame.getAttribute("sandbox")).toBe("");

  // The report's REAL content is there - proves this isn't Next's own 404
  // page (which was the actual failure mode found while building this:
  // an <iframe src="..."> pointed straight at the mock went to the real
  // network, past the service worker entirely, and 404'd).
  const frameBody = page
    .frameLocator('[data-testid="engine-report"]')
    .locator("body");
  await expect(frameBody).toContainText("run_pass_1");
  await expect(frameBody).toContainText("navigate");
  await expect(
    page.frameLocator('[data-testid="engine-report"]').locator("#hostile"),
  ).toHaveCount(1);

  // ...and its hostile script (handlers/runs.ts's fixture: an inline
  // <script> and an onerror handler both trying to postMessage the
  // parent) never ran - if it had, this listener would have caught it.
  await page.waitForTimeout(1000);
  expect(hostileMessages).toEqual([]);
  await page.screenshot({ path: "test-results/run-engine-report.png" });
});

test("share: create a public link, copy it, then revoke it", async ({
  page,
}) => {
  await page.goto("/runs/run_pass_1");
  await expect(page.getByTestId("share-off")).toBeVisible();

  await page.getByRole("button", { name: "Create a public link" }).click();
  const on = page.getByTestId("share-on");
  await expect(on).toBeVisible();
  const link = on.getByRole("textbox");
  const url = await link.inputValue();
  expect(url).toMatch(/^https:\/\/testbytoken\.example\/p\//);
  await page.screenshot({ path: "test-results/run-share-on.png" });

  await page.getByRole("button", { name: "Revoke link" }).click();
  await expect(page.getByTestId("share-off")).toBeVisible();
});
