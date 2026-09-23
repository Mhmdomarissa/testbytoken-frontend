import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * View transitions between screens (P3), tested for the two ways they can
 * go wrong here:
 *
 * 1. Focus. B10 moves focus to <main> on every route change. A transition
 *    runs around that commit - the browser snapshots, React commits, the
 *    focus effect fires, then the animation plays - so a transition that
 *    finishes after focus has moved could steal or reset it. Asserted
 *    AFTER the transition has finished, not just after the URL changes.
 * 2. Reduced motion. The route change must be an instant swap: no
 *    view-transition animation runs at all.
 *
 * Instrumented in the page itself: every startViewTransition call is
 * counted and awaited, and every view-transition pseudo-element animation
 * seen on any frame is recorded.
 */

async function instrument(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __vt: { started: number; pending: Promise<unknown>[]; seen: string[] };
    };
    w.__vt = { started: 0, pending: [], seen: [] };
    const orig = document.startViewTransition?.bind(document);
    if (orig) {
      document.startViewTransition = ((...args: unknown[]) => {
        const t = (orig as (...a: unknown[]) => ViewTransition)(...args);
        w.__vt.started++;
        w.__vt.pending.push(t.finished.catch(() => {}));
        return t;
      }) as typeof document.startViewTransition;
    }
    const sample = () => {
      for (const a of document.getAnimations()) {
        const pseudo = (a.effect as KeyframeEffect | null)?.pseudoElement;
        if (pseudo?.startsWith("::view-transition"))
          w.__vt.seen.push(
            `${pseudo}:${(a as CSSAnimation).animationName ?? "?"}`,
          );
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

/** Every transition started so far has finished, and then some. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    const w = window as unknown as { __vt: { pending: Promise<unknown>[] } };
    await Promise.all(w.__vt.pending);
  });
  await page.waitForTimeout(200);
}

const vt = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as {
      __vt: { started: number; seen: string[] };
    };
    return { started: w.__vt.started, seen: [...new Set(w.__vt.seen)] };
  });

async function focusedInMain(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    return el.closest("main") ? "IN_MAIN" : `OUTSIDE_MAIN(${el.tagName})`;
  });
}

test.describe("with motion", () => {
  test.beforeEach(async ({ page }) => {
    await instrument(page);
    await signIn(page);
  });

  test("a route change runs a transition, and focus is still inside <main> once it has finished", async ({
    page,
  }) => {
    const sidebar = page.locator('[data-slot="sidebar"]');
    for (const name of ["Targets", "Runs", "Suites", "Usage"]) {
      await sidebar.getByRole("link", { name, exact: true }).click();
      await settle(page);
      expect(await focusedInMain(page), `focus after ${name}`).toBe("IN_MAIN");
    }
    const { started, seen } = await vt(page);
    expect(started).toBeGreaterThan(0);
    // Our own route animations ran - not just the browser's default.
    expect(seen.some((s) => s.endsWith(":route-in"))).toBe(true);
    expect(seen.some((s) => s.endsWith(":route-out"))).toBe(true);
  });

  test("by keyboard: after the transition, focus is on <main> and the next Tab starts inside it", async ({
    page,
  }) => {
    await page
      .locator('[data-slot="sidebar"]')
      .getByRole("link", { name: "Runs", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/runs$/);
    await settle(page);
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(
      "MAIN",
    );
    await page.keyboard.press("Tab");
    expect(await focusedInMain(page)).toBe("IN_MAIN");
  });
});

test.describe("public pages, with motion", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("landing -> sample report -> back: transitions run, focus lands in <main> each time", async ({
    page,
  }) => {
    await instrument(page);
    await page.goto("/");
    await page
      .locator("footer")
      .getByRole("link", { name: "Sample report" })
      .click();
    await page.waitForURL(/\/p\/share_demo$/);
    await settle(page);
    expect(await focusedInMain(page)).toBe("IN_MAIN");
    await page.goBack();
    await page.waitForURL((u) => u.pathname === "/");
    await settle(page);
    expect(await focusedInMain(page)).toBe("IN_MAIN");
    expect((await vt(page)).started).toBeGreaterThan(0);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test.beforeEach(async ({ page }) => {
    await instrument(page);
    await signIn(page);
  });

  test("a route change is an instant swap - no view-transition animation runs - and focus still lands in <main>", async ({
    page,
  }) => {
    const sidebar = page.locator('[data-slot="sidebar"]');
    for (const name of ["Targets", "Runs", "Usage"]) {
      await sidebar.getByRole("link", { name, exact: true }).click();
      await settle(page);
      expect(await focusedInMain(page), `focus after ${name}`).toBe("IN_MAIN");
    }
    const { seen } = await vt(page);
    expect(seen, "view-transition animations under reduced motion").toEqual([]);
  });
});
