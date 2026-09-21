import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
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
        coverage={{ generated: 21, candidate: 24 }}
      />,
    );
    expect(container.textContent).toContain("88% pass");
  });

  it("always renders the coverage fraction alongside the pass rate", () => {
    const { container } = render(
      <PassRateCoverage
        passRate={1}
        coverage={{ generated: 21, candidate: 24 }}
      />,
    );
    expect(container.textContent).toContain("100% pass");
    expect(container.textContent).toContain("21/24");
  });

  it("renders low coverage honestly even at a perfect pass rate - the exact case §1.2 exists for", () => {
    // A run can show 100% pass and still have covered almost nothing,
    // if most elements weren't uniquely locatable - the whole reason
    // this component exists instead of a bare percentage.
    const { container } = render(
      <PassRateCoverage
        passRate={1}
        coverage={{ generated: 3, candidate: 24 }}
      />,
    );
    expect(container.textContent).toContain("100% pass");
    expect(container.textContent).toContain("3/24");
  });

  it("rounds rather than truncates the percentage", () => {
    const { container } = render(
      <PassRateCoverage
        passRate={0.995}
        coverage={{ generated: 1, candidate: 1 }}
      />,
    );
    expect(container.textContent).toContain("100% pass");
  });
});
