import { http } from "msw";
import type { z } from "zod";
import {
  CoverageSchema,
  RunDetailSchema,
  RunSummarySchema,
  paginated,
} from "@/lib/contract";
import { HttpResponse } from "msw";
import {
  json,
  errorResponse,
  checkSimulatedError,
  rehostMediaUrls,
} from "../respond";
import { loginSessionStore, runStore } from "../store";
import { resolveLoginSession } from "../login";
import { planCoverage, resolvePlan } from "../planning";
import {
  resolveRun,
  registerRunTimeline,
  cancelRun,
  LIVE_PASS_TIMELINE,
  timelineForPlan,
} from "../lifecycle";

const RunListResponseSchema = paginated(RunSummarySchema);

export const runHandlers = [
  http.post("*/runs", async ({ request }) => {
    // A fresh run always progresses normally (the common case) - the
    // fail/stall scenarios are the named, directly-fetchable run_live_*
    // fixtures (src/mocks/lifecycle.ts), not something POST /runs picks at
    // random. Real-time progress, not an instantly "passed" static payload
    // - see the Phase A review, §5.
    const body = (await request.json().catch(() => ({}))) as {
      workspace_id?: string;
      target_id?: string;
      suite_id?: string;
      plan_id?: string;
      login_session_id?: string;
    };

    // B0.5 B7: exactly one of suite_id / plan_id.
    if (Boolean(body.suite_id) === Boolean(body.plan_id)) {
      return errorResponse(
        422,
        "invalid_request",
        "Give exactly one of suite_id or plan_id.",
      );
    }

    if (body.login_session_id) {
      if (!loginSessionStore.has(body.login_session_id)) {
        return errorResponse(422, "invalid_request", "Unknown login session.");
      }
      const session = resolveLoginSession(body.login_session_id);
      if (session?.status !== "completed") {
        return errorResponse(
          409,
          "login_session_not_completed",
          `That login session is ${session?.status ?? "unknown"}, not completed.`,
        );
      }
    }

    let timeline = LIVE_PASS_TIMELINE;
    let coverage: z.infer<typeof CoverageSchema> = {
      basis: "inventory",
      generated: 21,
      candidate: 24,
    };
    if (body.plan_id) {
      const plan = resolvePlan(body.plan_id);
      if (!plan) return errorResponse(404, "not_found", "Plan not found.");
      if (plan.status !== "approved") {
        return errorResponse(
          409,
          "plan_not_approved",
          `That plan is ${plan.status}. Only an approved plan can run.`,
        );
      }
      timeline = timelineForPlan(plan);
      coverage = planCoverage(plan);
    }

    const id = `run_${Math.random().toString(36).slice(2, 10)}`;
    const created = {
      id,
      workspace_id: body.workspace_id ?? "wksp_demo",
      target_id: body.target_id ?? "tgt_checkout",
      suite_id: body.suite_id ?? null,
      plan_id: body.plan_id ?? null,
      login_session_id: body.login_session_id ?? null,
      report_url: null,
      status: "running" as const,
      pass_rate: null,
      coverage,
      token_cost: 1.1,
      proof_id: null,
      started_at: new Date().toISOString(),
      finished_at: null,
      steps: [],
    };
    runStore.set(id, created);
    registerRunTimeline(id, timeline);
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

  http.get("*/runs/:id", async ({ params, request }) => {
    const run = runStore.get(params.id as string);
    if (!run) return errorResponse(404, "not_found", "Run not found.");
    const origin = new URL(request.url).origin;
    return json(RunDetailSchema, rehostMediaUrls(resolveRun(run), origin));
  }),

  // B0.5 B9: the engine's HTML report. UNTRUSTED content, served so that
  // even direct navigation is sandboxed (`Content-Security-Policy: sandbox`
  // with no allow-* tokens). The body is deliberately hostile: a script that
  // tries to reach the embedding page. In a correctly sandboxed iframe it
  // never runs - B8's browser test asserts exactly that.
  http.get("*/runs/:id/report", async ({ params }) => {
    const run = runStore.get(params.id as string);
    if (!run) return errorResponse(404, "not_found", "Run not found.");
    const current = resolveRun(run);
    if (!current.report_url) {
      return errorResponse(404, "not_found", "The run has not finished.");
    }
    const rows = current.steps
      .map(
        (s) =>
          `<li>${escapeHtml(s.action)} ${escapeHtml(s.target)}: ${escapeHtml(s.status)}</li>`,
      )
      .join("");
    const html = `<!doctype html><meta charset="utf-8"><title>Report ${escapeHtml(current.id)}</title>
<h1>Run ${escapeHtml(current.id)}</h1><ol>${rows}</ol>
<p id="hostile"><img src=x onerror="window.parent.postMessage('report-script-ran','*')"></p>
<script>window.parent.postMessage('report-script-ran','*')</script>`;
    return new HttpResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "sandbox",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
