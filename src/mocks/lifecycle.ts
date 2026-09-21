import type { z } from "zod";
import type {
  ScanSchema,
  RunDetailSchema,
  StepSchema,
  JobEventSchema,
} from "@/lib/contract";
import { modCheckout, modSettings } from "./data";

type Scan = z.infer<typeof ScanSchema>;
type Run = z.infer<typeof RunDetailSchema>;
type Step = z.infer<typeof StepSchema>;
type JobEvent = z.infer<typeof JobEventSchema>;

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

export function computeScanState(base: Scan, elapsedMs: number): Scan {
  if (elapsedMs >= SCAN_TIMELINE.completedAt) {
    return {
      ...base,
      status: "completed",
      modules: [modCheckout, modSettings],
    };
  }
  if (elapsedMs >= SCAN_TIMELINE.crawlingAt) {
    return { ...base, status: "crawling", modules: [] };
  }
  return { ...base, status: "queued", modules: [] };
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

function scanStatusEvent(id: string, status: Scan["status"]): JobEvent {
  return { id, type: "status", status };
}

/** Ordered JobEvents for a scan's progress so far, for SSE backlog. */
export function scanEventLog(elapsedMs: number): JobEvent[] {
  const events: JobEvent[] = [scanStatusEvent("0", "queued")];
  if (elapsedMs >= SCAN_TIMELINE.crawlingAt)
    events.push(scanStatusEvent("1", "crawling"));
  if (elapsedMs >= SCAN_TIMELINE.completedAt) {
    events.push(scanStatusEvent(String(events.length), "completed"));
    events.push({
      id: String(events.length + 1),
      type: "done",
      status: "completed",
    });
  }
  return events;
}

/** Every future scan transition still to come, for scheduling live SSE. */
export function pendingScanEvents(
  elapsedMs: number,
): { delayMs: number; event: JobEvent }[] {
  const pending: { delayMs: number; event: JobEvent }[] = [];
  let nextId = scanEventLog(elapsedMs).length;

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
      event: scanStatusEvent(String(nextId), "completed"),
    });
    nextId += 1;
    pending.push({
      delayMs: SCAN_TIMELINE.completedAt - elapsedMs,
      event: { id: String(nextId), type: "done", status: "completed" },
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
  ],
  resolvesAt: 15000,
  finalStatus: "timed_out",
};

export function computeRunState(
  base: Run,
  timeline: RunTimeline,
  elapsedMs: number,
): Run {
  const stepsSoFar = timeline.steps
    .filter((s) => s.at <= elapsedMs)
    .map((s) => s.step);
  const resolved = elapsedMs >= timeline.resolvesAt;

  if (resolved && timeline.finalStatus === "timed_out") {
    stepsSoFar.push({
      index: stepsSoFar.length,
      action: "timeout",
      target: "engine",
      assertion: null,
      status: "fail",
      message: `No response from the engine for ${Math.round((timeline.resolvesAt - (timeline.steps.at(-1)?.at ?? 0)) / 1000)}s. The run has been marked as timed out.`,
      duration_ms: timeline.resolvesAt - (timeline.steps.at(-1)?.at ?? 0),
      screenshot_url: null,
    });
  }

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

const cancelledRunIds = new Set<string>();

/** POST /runs/{id}/cancel calls this to freeze a live run's progression. */
export function cancelRun(runId: string) {
  cancelledRunIds.add(runId);
}

export function resolveRun(base: Run): Run {
  const timeline = LIVE_RUN_TIMELINES.get(base.id);
  if (!timeline) return base;
  if (cancelledRunIds.has(base.id)) {
    const elapsedAtCancel = elapsedMsFor(base.id);
    return {
      ...computeRunState(
        base,
        timeline,
        Math.min(elapsedAtCancel, timeline.resolvesAt - 1),
      ),
      status: "cancelled",
      finished_at: new Date().toISOString(),
    };
  }
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
