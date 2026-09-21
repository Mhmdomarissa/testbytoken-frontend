import type { z } from "zod";
import type { LoginSessionSchema } from "@/lib/contract";
import { loginSessionStore } from "./store";

type LoginSession = z.infer<typeof LoginSessionSchema>;

/**
 * B0.5 B8's reference login-session lifecycle, computed from elapsed time
 * so polling always agrees with itself:
 *
 *   0-1s      provisioning
 *   1-3s      ready          (view_url present; the customer hasn't opened it)
 *   3s+       in_progress    (the customer "connected"; until they complete)
 *   complete  completed - if they had connected; a session completed while
 *             still `ready` never saw a sign-in, so it fails with
 *             `no_session_detected`.
 *   10 min    expires_at
 *
 * Designed failure: a target named tgt_unreachable can't get a browser at
 * all (`failed`, `browser_unavailable`). No credential is accepted,
 * stored, or returned anywhere in this file - there is nothing to accept.
 */
export const PROVISION_MS = 1_000;
export const CONNECT_AFTER_MS = 3_000;
export const SESSION_TTL_MS = 10 * 60 * 1_000;

const VIEW_ORIGIN = "https://live-browser.testbytoken.example";

export function createLoginSession(input: {
  workspaceId: string;
  targetId: string;
}): LoginSession {
  const id = `lgn_${Math.random().toString(36).slice(2, 10)}`;
  const createdAtMs = Date.now();
  const session = build(id, input.workspaceId, input.targetId, createdAtMs, {
    createdAtMs,
    completedAtMs: null,
    cancelled: false,
    completionResult: null,
  });
  loginSessionStore.set(id, {
    session,
    createdAtMs,
    completedAtMs: null,
    cancelled: false,
    completionResult: null,
  });
  return session;
}

type Meta = {
  createdAtMs: number;
  completedAtMs: number | null;
  cancelled: boolean;
  completionResult: "completed" | "no_session_detected" | null;
};

function build(
  id: string,
  workspaceId: string,
  targetId: string,
  createdAtMs: number,
  meta: Meta,
  nowMs = Date.now(),
): LoginSession {
  const elapsed = nowMs - createdAtMs;
  const iso = (ms: number) => new Date(ms).toISOString();
  const base = {
    id,
    workspace_id: workspaceId,
    target_id: targetId,
    expires_at: iso(createdAtMs + SESSION_TTL_MS),
    created_at: iso(createdAtMs),
    updated_at: iso(nowMs),
  };

  if (meta.cancelled)
    return { ...base, status: "cancelled", view_url: null, failure: null };

  if (meta.completionResult === "completed") {
    return { ...base, status: "completed", view_url: null, failure: null };
  }
  if (meta.completionResult === "no_session_detected") {
    return {
      ...base,
      status: "failed",
      view_url: null,
      failure: {
        kind: "no_session_detected",
        message:
          "You said you were done, but we didn't see a signed-in session. Open the browser, sign in, then finish.",
      },
    };
  }
  if (targetId === "tgt_unreachable" && elapsed >= PROVISION_MS) {
    return {
      ...base,
      status: "failed",
      view_url: null,
      failure: {
        kind: "browser_unavailable",
        message:
          "We couldn't start a browser for this target. Try again in a moment.",
      },
    };
  }
  if (nowMs >= createdAtMs + SESSION_TTL_MS) {
    return { ...base, status: "expired", view_url: null, failure: null };
  }
  if (elapsed < PROVISION_MS) {
    return { ...base, status: "provisioning", view_url: null, failure: null };
  }
  // A fresh single-use-style ticket every time the session is read - never stored.
  const viewUrl = `${VIEW_ORIGIN}/s/${id}?ticket=${Math.random().toString(36).slice(2, 12)}`;
  return {
    ...base,
    status: elapsed < CONNECT_AFTER_MS ? "ready" : "in_progress",
    view_url: viewUrl,
    failure: null,
  };
}

export function resolveLoginSession(id: string): LoginSession | undefined {
  const entry = loginSessionStore.get(id);
  if (!entry) return undefined;
  return build(
    id,
    entry.session.workspace_id,
    entry.session.target_id,
    entry.createdAtMs,
    entry,
  );
}

export function completeLoginSession(
  id: string,
): { ok: true; session: LoginSession } | { ok: false } {
  const entry = loginSessionStore.get(id);
  const current = resolveLoginSession(id);
  if (!entry || !current) return { ok: false };
  if (current.status !== "ready" && current.status !== "in_progress")
    return { ok: false };
  entry.completionResult =
    current.status === "in_progress" ? "completed" : "no_session_detected";
  entry.completedAtMs = Date.now();
  return { ok: true, session: resolveLoginSession(id)! };
}

export function cancelLoginSession(id: string): LoginSession | undefined {
  const entry = loginSessionStore.get(id);
  if (!entry) return undefined;
  const current = resolveLoginSession(id)!;
  if (
    current.status === "ready" ||
    current.status === "in_progress" ||
    current.status === "provisioning"
  ) {
    entry.cancelled = true;
  }
  return resolveLoginSession(id);
}
