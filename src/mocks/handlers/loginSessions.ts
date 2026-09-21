import { http } from "msw";
import {
  CreateLoginSessionRequestSchema,
  LoginSessionSchema,
} from "@/lib/contract";
import { json, errorResponse } from "../respond";
import { targetStore } from "../store";
import {
  cancelLoginSession,
  completeLoginSession,
  createLoginSession,
  resolveLoginSession,
} from "../login";

/**
 * Note what is NOT here: no request accepts a username, password, cookie or
 * token, and no response carries one. There is nothing to accept -
 * CreateLoginSessionRequest is two ids (docs/API_CONTRACT.md: no credential
 * ever traverses this API).
 */
export const loginSessionHandlers = [
  http.post("*/login-sessions", async ({ request }) => {
    const parsed = CreateLoginSessionRequestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return errorResponse(
        422,
        "invalid_request",
        "Give a workspace and a target.",
      );
    }
    if (!targetStore.has(parsed.data.target_id)) {
      return errorResponse(404, "not_found", "Target not found.");
    }
    return json(
      LoginSessionSchema,
      createLoginSession({
        workspaceId: parsed.data.workspace_id,
        targetId: parsed.data.target_id,
      }),
      { status: 201 },
    );
  }),

  http.get("*/login-sessions/:id", async ({ params }) => {
    const session = resolveLoginSession(params.id as string);
    if (!session)
      return errorResponse(404, "not_found", "Login session not found.");
    return json(LoginSessionSchema, session);
  }),

  http.post("*/login-sessions/:id/complete", async ({ params }) => {
    const result = completeLoginSession(params.id as string);
    if (!result.ok) {
      return errorResponse(
        409,
        "login_session_not_active",
        "That login session isn't waiting for a sign-in any more.",
      );
    }
    return json(LoginSessionSchema, result.session);
  }),

  http.post("*/login-sessions/:id/cancel", async ({ params }) => {
    const session = cancelLoginSession(params.id as string);
    if (!session)
      return errorResponse(404, "not_found", "Login session not found.");
    return json(LoginSessionSchema, session);
  }),
];
