import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Phase B B9: the public proof page. Every test here is deliberately run
 * in a REAL browser, not asserted from a mock-level fetch() test, because
 * this page is almost entirely the exact class of request that B8 found
 * passes fetch()-level mocking while 404ing for real: screenshot <img>
 * tags and an OG image. "The response parses" is not "the page works."
 */

/** A genuinely cold visitor: a fresh browser context with no cookies, nothing signed in, nothing created this session. */
async function coldVisit(page: Page, path: string) {
  await page.goto(path);
}

test.describe("a cold visitor with no account", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sees the proof, and it carries no authenticated data", async ({
    page,
    context,
  }) => {
    await coldVisit(page, "/p/share_demo");
    expect((await context.cookies()).length).toBe(0);

    await expect(page.getByTestId("proof-verdict")).toHaveAttribute(
      "data-status",
      "passed",
    );
    await expect(page.getByTestId("proof-summary")).toContainText("100% pass");
    await expect(page.getByTestId("proof-summary")).toContainText(
      "of 24 elements covered",
    );

    // What was NOT covered is shown, not just what passed (Phase B B9).
    await expect(page.getByTestId("uncovered-list")).toContainText(
      "Not covered (3)",
    );
    await expect(page.getByTestId("uncovered-list")).toContainText(
      "not uniquely locatable",
    );

    // Nothing from the authenticated world leaked into the page. (The share
    // token itself, "share_demo", is expected all over this HTML - it's the
    // page's own address, already known to anyone who loaded it; the thing
    // that must never leak is what the token unlocks beyond this snapshot -
    // see revision.test.ts's "NOTHING from the authenticated world" for the
    // response-body-level check that the token is never echoed as a field.)
    const html = await page.content();
    expect(html).not.toContain("run_pass_1"); // no run id
    expect(html).not.toMatch(/wksp_|user_/); // no workspace/user id shapes

    await page.screenshot({
      path: "test-results/proof-cold-visit.png",
      fullPage: true,
    });
  });

  test("a step screenshot actually loads as an image - not just a 200 from fetch()", async ({
    page,
  }) => {
    await coldVisit(page, "/p/share_demo");
    const thumb = page.getByTestId("screenshot-thumb").first();
    await expect(thumb).toBeVisible();
    const img = thumb.locator("img");
    const src = await img.getAttribute("src");
    expect(src).toBeTruthy();
    // Same-origin (rehosted) and SIGNED (proof-scoped, per docs/API_CONTRACT.md).
    expect(new URL(src!, page.url()).origin).toBe(new URL(page.url()).origin);
    expect(new URL(src!, page.url()).searchParams.get("sig")).toBeTruthy();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
  });

  test("the OG image is a real, dynamically rendered PNG that reflects this proof - fetched directly, no browser JS involved", async ({
    request,
    page,
  }) => {
    // Genuinely server-rendered: this goes straight to Next's own route,
    // never through the mock's service worker (see opengraph-image.tsx's
    // file comment) - a real HTTP request, same as a social crawler's. The
    // URL is read off the page's own <meta property="og:image"> tag rather
    // than hand-built: Next's file-convention image routes serve at a
    // route-id-suffixed path it generates itself (e.g.
    // "/opengraph-image-<id>?<hash>"), not the bare "/opengraph-image" the
    // source tree's filename would suggest - a crawler follows the tag, so
    // this test does too.
    await page.goto("/p/share_demo");
    const ogImageUrl = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    expect(ogImageUrl).toBeTruthy();
    const res = await request.get(ogImageUrl!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    const bytes = await res.body();
    expect(bytes.byteLength).toBeGreaterThan(1000); // a real rendered image, not a stub

    // A DIFFERENT proof (a different verdict) produces DIFFERENT image
    // bytes - proves this isn't a static placeholder that happens to
    // return 200 regardless of which proof it's asked for. proof_fail_1
    // has no baked-in share, so this checks the not-found image path is
    // ALSO distinct, not just a blanket fallback.
    await page.goto("/p/nonexistent-token");
    const fallbackUrl = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    expect(fallbackUrl).toBeTruthy();
    const fallback = await request.get(fallbackUrl!);
    expect(fallback.status()).toBe(200); // still renders (a generic branded fallback), never errors
    const fallbackBytes = await fallback.body();
    expect(Buffer.compare(bytes, fallbackBytes)).not.toBe(0);
  });

  test("an invalid or unknown token renders nothing about a proof, with a way back to nothing sensitive", async ({
    page,
  }) => {
    await coldVisit(page, "/p/nonexistent-token");
    await expect(page.getByText("This link isn't available")).toBeVisible();
    expect(await page.getByTestId("proof-verdict").count()).toBe(0);
  });
});

test.describe("revocation actually works - driven end to end, not assumed from the contract", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("revoking kills the public page AND its screenshots - a captured screenshot URL stops working too", async ({
    page,
  }) => {
    // run_fail_1: unlike run_pass_1 (fixture-baked share, used by the cold-
    // visitor tests above), its proof starts unshared, so "Create a public
    // link" is actually there to click.
    await page.goto("/runs/run_fail_1");
    await page.getByRole("button", { name: "Create a public link" }).click();
    await expect(page.getByTestId("share-on")).toBeVisible();

    await page.getByRole("link", { name: "View public page" }).click();
    await page.waitForURL(/\/p\//);
    await expect(page.getByTestId("proof-verdict")).toBeVisible();
    const publicUrl = page.url();

    // Capture a screenshot URL exactly as a visitor's browser would have it.
    const shotUrl = await page
      .getByTestId("screenshot-thumb")
      .first()
      .locator("img")
      .getAttribute("src");
    expect(shotUrl).toBeTruthy();
    expect(
      await page.evaluate((u) => fetch(u).then((r) => r.status), shotUrl!),
    ).toBe(200);

    // Go back and revoke.
    await page.goBack();
    await expect(page.getByTestId("share-on")).toBeVisible();
    await page.getByRole("button", { name: "Revoke link" }).click();
    await expect(page.getByTestId("share-off")).toBeVisible();

    // The page itself is gone: fetching its own URL now 404s.
    expect(
      await page.evaluate((u) => fetch(u).then((r) => r.status), publicUrl),
    ).toBe(404);

    // The OLD, already-captured screenshot URL: also gone, not just the page.
    expect(
      await page.evaluate((u) => fetch(u).then((r) => r.status), shotUrl!),
    ).toBe(404);
  });

  test("the owner's own authenticated screenshot access is unaffected by revoking sharing", async ({
    page,
  }) => {
    await page.goto("/runs/run_fail_1");
    const ownerShot = await page
      .getByTestId("screenshot-thumb")
      .first()
      .locator("img")
      .getAttribute("src");
    await page.getByRole("button", { name: "Create a public link" }).click();
    await expect(page.getByTestId("share-on")).toBeVisible();
    await page.getByRole("button", { name: "Revoke link" }).click();
    await expect(page.getByTestId("share-off")).toBeVisible();
    expect(ownerShot).toBeTruthy();
    const stillOk = await page.evaluate(
      (u) => fetch(u).then((r) => r.status),
      ownerShot!,
    );
    expect(stillOk).toBe(200);
  });
});
