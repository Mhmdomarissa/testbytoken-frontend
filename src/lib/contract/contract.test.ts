import { describe, expect, it } from "vitest";
import { RunDetailSchema, RunSummarySchema } from "./runs";
import { ElementSchema } from "./inspect";

/**
 * The two shapes docs/PHASE_A.md calls non-negotiable, enforced as tests
 * so a future edit that quietly makes one optional fails CI, not just a
 * code review.
 */

describe("Run: pass_rate and coverage are both required, everywhere", () => {
  const base = {
    id: "run_1",
    workspace_id: "wksp_1",
    target_id: "tgt_1",
    suite_id: "suite_1",
    status: "passed",
    pass_rate: 0.8,
    coverage: { generated: 8, candidate: 10 },
    token_cost: 12.5,
    proof_id: "proof_1",
    started_at: "2026-01-01T00:00:00Z",
    finished_at: "2026-01-01T00:01:00Z",
  };

  it("RunSummary rejects a run missing coverage", () => {
    const { coverage: _coverage, ...withoutCoverage } = base;
    expect(RunSummarySchema.safeParse(withoutCoverage).success).toBe(false);
  });

  it("RunSummary rejects a run missing pass_rate", () => {
    const { pass_rate: _passRate, ...withoutPassRate } = base;
    expect(RunSummarySchema.safeParse(withoutPassRate).success).toBe(false);
  });

  it("RunSummary accepts a run with both", () => {
    expect(RunSummarySchema.safeParse(base).success).toBe(true);
  });

  it("RunDetail (with steps) still requires both", () => {
    const { coverage: _coverage, ...withoutCoverage } = base;
    expect(
      RunDetailSchema.safeParse({ ...withoutCoverage, steps: [] }).success,
    ).toBe(false);
    expect(RunDetailSchema.safeParse({ ...base, steps: [] }).success).toBe(
      true,
    );
  });
});

describe("Element: uniquely_locatable is required on every inventory entry", () => {
  const base = {
    id: "el_1",
    page_url: "https://example.com",
    label: "Submit",
    locator: "#submit",
    locator_strategy: "css",
    uniquely_locatable: true,
    reason_not_locatable: null,
  };

  it("rejects an element missing uniquely_locatable", () => {
    const { uniquely_locatable: _flag, ...withoutFlag } = base;
    expect(ElementSchema.safeParse(withoutFlag).success).toBe(false);
  });

  it("accepts an element with the flag set either way", () => {
    expect(ElementSchema.safeParse(base).success).toBe(true);
    expect(
      ElementSchema.safeParse({ ...base, uniquely_locatable: false }).success,
    ).toBe(true);
  });
});
