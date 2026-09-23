import { describe, expect, it } from "vitest";
import {
  computeRunState,
  computeScanState,
  runEventLog,
  pendingRunEvents,
  scanEventLog,
  scanFailureFor,
  scanFindsNothing,
  pendingScanEvents,
  LIVE_PASS_TIMELINE,
  LIVE_FAIL_TIMELINE,
  LIVE_STALL_TIMELINE,
  SCAN_TIMELINE,
  timelineCancelledAt,
  timelineForPlan,
} from "./lifecycle";
import type { PlanSchema, RunDetailSchema, ScanSchema } from "@/lib/contract";
import type { z } from "zod";

/**
 * Phase A review, §5: "build the stateful lifecycle simulation before the
 * console, not during it." These test the computation directly, at
 * explicit elapsed times, rather than waiting on real timers - the
 * timelines span up to 15s (the stall scenario), too slow for a unit
 * suite to actually wait out. The HTTP/SSE wiring around these functions
 * (src/mocks/handlers/{runs,scans,events}.ts) is exercised more lightly
 * in handlers.test.ts, which only needs to prove the wiring, not re-prove
 * the timing logic itself.
 */

const baseRun: z.infer<typeof RunDetailSchema> = {
  id: "run_test_1",
  workspace_id: "wksp_demo",
  target_id: "tgt_checkout",
  suite_id: "suite_checkout",
  plan_id: null,
  login_session_id: null,
  report_url: null,
  status: "running",
  pass_rate: 1,
  coverage: { basis: "inventory", generated: 21, candidate: 24 },
  token_cost: 1.1,
  proof_id: "proof_should_be_cleared_until_resolved",
  started_at: new Date().toISOString(),
  finished_at: null,
  steps: [],
};

const baseScan: z.infer<typeof ScanSchema> = {
  id: "scan_test_1",
  workspace_id: "wksp_demo",
  target_id: "tgt_checkout",
  target_url: "https://checkout.example.com",
  status: "queued",
  parked_reason: null,
  failure: null,
  login_session_id: null,
  modules: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("scan progressing to completion", () => {
  it("is queued before the crawling threshold", () => {
    const scan = computeScanState(baseScan, 0);
    expect(scan.status).toBe("queued");
    expect(scan.modules).toEqual([]);
  });

  it("is crawling between the thresholds, with no modules yet", () => {
    const scan = computeScanState(baseScan, SCAN_TIMELINE.crawlingAt + 500);
    expect(scan.status).toBe("crawling");
    expect(scan.modules).toEqual([]);
  });

  it("is completed with real modules once resolved", () => {
    const scan = computeScanState(baseScan, SCAN_TIMELINE.completedAt);
    expect(scan.status).toBe("completed");
    expect(scan.modules.length).toBeGreaterThan(0);
  });

  it("scanEventLog only includes transitions that have actually happened", () => {
    expect(scanEventLog(0).map((e) => e.type)).toEqual(["status"]);
    expect(scanEventLog(SCAN_TIMELINE.crawlingAt).map((e) => e.type)).toEqual([
      "status",
      "status",
    ]);
    expect(scanEventLog(SCAN_TIMELINE.completedAt).map((e) => e.type)).toEqual([
      "status",
      "status",
      "status",
      "done",
    ]);
  });

  it("pendingScanEvents reports nothing left once resolved", () => {
    expect(pendingScanEvents(SCAN_TIMELINE.completedAt)).toEqual([]);
    expect(pendingScanEvents(0).length).toBeGreaterThan(0);
  });
});

describe("run emitting ordered step events over time", () => {
  it("shows only the steps that have happened so far, in order", () => {
    const run = computeRunState(baseRun, LIVE_PASS_TIMELINE, 1300);
    expect(run.steps.map((s) => s.index)).toEqual([0, 1]);
    expect(run.status).toBe("running");
    expect(run.finished_at).toBeNull();
    // NON-NEGOTIABLE shape still holds mid-run: coverage present alongside pass_rate.
    expect(run.coverage).toEqual({
      basis: "inventory",
      generated: 21,
      candidate: 24,
    });
  });

  it("pass_rate is null at every moment before the run resolves, for every timeline", () => {
    for (const t of [
      LIVE_PASS_TIMELINE,
      LIVE_FAIL_TIMELINE,
      LIVE_STALL_TIMELINE,
    ]) {
      for (let ms = 0; ms < t.resolvesAt; ms += 250) {
        const run = computeRunState(baseRun, t, ms);
        expect(run.status).toBe("running");
        expect(run.pass_rate).toBeNull();
      }
      expect(
        computeRunState(baseRun, t, t.resolvesAt).pass_rate,
      ).not.toBeNull();
    }
  });

  it("clears proof_id until resolved, then restores it", () => {
    expect(computeRunState(baseRun, LIVE_PASS_TIMELINE, 0).proof_id).toBeNull();
    const finished = computeRunState(
      baseRun,
      LIVE_PASS_TIMELINE,
      LIVE_PASS_TIMELINE.resolvesAt,
    );
    expect(finished.proof_id).toBe(baseRun.proof_id);
  });

  it("resolves to passed with every step present", () => {
    const run = computeRunState(
      baseRun,
      LIVE_PASS_TIMELINE,
      LIVE_PASS_TIMELINE.resolvesAt,
    );
    expect(run.status).toBe("passed");
    // Five distinct steps (each one id, several frames over time).
    expect(run.steps).toHaveLength(5);
    expect(run.steps.every((s) => s.status === "pass")).toBe(true);
    expect(run.finished_at).not.toBeNull();
  });
});

describe("a run that fails partway", () => {
  it("carries a real, specific failure message on the failing step", () => {
    const run = computeRunState(
      baseRun,
      LIVE_FAIL_TIMELINE,
      LIVE_FAIL_TIMELINE.resolvesAt,
    );
    expect(run.status).toBe("failed");
    const failedStep = run.steps.find((s) => s.status === "fail");
    expect(failedStep?.message).toMatch(/confirm-button/);
    expect(failedStep?.message.length).toBeGreaterThan(20);
  });

  it("marks steps after the failure as skipped, not silently dropped", () => {
    const run = computeRunState(
      baseRun,
      LIVE_FAIL_TIMELINE,
      LIVE_FAIL_TIMELINE.resolvesAt,
    );
    expect(run.steps.some((s) => s.status === "skipped")).toBe(true);
  });

  it("before the failure, reports NO pass rate - not the 100% of the two steps so far", () => {
    // This used to assert pass_rate 1 here: "100% pass" for a run that
    // ends at 50%, and the runs list rendered exactly that. A rate over
    // the steps so far is not the run's pass rate (docs/API_CONTRACT.md).
    const run = computeRunState(baseRun, LIVE_FAIL_TIMELINE, 1300);
    expect(run.status).toBe("running");
    expect(run.pass_rate).toBeNull();
    const finished = computeRunState(
      baseRun,
      LIVE_FAIL_TIMELINE,
      LIVE_FAIL_TIMELINE.resolvesAt,
    );
    expect(finished.status).toBe("failed");
    expect(finished.pass_rate).toBe(0.5);
  });
});

describe("a run that stalls and times out", () => {
  it("stops emitting steps after the last scripted one - the stall itself", () => {
    const midStall = computeRunState(baseRun, LIVE_STALL_TIMELINE, 8000);
    expect(midStall.steps).toHaveLength(2);
    expect(midStall.status).toBe("running"); // still "running" - indistinguishable from healthy until the timeout
  });

  it("resolves to timed_out, not failed, once the timeout fires", () => {
    const run = computeRunState(
      baseRun,
      LIVE_STALL_TIMELINE,
      LIVE_STALL_TIMELINE.resolvesAt,
    );
    expect(run.status).toBe("timed_out");
    expect(run.status).not.toBe("failed");
  });

  it("appends a synthetic step explaining the timeout, so the UI has something to show", () => {
    const run = computeRunState(
      baseRun,
      LIVE_STALL_TIMELINE,
      LIVE_STALL_TIMELINE.resolvesAt,
    );
    const last = run.steps.at(-1);
    expect(last?.action).toBe("timeout");
    expect(last?.message).toMatch(/no response/i);
  });

  it("clears proof_id permanently for a timed-out run (no proof was produced)", () => {
    const run = computeRunState(
      baseRun,
      LIVE_STALL_TIMELINE,
      LIVE_STALL_TIMELINE.resolvesAt,
    );
    expect(run.proof_id).toBeNull();
  });
});

function planStep(
  id: string,
  overrides: Partial<z.infer<typeof PlanSchema>["steps"][number]> = {},
): z.infer<typeof PlanSchema>["steps"][number] {
  return {
    id,
    index: 0,
    description: `Step ${id}`,
    action: "click",
    input: null,
    action_class: "read",
    binding: { type: "page", page_url: "https://checkout.example.com/" },
    blocked: null,
    ...overrides,
  };
}

function basePlan(
  intent: string,
  stepIds: string[],
): z.infer<typeof PlanSchema> {
  const steps = stepIds.map((id, i) => planStep(id, { index: i }));
  return {
    id: "plan_test_1",
    workspace_id: "wksp_demo",
    target_id: "tgt_checkout",
    scan_id: "scan_checkout_1",
    intent,
    status: "approved",
    steps,
    failure: null,
    approval: { approved_at: new Date().toISOString(), step_ids: stepIds },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("timelineForPlan", () => {
  it("an ordinary intent resolves passed, one executed step per approved plan step", () => {
    const plan = basePlan("check that checkout works", ["a", "b"]);
    const timeline = timelineForPlan(plan);
    expect(timeline.finalStatus).toBe("passed");
    const finished = timeline.steps.filter((s) => s.step.status !== "running");
    expect(finished.map((f) => f.step.status)).toEqual(["pass", "pass"]);
    expect(finished.map((f) => f.step.plan_step_id)).toEqual(["a", "b"]);
  });

  it("a 'fail-run:' intent fails partway - a pass, a real failure message, then skipped - never all green", () => {
    const plan = basePlan("fail-run: buy something", ["a", "b", "c"]);
    const timeline = timelineForPlan(plan);
    expect(timeline.finalStatus).toBe("failed");
    const finished = timeline.steps.filter((s) => s.step.status !== "running");
    expect(finished.map((f) => f.step.status)).toEqual([
      "pass",
      "fail",
      "skipped",
    ]);
    const failed = finished.find((f) => f.step.status === "fail")!;
    expect(failed.step.message.length).toBeGreaterThan(20);
  });

  it("a 'fail-run:' intent with only one approved step just fails that step", () => {
    const plan = basePlan("fail-run: buy something", ["a"]);
    const timeline = timelineForPlan(plan);
    expect(timeline.finalStatus).toBe("failed");
    const finished = timeline.steps.filter((s) => s.step.status !== "running");
    expect(finished.map((f) => f.step.status)).toEqual(["fail"]);
  });

  it("resolving a failed plan-run's timeline through computeRunState reports the honest, lower pass_rate", () => {
    const plan = basePlan("fail-run: buy something", ["a", "b", "c"]);
    const timeline = timelineForPlan(plan);
    const run = computeRunState(baseRun, timeline, timeline.resolvesAt);
    expect(run.status).toBe("failed");
    expect(run.pass_rate).toBeCloseTo(1 / 3);
    // A failed run still produces a proof - only a timed-out one doesn't.
    expect(run.proof_id).not.toBeNull();
    expect(run.report_url).not.toBeNull();
  });
});

describe("pendingRunEvents", () => {
  it("reports every remaining step and the final resolution, with correct delays", () => {
    const pending = pendingRunEvents(LIVE_PASS_TIMELINE, 0);
    // At elapsed=0, the first step (its own `at: 0`) already counts as
    // arrived (backlog), matching runEventLog's `<=` semantics - so this
    // is steps 1..4 (4 remaining) + the "done" event, not all 5 steps.
    expect(pending).toHaveLength(LIVE_PASS_TIMELINE.steps.length - 1 + 1);
    expect(pending.at(-1)?.event.type).toBe("done");
  });

  it("reports nothing once fully resolved", () => {
    expect(
      pendingRunEvents(LIVE_PASS_TIMELINE, LIVE_PASS_TIMELINE.resolvesAt),
    ).toEqual([]);
  });
});

describe("runEventLog", () => {
  it("assigns monotonically increasing ids matching arrival order", () => {
    const log = runEventLog(LIVE_PASS_TIMELINE, LIVE_PASS_TIMELINE.resolvesAt);
    expect(log.map((e) => e.id)).toEqual(log.map((_, i) => String(i)));
    expect(log.at(-1)?.type).toBe("done");
  });
});

describe("scanFailureFor: every failure kind in the contract is reachable from a URL", () => {
  it.each([
    ["https://refused.example.com", "refused"],
    ["https://slow.example.com", "timeout"],
    ["https://broken.example.com", "internal"],
    ["https://unreachable.example.com", "unreachable"],
    ["https://legacy-admin.example.com", "unreachable"],
    ["http://localhost:3000", "blocked_by_guardrail"],
    ["http://127.0.0.1", "blocked_by_guardrail"],
    ["http://10.1.2.3", "blocked_by_guardrail"],
    ["http://172.20.0.1", "blocked_by_guardrail"],
    ["http://192.168.1.10", "blocked_by_guardrail"],
    ["http://169.254.169.254", "blocked_by_guardrail"],
    ["https://staging.corp.internal", "blocked_by_guardrail"],
  ])("%s -> %s", (url, kind) => {
    expect(scanFailureFor(url)?.kind).toBe(kind);
  });

  it.each([
    "https://shop.example.com",
    "http://172.32.0.1", // just outside 172.16/12
    "https://example.com:8443/app",
  ])("%s completes", (url) => {
    expect(scanFailureFor(url)).toBeNull();
  });
});

describe("scan outcomes that are not failures", () => {
  it("an empty.* host completes with no modules; anything else finds the fixtures", () => {
    const base = {
      id: "scan_x",
      workspace_id: "w",
      target_id: "t",
      status: "queued" as const,
      parked_reason: null,
      failure: null,
      login_session_id: null,
      modules: [],
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const done = SCAN_TIMELINE.completedAt;
    const empty = computeScanState(
      { ...base, target_url: "https://empty.example.com" },
      done,
    );
    expect(empty.status).toBe("completed");
    expect(empty.modules).toEqual([]);
    expect(scanFindsNothing("https://shop.example.com")).toBe(false);
    expect(
      computeScanState(
        { ...base, target_url: "https://shop.example.com" },
        done,
      ).modules.length,
    ).toBeGreaterThan(0);
  });
});

describe("a step is reported running before it is finished (so a client never has to guess which is current)", () => {
  const at = (t: number) =>
    computeRunState(baseRun, LIVE_PASS_TIMELINE, t).steps;

  it("an executed step is `running` between the previous step finishing and its own result", () => {
    // Step 1 finishes at 1200; it starts as soon as step 0 is done (0) but no
    // earlier than RUNNING_PHASE_MS before its result.
    const mid = at(600);
    expect(mid.map((s) => [s.id, s.status])).toEqual([
      ["stp_0", "pass"],
      ["stp_1", "running"],
    ]);
    expect(at(1200).map((s) => s.status)).toEqual(["pass", "pass"]);
  });

  it("a running step carries no outcome: no message, no duration, no screenshot", () => {
    const running = at(600).find((s) => s.status === "running")!;
    expect(running.message).toBe("");
    expect(running.duration_ms).toBe(0);
    expect(running.screenshot_url).toBeNull();
  });

  it("at most one step is running at any moment, and never a skipped step", () => {
    for (const t of [0, 300, 600, 1100, 1300, 2500, 2700, 3100]) {
      for (const tl of [LIVE_PASS_TIMELINE, LIVE_FAIL_TIMELINE]) {
        const steps = computeRunState(baseRun, tl, t).steps;
        expect(
          steps.filter((s) => s.status === "running").length,
        ).toBeLessThanOrEqual(1);
      }
    }
    // The fail timeline's skipped step never has a running phase.
    const frames = LIVE_FAIL_TIMELINE.steps.filter(
      (f) => f.step.id === "stp_3",
    );
    expect(frames.map((f) => f.step.status)).toEqual(["skipped"]);
  });

  it("the engine's own timeout marker is not a step that 'ran'", () => {
    const frames = LIVE_STALL_TIMELINE.steps.filter(
      (f) => f.step.id === "stp_timeout",
    );
    expect(frames.map((f) => f.step.status)).toEqual(["fail"]);
  });

  it("frames are in time order, so event ids (positions) never go backwards in time", () => {
    for (const tl of [
      LIVE_PASS_TIMELINE,
      LIVE_FAIL_TIMELINE,
      LIVE_STALL_TIMELINE,
    ]) {
      const times = tl.steps.map((f) => f.at);
      expect([...times].sort((a, b) => a - b)).toEqual(times);
    }
  });

  it("cancelling mid-step: the step that was running becomes skipped, later steps never start", () => {
    const cancelled = timelineCancelledAt(LIVE_PASS_TIMELINE, 1_500);
    const steps = computeRunState(baseRun, cancelled, 60_000).steps;
    expect(steps.map((s) => s.status)).toEqual([
      "pass", // stp_0
      "pass", // stp_1 finished at 1200
      "skipped", // stp_2 started running at 1500, the moment of cancel: it never finished
      "skipped",
      "skipped",
    ]);
    // Frames delivered before the cancel are untouched, in the same positions.
    const before = LIVE_PASS_TIMELINE.steps.filter((f) => f.at <= 1_500);
    expect(cancelled.steps.slice(0, before.length)).toEqual(before);
  });
});
