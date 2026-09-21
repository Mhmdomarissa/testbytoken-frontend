import type { z } from "zod";
import type {
  PlanSchema,
  ScanSchema,
  RunDetailSchema,
  StepSchema,
  JobEventSchema,
} from "@/lib/contract";
import { modCheckout, modSettings, reportUrl } from "./data";

type Scan = z.infer<typeof ScanSchema>;
type Plan = z.infer<typeof PlanSchema>;
type Run = z.infer<typeof RunDetailSchema>;
type Step = z.infer<typeof StepSchema>;
// Only sequenced events (with an id) ever live in a job's event LOG; heartbeats are transport, not history.
type JobEvent = Exclude<z.infer<typeof JobEventSchema>, { type: "heartbeat" }>;

/**
 * Phase A review, §5: "a mock layer that returns static payloads cannot
 * exercise [state transitions over time]... build the stateful lifecycle
 * simulation before the console, not during it." This module is that
 * simulation: every dynamic scan/run's current state is *computed* from
 * how much time has elapsed since it started, replayed against a fixed
 * timeline - not stored, mutated state. That means:
 *   - Polling and SSE see the exact same timeline, because both derive
 *     from the same computation, not two different code paths.
 *   - A dev server restart or a fresh look at a job id starts its clock
 *     fresh (see `startTimes` below) - repeatable for local development.
 *   - Multiple simultaneous viewers (two tabs, polling + SSE at once) see
 *     consistent progress, because "now" is the only free variable.
 */

// ---------------------------------------------------------------------
// Job start times - lazily assigned on first observation of a dynamic
// job id, shared by every handler that touches that id.
// ---------------------------------------------------------------------
const startTimes = new Map<string, number>();

export function startTimeFor(jobId: string): number {
  let t = startTimes.get(jobId);
  if (t === undefined) {
    t = Date.now();
    startTimes.set(jobId, t);
  }
  return t;
}

export function elapsedMsFor(jobId: string): number {
  return Date.now() - startTimeFor(jobId);
}

// ---------------------------------------------------------------------
// Scan lifecycle - one scenario: progresses queued -> crawling -> completed.
// ---------------------------------------------------------------------
interface ScanTimeline {
  crawlingAt: number;
  completedAt: number;
}

export const SCAN_TIMELINE: ScanTimeline = {
  crawlingAt: 1000,
  completedAt: 4000,
};

/**
 * A target named tgt_unreachable never resolves: its scan crawls, then FAILS
 * with a structured reason (B0.5 B4) - the designed scan-failure state.
 */
const UNREACHABLE_TARGET_ID = "tgt_unreachable";

export function computeScanState(base: Scan, elapsedMs: number): Scan {
  if (
    base.target_id === UNREACHABLE_TARGET_ID &&
    elapsedMs >= SCAN_TIMELINE.completedAt
  ) {
    return {
      ...base,
      status: "failed",
      modules: [],
      failure: {
        kind: "unreachable",
        message:
          "We couldn't reach legacy-admin.example.com - the name did not resolve. Check the address, or that the site is up.",
      },
    };
  }
  if (elapsedMs >= SCAN_TIMELINE.completedAt) {
    return {
      ...base,
      status: "completed",
      failure: null,
      modules: [modCheckout, modSettings],
    };
  }
  if (elapsedMs >= SCAN_TIMELINE.crawlingAt) {
    return { ...base, status: "crawling", failure: null, modules: [] };
  }
  return { ...base, status: "queued", failure: null, modules: [] };
}

/** Ids of scans driven by SCAN_TIMELINE rather than returned static. */
export const LIVE_SCAN_IDS = new Set<string>();
export function registerLiveScan(scanId: string) {
  LIVE_SCAN_IDS.add(scanId);
}

export function resolveScan(base: Scan): Scan {
  if (!LIVE_SCAN_IDS.has(base.id)) return base;
  return computeScanState(base, elapsedMsFor(base.id));
}

function scanTerminalStatus(scanTargetId?: string): "completed" | "failed" {
  return scanTargetId === UNREACHABLE_TARGET_ID ? "failed" : "completed";
}

function scanStatusEvent(id: string, status: Scan["status"]): JobEvent {
  return { id, type: "status", status };
}

/** Ordered JobEvents for a scan's progress so far, for SSE backlog. */
export function scanEventLog(
  elapsedMs: number,
  scanTargetId?: string,
): JobEvent[] {
  const events: JobEvent[] = [scanStatusEvent("0", "queued")];
  if (elapsedMs >= SCAN_TIMELINE.crawlingAt)
    events.push(scanStatusEvent("1", "crawling"));
  if (elapsedMs >= SCAN_TIMELINE.completedAt) {
    const terminal = scanTerminalStatus(scanTargetId);
    events.push(scanStatusEvent(String(events.length), terminal));
    events.push({
      id: String(events.length + 1),
      type: "done",
      status: terminal,
    });
  }
  return events;
}

/** Every future scan transition still to come, for scheduling live SSE. */
export function pendingScanEvents(
  elapsedMs: number,
  scanTargetId?: string,
): { delayMs: number; event: JobEvent }[] {
  const pending: { delayMs: number; event: JobEvent }[] = [];
  let nextId = scanEventLog(elapsedMs, scanTargetId).length;

  if (elapsedMs < SCAN_TIMELINE.crawlingAt) {
    pending.push({
      delayMs: SCAN_TIMELINE.crawlingAt - elapsedMs,
      event: scanStatusEvent(String(nextId), "crawling"),
    });
    nextId += 1;
  }
  if (elapsedMs < SCAN_TIMELINE.completedAt) {
    pending.push({
      delayMs: SCAN_TIMELINE.completedAt - elapsedMs,
      event: scanStatusEvent(String(nextId), scanTerminalStatus(scanTargetId)),
    });
    nextId += 1;
    pending.push({
      delayMs: SCAN_TIMELINE.completedAt - elapsedMs,
      event: {
        id: String(nextId),
        type: "done",
        status: scanTerminalStatus(scanTargetId),
      },
    });
  }
  return pending;
}

// ---------------------------------------------------------------------
// Run lifecycles - three scenarios the review asked for by name.
// ---------------------------------------------------------------------
interface TimedStep {
  at: number;
  step: Step;
}
interface RunTimeline {
  steps: TimedStep[];
  resolvesAt: number;
  finalStatus: Run["status"];
}

function step(
  index: number,
  at: number,
  overrides: Partial<Step> = {},
): TimedStep {
  return {
    at,
    step: {
      id: `stp_${index}`,
      plan_step_id: null,
      index,
      action: "click",
      target: `#step-${index}`,
      assertion: null,
      status: "pass",
      message: "OK",
      duration_ms: 380,
      screenshot_url: null,
      ...overrides,
    },
  };
}

/** Progresses normally: 5 passing steps, then "passed". */
export const LIVE_PASS_TIMELINE: RunTimeline = {
  steps: [
    step(0, 0, { action: "navigate", target: "https://checkout.example.com/" }),
    step(1, 1200),
    step(2, 2400),
    step(3, 3600),
    step(4, 4800),
  ],
  resolvesAt: 5500,
  finalStatus: "passed",
};

/** Fails partway: two passing steps, then a real failure, then done. */
export const LIVE_FAIL_TIMELINE: RunTimeline = {
  steps: [
    step(0, 0, { action: "navigate", target: "https://checkout.example.com/" }),
    step(1, 1200, { action: "click", target: "#add-to-cart" }),
    step(2, 2400, {
      action: "assert_visible",
      target: "#confirm-button",
      assertion: "is visible within 5000ms",
      status: "fail",
      message:
        'Expected element "#confirm-button" to be visible within 5000ms, ' +
        "but it was not found on the page.",
      duration_ms: 5000,
    }),
    step(3, 2600, {
      status: "skipped",
      message: "Skipped after prior failure",
    }),
  ],
  resolvesAt: 3000,
  finalStatus: "failed",
};

/**
 * Stalls, then times out: two steps arrive normally, then the engine
 * goes silent - no more step events, ever - until the timeout fires. A
 * client watching this should see real "has it stopped, or is this just
 * slow?" ambiguity for the gap between the last step and the timeout,
 * which is the point: a happy-path-only mock can't produce that ambiguity
 * for a console to handle.
 */
export const LIVE_STALL_TIMELINE: RunTimeline = {
  steps: [
    step(0, 0, { action: "navigate", target: "https://checkout.example.com/" }),
    step(1, 1200, { action: "click", target: "#add-to-cart" }),
    // The engine's own verdict on its silence. A REAL step on the
    // timeline, arriving at the moment of the timeout - not something the
    // polling path invents on the side. It used to be synthesised inside
    // computeRunState only, so GET /runs/{id} showed a step the event
    // stream never carried (src/mocks/consistency.test.ts).
    step(2, 15_000, {
      id: "stp_timeout",
      action: "timeout",
      target: "engine",
      status: "fail",
      message:
        "No response from the engine for 14s. The run has been marked as timed out.",
      duration_ms: 13_800,
    }),
  ],
  resolvesAt: 15_000,
  finalStatus: "timed_out",
};

/**
 * A run of an APPROVED plan (B0.5 B7): one executed step per approved plan
 * step, in the approved order, each pointing back at its plan step
 * (`plan_step_id`) - so a proof can say what was approved and what ran.
 */
export function timelineForPlan(plan: Plan): RunTimeline {
  const approvedIds = plan.approval?.step_ids ?? [];
  const steps = approvedIds.map((planStepId, i) => {
    const planStep = plan.steps.find((s) => s.id === planStepId)!;
    const target =
      planStep.binding.type === "element"
        ? planStep.binding.locator
        : planStep.binding.type === "page"
          ? planStep.binding.page_url
          : "";
    return step(i, i * 1_200, {
      id: `stp_${planStepId}`,
      plan_step_id: planStepId,
      action: planStep.action,
      target,
      message: planStep.description,
    });
  });
  return {
    steps,
    resolvesAt: steps.length * 1_200 + 700,
    finalStatus: "passed",
  };
}

export function computeRunState(
  base: Run,
  timeline: RunTimeline,
  elapsedMs: number,
): Run {
  const stepsSoFar = timeline.steps
    .filter((s) => s.at <= elapsedMs)
    .map((s) => s.step);
  const resolved = elapsedMs >= timeline.resolvesAt;

  const passed = stepsSoFar.filter((s) => s.status === "pass").length;
  const pass_rate = stepsSoFar.length > 0 ? passed / stepsSoFar.length : 1;

  const startedAtMs = startTimeFor(base.id);

  return {
    ...base,
    started_at: new Date(startedAtMs).toISOString(),
    steps: stepsSoFar,
    status: resolved ? timeline.finalStatus : "running",
    pass_rate,
    finished_at: resolved
      ? new Date(startedAtMs + timeline.resolvesAt).toISOString()
      : null,
    proof_id:
      resolved && timeline.finalStatus !== "timed_out" ? base.proof_id : null,
    // B0.5 B9: the report exists once the run has finished (a timed-out run
    // produced none - the engine went silent).
    report_url:
      resolved && timeline.finalStatus !== "timed_out"
        ? reportUrl(base.id)
        : null,
  };
}

/**
 * Which base run ids are lifecycle-driven, and which timeline governs
 * each - the single place handlers look this up, so runs.ts and
 * events.ts can't disagree about which ids are dynamic. Mutable (not a
 * plain object) so POST /runs can register a freshly-created live run at
 * request time, not just the three named scenarios.
 */
export const LIVE_RUN_TIMELINES = new Map<string, RunTimeline>([
  ["run_live_pass_1", LIVE_PASS_TIMELINE],
  ["run_live_fail_1", LIVE_FAIL_TIMELINE],
  ["run_live_stall_1", LIVE_STALL_TIMELINE],
  // Same progression as a clean pass; the difference is the TRANSPORT (its
  // first SSE connection is dropped mid-run - handlers/events.ts), which is
  // where reconnect-and-resume gets exercised. Phase B lists "stream
  // disconnect with recovery" as a fourth lifecycle scenario.
  ["run_live_drop_1", LIVE_PASS_TIMELINE],
]);

/** POST /runs calls this to give a freshly-created run a live timeline. */
export function registerRunTimeline(runId: string, timeline: RunTimeline) {
  LIVE_RUN_TIMELINES.set(runId, timeline);
}

/**
 * Cancelling a run rewrites ITS TIMELINE, and nothing else: the steps that
 * had already happened stay as they were; every step still to come becomes
 * `skipped` at the moment of cancellation (the contract: "remaining
 * scenarios are marked skipped"); the run resolves `cancelled` right then.
 * Because polling, the SSE backlog and live SSE delivery all derive from
 * the run's timeline, they can't disagree about a cancellation - the old
 * version special-cased it in the polling path only, so the event stream
 * carried on to a `passed` that never happened, and a polled run's
 * `finished_at` was `new Date()` on every request.
 */
export function timelineCancelledAt(
  timeline: RunTimeline,
  cancelledAtMs: number,
): RunTimeline {
  return {
    steps: timeline.steps.map((s) =>
      s.at <= cancelledAtMs
        ? s
        : {
            at: cancelledAtMs,
            step: {
              ...s.step,
              status: "skipped",
              message: "Skipped: the run was cancelled before this step.",
              duration_ms: 0,
              screenshot_url: null,
            },
          },
    ),
    resolvesAt: cancelledAtMs,
    finalStatus: "cancelled",
  };
}

const cancelListeners = new Map<string, Set<() => void>>();

/** The events handler registers here so an OPEN stream hears about a cancellation (returns an unsubscribe). */
export function onRunCancelled(
  runId: string,
  listener: () => void,
): () => void {
  const set = cancelListeners.get(runId) ?? new Set();
  set.add(listener);
  cancelListeners.set(runId, set);
  return () => set.delete(listener);
}

/** POST /runs/{id}/cancel: freeze the run's timeline at THIS moment, then tell any open stream. */
export function cancelRun(runId: string) {
  const timeline = LIVE_RUN_TIMELINES.get(runId);
  if (!timeline) return;
  LIVE_RUN_TIMELINES.set(
    runId,
    timelineCancelledAt(
      timeline,
      Math.min(elapsedMsFor(runId), timeline.resolvesAt),
    ),
  );
  for (const listener of cancelListeners.get(runId) ?? []) listener();
}

export function resolveRun(base: Run): Run {
  const timeline = LIVE_RUN_TIMELINES.get(base.id);
  if (!timeline) return base;
  return computeRunState(base, timeline, elapsedMsFor(base.id));
}

/** Ordered JobEvents for everything that's happened so far, for SSE backlog. */
export function runEventLog(
  timeline: RunTimeline,
  elapsedMs: number,
): JobEvent[] {
  const events: JobEvent[] = timeline.steps
    .filter((s) => s.at <= elapsedMs)
    .map((s, i) => ({ id: String(i), type: "step", step: s.step }));
  if (elapsedMs >= timeline.resolvesAt) {
    events.push({
      id: String(events.length),
      type: "done",
      status: timeline.finalStatus,
    });
  }
  return events;
}

/** Every future (id, delayMs, JobEvent) still to come, for scheduling live SSE. */
export function pendingRunEvents(
  timeline: RunTimeline,
  elapsedMs: number,
): { delayMs: number; event: JobEvent }[] {
  const pending: { delayMs: number; event: JobEvent }[] = [];
  let nextId = timeline.steps.filter((s) => s.at <= elapsedMs).length;

  for (const s of timeline.steps) {
    if (s.at > elapsedMs) {
      pending.push({
        delayMs: s.at - elapsedMs,
        event: { id: String(nextId), type: "step", step: s.step },
      });
      nextId += 1;
    }
  }
  if (timeline.resolvesAt > elapsedMs) {
    pending.push({
      delayMs: timeline.resolvesAt - elapsedMs,
      event: { id: String(nextId), type: "done", status: timeline.finalStatus },
    });
  }
  return pending;
}
