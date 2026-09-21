import "./zod-openapi-setup";
import { z } from "zod";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  ErrorSchema,
  IdSchema,
  TimestampSchema,
  extensibleEnum,
} from "./common";

/**
 * B0.5 B8 - interactive login. All of it is REQUIRED.
 *
 * Testing an authenticated application means the CUSTOMER signs in - to
 * their own application, in a live browser we hand them, MFA and SSO
 * included. This resource models that handoff. It replaces nothing: the
 * workspace states (`booting/ready/...`) describe the ENGINE PROCESS, not
 * the customer's sign-in, which is why they could not carry it.
 *
 * ---------------------------------------------------------------------
 * NO CREDENTIAL EVER TRAVERSES THIS API. State of the contract, not a
 * style preference (CLAUDE.md: there is no password field, anywhere):
 *
 *   - No request in this contract accepts a username, password, token,
 *     cookie, or storage state. An implementer MUST NOT add a convenience
 *     field for any of them - not "just for testing", not optional.
 *   - The captured session (cookies, storage) lives only inside the
 *     engine. It is referenced everywhere by the opaque `id` of the
 *     LoginSession and is never returned by any endpoint, in any field.
 *   - `failure.message`, logs and error bodies MUST NOT contain page
 *     content, typed input, or captured session data.
 * ---------------------------------------------------------------------
 */

export const LoginSessionStatusSchema = extensibleEnum(
  [
    "provisioning",
    "ready",
    "in_progress",
    "completed",
    "expired",
    "failed",
    "cancelled",
  ],
  "`provisioning`: the live browser is starting. `ready`: it is up and " +
    "waiting for the customer to open `view_url`. `in_progress`: the " +
    "customer has connected and is signing in. `completed`: the customer " +
    "finished and the engine captured the session - runs and scans may " +
    "reference it. `expired`: `expires_at` passed before completion (or, " +
    "once completed, the captured session is no longer usable). `failed`: " +
    'see `failure`. `cancelled`: abandoned. ("Not started" is not a ' +
    "server state - it is the absence of a LoginSession.)",
);

export const LoginFailureKindSchema = extensibleEnum(
  ["browser_unavailable", "no_session_detected", "internal"],
  "`browser_unavailable`: the live browser could not be started or died. " +
    "`no_session_detected`: the customer said they were done but no signed-in " +
    "session was found. `internal`: our fault.",
);

export const LoginSessionSchema = z
  .object({
    id: IdSchema,
    workspace_id: IdSchema,
    target_id: IdSchema,
    status: LoginSessionStatusSchema,
    view_url: z
      .url()
      .nullable()
      .openapi({
        description:
          "Where the customer reaches the live browser. Non-null only while " +
          "`ready` / `in_progress`. MUST be on a separate origin from the app " +
          "(a remote-browser stream is an untrusted-content origin) and MUST " +
          "NOT be a long-lived bearer link: it MAY carry a single-use ticket, " +
          "valid for at most 60 seconds, exchanged on first load for an " +
          "httpOnly cookie scoped to that origin, after which it is useless. " +
          "This is the one deliberate exception to 'never a token in a URL' " +
          "(docs/API_CONTRACT.md), and is what makes the live view usable " +
          "cross-origin at all. Re-fetch the session to get a fresh one; " +
          "never store it.",
      }),
    expires_at: TimestampSchema.openapi({
      description:
        "When this session stops being usable: before completion, the " +
        "deadline to finish signing in; after completion, when the captured " +
        "session lapses for runs. One field, stage-dependent meaning, so a " +
        "client only ever asks one question of it - is it past yet.",
    }),
    failure: z
      .object({ kind: LoginFailureKindSchema, message: z.string() })
      .nullable()
      .openapi({ description: "Non-null exactly when `status` is `failed`." }),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
  })
  .openapi("LoginSession");

export const CreateLoginSessionRequestSchema = z
  .object({ workspace_id: IdSchema, target_id: IdSchema })
  .openapi("CreateLoginSessionRequest");

const LoginSessionIdParam = z.object({ id: IdSchema });

export function registerLoginSessionPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "post",
    path: "/login-sessions",
    tags: ["login-sessions"],
    summary: "Start an interactive login for a target",
    description:
      "Boots a live browser at the target for the customer to sign in " +
      "themselves. Takes no credentials. Returns 201 `provisioning`; poll " +
      "`GET /login-sessions/{id}` until `ready`.",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": { schema: CreateLoginSessionRequestSchema },
        },
      },
    },
    responses: {
      201: {
        description: "Login session created.",
        content: { "application/json": { schema: LoginSessionSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/login-sessions/{id}",
    tags: ["login-sessions"],
    summary: "Get a login session (poll for readiness / completion / expiry)",
    description:
      "Also the way to obtain a fresh `view_url`. Readiness, completion and " +
      "expiry are all reported here, by polling - not on the job event " +
      "stream (a login session is not a long-running job with steps).",
    security: [{ cookieAuth: [] }],
    request: { params: LoginSessionIdParam },
    responses: {
      200: {
        description: "The login session.",
        content: { "application/json": { schema: LoginSessionSchema } },
      },
      404: {
        description: "Not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/login-sessions/{id}/complete",
    tags: ["login-sessions"],
    summary: "The customer says they have finished signing in",
    description:
      "Takes no body and no credentials - it is only the customer's " +
      "statement 'I'm done'. The engine checks that a signed-in session " +
      "exists and captures it: on success the session becomes `completed`; " +
      "if none is found, `failed` with kind `no_session_detected`.",
    security: [{ cookieAuth: [] }],
    request: { params: LoginSessionIdParam },
    responses: {
      200: {
        description: "The session, now `completed` or `failed`.",
        content: { "application/json": { schema: LoginSessionSchema } },
      },
      409: {
        description:
          "`login_session_not_active`: not `ready`/`in_progress` (already " +
          "completed, expired, failed or cancelled).",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/login-sessions/{id}/cancel",
    tags: ["login-sessions"],
    summary: "Abandon a login session and tear down its browser",
    description:
      "Nice-to-have: an unfinished session also lapses at `expires_at`.",
    security: [{ cookieAuth: [] }],
    request: { params: LoginSessionIdParam },
    responses: {
      200: {
        description: "The cancelled session.",
        content: { "application/json": { schema: LoginSessionSchema } },
      },
    },
  });
}
