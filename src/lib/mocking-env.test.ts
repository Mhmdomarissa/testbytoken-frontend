// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveMocking } from "../../scripts/mocking-env.mjs";

/**
 * next.config.ts runs this before anything compiles, so each failure here
 * is a build that refuses to start (docs/PHASE_DEPLOY.md D1).
 */
describe("the mocking flag (resolveMocking)", () => {
  it("is off by default", () => {
    expect(resolveMocking({})).toBe(false);
    expect(resolveMocking({ NEXT_PUBLIC_API_MOCKING: "" })).toBe(false);
    expect(resolveMocking({ NEXT_PUBLIC_API_MOCKING: "off" })).toBe(false);
  });

  it('is on only for exactly "on"', () => {
    expect(resolveMocking({ NEXT_PUBLIC_API_MOCKING: "on" })).toBe(true);
  });

  it("fails on any other value, so a typo can't silently pick a side", () => {
    for (const v of ["true", "1", "ON", "yes"])
      expect(() => resolveMocking({ NEXT_PUBLIC_API_MOCKING: v })).toThrow(
        /must be "on" or "off"/,
      );
  });

  it("fails when mocking is on and a real API base URL is set", () => {
    expect(() =>
      resolveMocking({
        NEXT_PUBLIC_API_MOCKING: "on",
        NEXT_PUBLIC_API_BASE_URL: "https://api.example.com",
      }),
    ).toThrow(/both set/);
  });

  it("allows a real API base URL with mocking off", () => {
    expect(
      resolveMocking({ NEXT_PUBLIC_API_BASE_URL: "https://api.example.com" }),
    ).toBe(false);
  });
});
