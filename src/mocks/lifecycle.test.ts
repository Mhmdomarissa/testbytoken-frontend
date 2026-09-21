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
} from "./lifecycle";
import type { RunDetailSchema, ScanSchema } from "@/lib/contract";
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
    expect(run.steps).toHaveLength(LIVE_PASS_TIMELINE.steps.length);
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

  it("before the failure, still reports the honest in-progress pass_rate", () => {
    const run = computeRunState(baseRun, LIVE_FAIL_TIMELINE, 1300);
    expect(run.pass_rate).toBe(1); // both steps so far passed
    expect(run.status).toBe("running");
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
