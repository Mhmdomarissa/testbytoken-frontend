import { describe, expect, it } from "vitest";
import { rehostMediaUrls } from "./respond";
import { REPORT_ORIGIN, SCREENSHOT_ORIGIN } from "./data";

describe("rehostMediaUrls", () => {
  const origin = "http://localhost:3000";

  it("rewrites the fake report and screenshot origins wherever they appear, arbitrarily nested", () => {
    const input = {
      report_url: `${REPORT_ORIGIN}/runs/run_1/report`,
      steps: [
        { screenshot_url: `${SCREENSHOT_ORIGIN}/screenshots/0.png` },
        { screenshot_url: null },
      ],
      snapshot: {
        steps: [
          { screenshot_url: `${SCREENSHOT_ORIGIN}/screenshots/run_1/2.png` },
        ],
      },
    };
    const out = rehostMediaUrls(input, origin);
    expect(out.report_url).toBe(`${origin}/runs/run_1/report`);
    expect(out.steps[0]!.screenshot_url).toBe(`${origin}/screenshots/0.png`);
    expect(out.steps[1]!.screenshot_url).toBeNull();
    expect(out.snapshot.steps[0]!.screenshot_url).toBe(
      `${origin}/screenshots/run_1/2.png`,
    );
  });

  it("leaves everything else untouched, including other URLs and non-string values", () => {
    const input = {
      id: "run_1",
      pass_rate: 0.5,
      other_url: "https://example.com/x",
      n: 3,
    };
    expect(rehostMediaUrls(input, origin)).toEqual(input);
  });
});
