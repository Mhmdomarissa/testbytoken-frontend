// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The demo's dates are relative to when the fixtures load, so the demo
 * can't age out of the overview's windows (it once did: fixed September
 * dates left the 7-day chart empty within a week). Each case fixes the
 * clock BEFORE loading the fixtures - the pattern for any test that needs
 * exact dates - and checks the windows are populated on that day.
 */
afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

async function overviewOn(isoDay: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(isoDay));
  vi.resetModules();
  const { computeOverview } = await import("./overview");
  const now = new Date();
  return {
    week: computeOverview(now, "7d", "UTC"),
    month: computeOverview(now, "30d", "UTC"),
  };
}

const finished = (days: { passed: number; failed: number }[]) =>
  days.reduce((n, d) => n + d.passed + d.failed, 0);

describe("the demo never ages", () => {
  for (const day of [
    "2026-09-28T09:00:00Z",
    "2027-02-28T23:30:00Z",
    "2031-07-04T00:05:00Z",
  ]) {
    it(`on ${day.slice(0, 10)}: the 7-day chart has 2 finished runs, 30 days has 3`, async () => {
      const { week, month } = await overviewOn(day);
      expect(week.range.to).toBe(day.slice(0, 10));
      expect(finished(week.runs_by_day)).toBe(2);
      expect(finished(month.runs_by_day)).toBe(3);
      // A finished suite run is always there to headline the card.
      expect(month.latest_suite_run?.run_id).toBe("run_pass_1");
    });
  }

  it("a fixed clock gives exact, repeatable fixture dates", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-01-15T12:00:00Z"));
    vi.resetModules();
    const { runPassed } = await import("./data");
    expect(runPassed.started_at).toBe("2027-01-14T09:00:00.000Z");
    expect(runPassed.finished_at).toBe("2027-01-14T09:02:10.000Z");
  });
});
