import { describe, expect, it } from "vitest";
import { formatDay, formatDuration } from "./datetime";

describe("formatDay", () => {
  it("writes the month in words, so a date can't be read two ways", () => {
    expect(formatDay("2026-09-09")).toBe("9 Sept");
    expect(formatDay("2026-09-09", true)).toBe("9 Sept 2026");
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0s"],
    [47_000, "47s"],
    [107_000, "1m 47s"],
    [272_000, "4m 32s"],
  ])("%i ms -> %s", (ms, text) => expect(formatDuration(ms)).toBe(text));
});
