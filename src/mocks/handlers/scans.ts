import { http } from "msw";
import { ScanSchema } from "@/lib/contract";
import { json, errorResponse } from "../respond";
import { loginSessionStore, scanStore, targetStore } from "../store";
import { LIVE_SCAN_IDS, resolveScan, registerLiveScan } from "../lifecycle";
import { resolveLoginSession } from "../login";

/**
 * A login session may only be attached if it exists and is `completed`
 * (B0.5 B8). Returns the error response to send, or null if it's fine.
 */
function checkLoginSession(loginSessionId: string | undefined) {
  if (loginSessionId === undefined) return null;
  if (!loginSessionStore.has(loginSessionId)) {
    return errorResponse(422, "invalid_request", "Unknown login session.");
  }
  const session = resolveLoginSession(loginSessionId);
  if (session?.status !== "completed") {
    return errorResponse(
      409,
      "login_session_not_completed",
      `That login session is ${session?.status ?? "unknown"}, not completed.`,
    );
  }
  return null;
}

export const scanHandlers = [
  http.post("*/scans", async ({ request }) => {
    // Progresses queued -> crawling -> completed (or FAILED, for an
    // unreachable target) in real time (Phase A review, §5) rather than
    // returning an instantly-completed fixture - GET /scans/{id} and
    // GET /jobs/{id}/events both reflect the same timeline
    // (src/mocks/lifecycle.ts).
    const body = (await request.json().catch(() => ({}))) as {
      workspace_id?: string;
      target_id?: string;
      login_session_id?: string;
    };
    const rejected = checkLoginSession(body.login_session_id);
    if (rejected) return rejected;

    const targetId = body.target_id ?? "tgt_checkout";
    const target = targetStore.get(targetId);
    if (!target) return errorResponse(404, "not_found", "Target not found.");

    const id = `scan_${Math.random().toString(36).slice(2, 10)}`;
    const created = {
      id,
      workspace_id: body.workspace_id ?? "wksp_demo",
      target_id: targetId,
      target_url: target.base_url,
      status: "queued" as const,
      parked_reason: null,
      failure: null,
      login_session_id: body.login_session_id ?? null,
      modules: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    scanStore.set(id, created);
    registerLiveScan(id);
    return json(ScanSchema, resolveScan(created), { status: 201 });
  }),

  http.get("*/scans/:id", async ({ params }) => {
    const scan = scanStore.get(params.id as string);
    if (!scan) return errorResponse(404, "not_found", "Scan not found.");
    return json(ScanSchema, resolveScan(scan));
  }),

  http.post("*/scans/:id/continue", async ({ params, request }) => {
    const scan = scanStore.get(params.id as string);
    if (!scan) return errorResponse(404, "not_found", "Scan not found.");
    const current = resolveScan(scan);
    if (current.status !== "parked") {
      return errorResponse(409, "not_parked", "Scan is not currently parked.");
    }
    const body = (await request.json().catch(() => ({}))) as {
      login_session_id?: string;
    };
    // A scan parked for `login_required` can only continue with a
    // completed login session attached - the session is how the crawl gets
    // signed in, and nothing else can supply that (B0.5 B8).
    if (current.parked_reason === "login_required") {
      if (!body.login_session_id) {
        return errorResponse(
          422,
          "invalid_request",
          "This scan is waiting for a sign-in: attach a completed login session.",
        );
      }
      const rejected = checkLoginSession(body.login_session_id);
      if (rejected) return rejected;
    }
    // Continuing RECORDS the login session on the scan and it stays that way:
    // a live scan then resolves as one that had a session all along (it
    // completes), and a static parked fixture is stored as completed.
    const loginSessionId = body.login_session_id ?? current.login_session_id;
    const base = scanStore.get(current.id)!;
    const continued = LIVE_SCAN_IDS.has(current.id)
      ? { ...base, login_session_id: loginSessionId }
      : {
          ...base,
          status: "completed" as const,
          parked_reason: null,
          login_session_id: loginSessionId,
        };
    scanStore.set(current.id, {
      ...continued,
      updated_at: new Date().toISOString(),
    });
    return json(ScanSchema, resolveScan(scanStore.get(current.id)!));
  }),
];
