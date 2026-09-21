import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { UnrecognisedValue } from "@/lib/api/tolerant";
import { PassRateCoverage } from "./PassRateCoverage";

/**
 * Phase B, §1.2: pass rate never ships alone. The real enforcement is
 * structural (PassRateCoverage.tsx's props are both required - there is
 * no pass-rate-only component to reach for instead, which a test can't
 * "prove" the absence of any more directly than TypeScript already
 * does). What a test CAN check: every render actually surfaces both
 * numbers, so a future edit can't quietly stop rendering the coverage
 * side while leaving the props required.
 */
describe("PassRateCoverage", () => {
  it("renders the pass rate as a rounded percentage", () => {
    // container-scoped, not the global `screen`/destructured query - RTL
    // doesn't auto-cleanup between tests in this project's setup (matches
    // the pattern already used elsewhere, e.g. StatusBadge.test.tsx).
    const { container } = render(
      <PassRateCoverage
        passRate={0.875}
        coverage={{ basis: "inventory", generated: 21, candidate: 24 }}
      />,
    );
    expect(container.textContent).toContain("88% pass");
  });

  it("always renders the coverage fraction alongside the pass rate", () => {
    const { container } = render(
      <PassRateCoverage
        passRate={1}
        coverage={{ basis: "inventory", generated: 21, candidate: 24 }}
      />,
    );
    expect(container.textContent).toContain("100% pass");
    expect(container.textContent).toContain("21 of 24 elements covered");
  });

  it("renders low coverage honestly even at a perfect pass rate - the exact case §1.2 exists for", () => {
    // A run can show 100% pass and still have covered almost nothing,
    // if most elements weren't uniquely locatable - the whole reason
    // this component exists instead of a bare percentage.
    const { container } = render(
      <PassRateCoverage
        passRate={1}
        coverage={{ basis: "inventory", generated: 3, candidate: 24 }}
      />,
    );
    expect(container.textContent).toContain("100% pass");
    expect(container.textContent).toContain("3 of 24 elements covered");
  });

  it("rounds rather than truncates the percentage", () => {
    const { container } = render(
      <PassRateCoverage
        passRate={0.995}
        coverage={{ basis: "inventory", generated: 1, candidate: 1 }}
      />,
    );
    expect(container.textContent).toContain("100% pass");
  });

  it("prints the unit, so a plan run's 2 of 5 can't be mistaken for an inventory figure", () => {
    const plan = render(
      <PassRateCoverage
        passRate={1}
        coverage={{ basis: "plan", generated: 2, candidate: 5 }}
      />,
    );
    expect(plan.container.textContent).toContain("100% pass");
    expect(plan.container.textContent).toContain("2 of 5 plan steps covered");
    expect(plan.container.textContent).not.toContain("elements");
    const el = plan.container.querySelector(
      '[data-testid="pass-rate-coverage"]',
    )!;
    expect(el.getAttribute("data-basis")).toBe("plan");
    expect(el.getAttribute("title")).toMatch(
      /does not say how much of the application/,
    );

    const inv = render(
      <PassRateCoverage
        passRate={1}
        coverage={{ basis: "inventory", generated: 2, candidate: 5 }}
      />,
    );
    expect(inv.container.textContent).toContain("2 of 5 elements covered");
    expect(inv.container.textContent).not.toContain("plan steps");
  });

  it("an unrecognised basis is shown as unrecognised with the raw value, never defaulted to a unit", () => {
    const { container } = render(
      <PassRateCoverage
        passRate={1}
        coverage={{
          basis: new UnrecognisedValue("scenarios"),
          generated: 2,
          candidate: 5,
        }}
      />,
    );
    expect(container.textContent).toContain(
      "2 of 5 covered (unrecognised basis: scenarios)",
    );
    expect(container.textContent).not.toMatch(/elements|plan steps/);
  });
});
