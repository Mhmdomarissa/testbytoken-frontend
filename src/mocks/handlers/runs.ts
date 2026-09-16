import { http } from "msw";
import { RunDetailSchema, RunSummarySchema, paginated } from "@/lib/contract";
import { json, errorResponse, checkSimulatedError } from "../respond";
import { runs, runPassed } from "../data";

const RunListResponseSchema = paginated(RunSummarySchema);

export const runHandlers = [
  http.post("*/runs", async () => {
    return json(RunDetailSchema, runPassed, { status: 201 });
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

    // tgt_empty matches no runs at all - the honest "no runs yet" state,
    // not a fake empty page caused by an over-strict filter.
    let filtered = runs;
    if (targetId) filtered = filtered.filter((r) => r.target_id === targetId);
    if (suiteId) filtered = filtered.filter((r) => r.suite_id === suiteId);
    if (status) filtered = filtered.filter((r) => r.status === status);

    const page = filtered.slice(cursor, cursor + limit);
    const nextIndex = cursor + limit;
    const next_cursor = nextIndex < filtered.length ? String(nextIndex) : null;

    return json(RunListResponseSchema, { data: page, next_cursor });
  }),

  http.get("*/runs/:id", async ({ params }) => {
    const run = runs.find((r) => r.id === params.id);
    if (!run) return errorResponse(404, "not_found", "Run not found.");
    return json(RunDetailSchema, run);
  }),

  http.post("*/runs/:id/cancel", async ({ params }) => {
    const run = runs.find((r) => r.id === params.id);
    if (!run) return errorResponse(404, "not_found", "Run not found.");
    if (run.finished_at) {
      return errorResponse(409, "already_finished", "Run already finished.");
    }
    return json(RunDetailSchema, {
      ...run,
      status: "cancelled",
      finished_at: new Date().toISOString(),
    });
  }),
];
