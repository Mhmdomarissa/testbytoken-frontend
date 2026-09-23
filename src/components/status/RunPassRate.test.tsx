import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { UnrecognisedValue } from "@/lib/api/tolerant";
import { RunPassRate } from "./RunPassRate";

const coverage = { basis: "inventory", generated: 21, candidate: 24 };

/**
 * No pass rate for a run that hasn't finished - even when the server
 * (wrongly) sends one. A rate over the steps so far is a number about a
 * run that hasn't ended.
 */
describe("RunPassRate", () => {
  it.each(["queued", "running"])(
    "shows no pass rate while %s - even if a value was sent",
    (status) => {
      const { container } = render(
        <RunPassRate status={status} passRate={1} coverage={coverage} />,
      );
      expect(
        container.querySelector('[data-testid="pass-rate-coverage"]'),
      ).toBeNull();
      expect(container.textContent).not.toMatch(/%/);
      expect(container.textContent).toContain("Reported when the run finishes");
    },
  );

  it("shows no pass rate for a status it doesn't recognise as finished", () => {
    const { container } = render(
      <RunPassRate
        status={new UnrecognisedValue("rerunning")}
        passRate={0.5}
        coverage={coverage}
      />,
    );
    expect(container.textContent).not.toMatch(/%/);
  });

  it("shows no pass rate before the run's state is known at all", () => {
    const { container } = render(
      <RunPassRate status={null} passRate={null} coverage={coverage} />,
    );
    expect(container.textContent).not.toMatch(/%/);
  });

  it.each(["passed", "failed", "cancelled", "timed_out"])(
    "shows the pass rate WITH coverage once %s",
    (status) => {
      const { container } = render(
        <RunPassRate status={status} passRate={0.5} coverage={coverage} />,
      );
      expect(container.textContent).toContain("50% pass");
      expect(container.textContent).toContain("21 of 24 elements covered");
    },
  );

  it("a finished run with no pass rate says so, instead of inventing one", () => {
    const { container } = render(
      <RunPassRate status="passed" passRate={null} coverage={coverage} />,
    );
    expect(container.textContent).not.toMatch(/%/);
    expect(container.textContent).toContain("no pass rate was reported");
  });
});
