import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StackedBar, type Segment } from "./StackedBar";

afterEach(cleanup);

const seg = (key: string, count: number): Segment => ({
  key,
  label: key[0]!.toUpperCase() + key.slice(1),
  count,
  color: `var(--${key})`,
});

/** Each drawn part's share of the bar (flex-grow over the sum). */
function shares(container: HTMLElement) {
  const parts = [...container.querySelectorAll("[data-segment]")].map(
    (el) =>
      [
        el.getAttribute("data-segment")!,
        Number((el as HTMLElement).style.flexGrow),
      ] as const,
  );
  const sum = parts.reduce((n, [, g]) => n + g, 0);
  return Object.fromEntries(parts.map(([k, g]) => [k, g / sum]));
}

describe("StackedBar draws counts against the whole, never against themselves", () => {
  it("1 passed of 12 steps is 1/12 of the bar, the rest neutral track - not a full green bar", () => {
    const { container } = render(
      <StackedBar
        segments={[seg("passed", 1), seg("failed", 0)]}
        total={12}
        label="steps"
      />,
    );
    expect(shares(container)).toEqual({ passed: 1 / 12, remaining: 11 / 12 });
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "1 passed, 11 not reported, of 12 steps",
    );
  });

  it("with no known total, draws no bar at all - only the counts", () => {
    const { container } = render(
      <StackedBar
        segments={[seg("passed", 1), seg("failed", 2)]}
        total={null}
        label="steps"
      />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelectorAll("[data-segment]")).toHaveLength(0);
    expect(container.textContent).toContain("1Passed");
    expect(container.textContent).toContain("2Failed");
  });

  it("a complete count fills the bar, with no 'not reported' remainder", () => {
    const { container } = render(
      <StackedBar
        segments={[seg("passed", 2), seg("failed", 1)]}
        total={3}
        label="runs"
      />,
    );
    expect(shares(container)).toEqual({ passed: 2 / 3, failed: 1 / 3 });
    expect(container.textContent).not.toContain("not reported");
  });
});
