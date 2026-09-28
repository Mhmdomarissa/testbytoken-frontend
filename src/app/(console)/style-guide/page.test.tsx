import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * The style guide is an internal reference, rendered only in mock-backed
 * builds (docs/DEV_ONLY_IN_PRODUCTION.md, item 5). The flag is inlined at
 * build time, so each case loads a fresh copy of the page with it stubbed.
 */
async function load(flag: string | undefined) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_MOCKING", flag as string);
  return (await import("./page")).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("style guide page", () => {
  it("renders without crashing in a mock-backed build", async () => {
    const Page = await load("on");
    const { container } = render(<Page />);
    expect(container.textContent).not.toBe("");
  });

  it("is not found in a real build", async () => {
    const Page = await load(undefined);
    expect(() => render(<Page />)).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});
