import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * The flag is read once, at module load (it's inlined at build time), so
 * each case imports a fresh copy with the env stubbed.
 */
async function load(flag: string | undefined) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_MOCKING", flag as string);
  return import("./DemoBanner");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("DemoBanner (deploy brief D2)", () => {
  it("renders nothing when the flag is off or unset", async () => {
    for (const flag of [undefined, "", "off", "true"]) {
      const { DemoBanner, DEMO_MODE } = await load(flag);
      expect(DEMO_MODE).toBe(false);
      const { container } = render(<DemoBanner />);
      expect(container.textContent).toBe("");
    }
  });

  it("with the flag on, says plainly that this is a demo with simulated data", async () => {
    const { DemoBanner, DEMO_MODE } = await load("on");
    expect(DEMO_MODE).toBe(true);
    const { getByRole } = render(<DemoBanner />);
    const note = getByRole("note", { name: "Demonstration" });
    expect(note.textContent).toContain("Demo · simulated data.");
    expect(note.textContent).toContain("no backend");
  });
});
