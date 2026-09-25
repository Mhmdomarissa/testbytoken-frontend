import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * The engine card's poll, in a real browser: 30 s while visible, nothing
 * while the tab is hidden, an immediate check on return. The clock is
 * Playwright's (fast-forwarded), the requests are counted as the page
 * actually makes them.
 */
async function setVisibility(page: Page, state: "visible" | "hidden") {
  await page.evaluate((s) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => s,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

test("polls every 30 s while visible, stops while hidden, re-checks on return", async ({
  page,
}) => {
  await signIn(page);
  await page.clock.install();
  const isPoll = (url: string) =>
    /\/workspaces\/[^/]+$/.test(new URL(url).pathname);
  const polls: number[] = [];
  page.on("request", (r) => {
    if (isPoll(r.url())) polls.push(Date.now());
  });
  // The next request is scheduled only once the previous response has
  // been read. The mock answers in-browser within milliseconds, but in
  // REAL time - so after each request, give it that time before moving
  // the page's (faked) clock on. (Playwright's requestfinished isn't
  // reliable for service-worker-answered requests.)
  const settle = () => page.waitForTimeout(300);

  await page.goto("/targets");
  await expect(page.getByTestId("engine-status")).toContainText("Engine ready");
  const start = polls.length; // the request on mount
  expect(start).toBeGreaterThanOrEqual(1);
  await settle();

  // Visible: exactly one request per 30 s. Step the clock 30 s at a time
  // and let each request land (responses arrive in real time; the next
  // request is only scheduled once the previous one has answered).
  for (let i = 1; i <= 10; i++) {
    await page.clock.runFor(29_000);
    expect(polls.length - start, `no early request before ${i * 30} s`).toBe(
      i - 1,
    );
    await page.clock.runFor(1_000);
    await expect.poll(() => polls.length - start).toBe(i);
    await settle();
  }
  const visible = polls.length - start;

  // Hidden for 10 minutes: none.
  await setVisibility(page, "hidden");
  const beforeHidden = polls.length;
  await page.clock.runFor(10 * 60_000);
  expect(polls.length - beforeHidden).toBe(0);

  // Visible again: one immediately.
  await setVisibility(page, "visible");
  await expect.poll(() => polls.length - beforeHidden).toBe(1);

  test.info().annotations.push({
    type: "request rate",
    description: `visible: ${visible} requests in 5 min (${visible / 5}/min); hidden: 0 in 10 min; on return: 1 immediately`,
  });
});
