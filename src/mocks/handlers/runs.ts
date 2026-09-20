import { http } from "msw";
import { RunDetailSchema, RunSummarySchema, paginated } from "@/lib/contract";
import { json, errorResponse, checkSimulatedError } from "../respond";
import { runStore } from "../store";
import {
  resolveRun,
  registerRunTimeline,
  cancelRun,
  LIVE_PASS_TIMELINE,
} from "../lifecycle";

const RunListResponseSchema = paginated(RunSummarySchema);

export const runHandlers = [
  http.post("*/runs", async () => {
    // A fresh run always progresses normally (the common case) - the
    // fail/stall scenarios are the three named, directly-fetchable
    // run_live_* fixtures (src/mocks/lifecycle.ts), not something POST
    // /runs picks at random. Real-time progress, not an instantly
    // "passed" static payload - see the Phase A review, §5.
    const id = `run_${Math.random().toString(36).slice(2, 10)}`;
    const created = {
      id,
      workspace_id: "wksp_demo",
      target_id: "tgt_checkout",
      suite_id: "suite_checkout",
      status: "running" as const,
      pass_rate: 1,
      coverage: { generated: 21, candidate: 24 },
      token_cost: 1.1,
      proof_id: null,
      started_at: new Date().toISOString(),
      finished_at: null,
      steps: [],
    };
    runStore.set(id, created);
    registerRunTimeline(id, LIVE_PASS_TIMELINE);
    return json(RunDetailSchema, resolveRun(created), { status: 201 });
  }),

  http.get("*/runs", async ({ request }) => {
    const simulatedError = checkSimulatedError(request);
    if (simulatedError) return simulatedError;

    const url = new URL(request.url);
    const targetId = url.searchParams.get("target_id");
    const suiteId = url.searchParams.get("suite_id");
    const status = url.searchParams.get("status");
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const cursor = Number(url.searchParams.get("cursor") ?? "0");

    // Resolve live runs to their current state before filtering, so
    // ?status= reflects what's true right now, not a placeholder.
    let filtered = [...runStore.values()].map(resolveRun);
    // tgt_empty matches no runs at all - the honest "no runs yet" state,
    // not a fake empty page caused by an over-strict filter.
    if (targetId) filtered = filtered.filter((r) => r.target_id === targetId);
    if (suiteId) filtered = filtered.filter((r) => r.suite_id === suiteId);
    if (status) filtered = filtered.filter((r) => r.status === status);

    const page = filtered.slice(cursor, cursor + limit);
    const nextIndex = cursor + limit;
    const next_cursor = nextIndex < filtered.length ? String(nextIndex) : null;

    return json(RunListResponseSchema, { data: page, next_cursor });
  }),

  http.get("*/runs/:id", async ({ params }) => {
    const run = runStore.get(params.id as string);
    if (!run) return errorResponse(404, "not_found", "Run not found.");
    return json(RunDetailSchema, resolveRun(run));
  }),

  http.post("*/runs/:id/cancel", async ({ params }) => {
    const run = runStore.get(params.id as string);
    if (!run) return errorResponse(404, "not_found", "Run not found.");
    const current = resolveRun(run);
    if (current.finished_at) {
      return errorResponse(409, "already_finished", "Run already finished.");
    }
    cancelRun(current.id);
    return json(RunDetailSchema, resolveRun(run));
  }),
];
