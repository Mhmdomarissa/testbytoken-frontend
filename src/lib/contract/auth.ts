import "./zod-openapi-setup";
import { z } from "zod";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { ErrorSchema, TimestampSchema } from "./common";

/**
 * Our own app's login - magic link, cookie-based. Not to be confused with
 * anything about the customer's application under test: there is no
 * password field for that anywhere in this product (CLAUDE.md).
 */

export const MagicLinkRequestSchema = z
  .object({
    email: z.email(),
  })
  .openapi("MagicLinkRequest");

export const MagicLinkResponseSchema = z
  .object({
    sent: z.boolean(),
  })
  .openapi("MagicLinkResponse");

export const VerifyRequestSchema = z
  .object({
    token: z.string().min(1).openapi({
      description: "One-time token from the magic link email.",
    }),
  })
  .openapi("VerifyRequest");

// The verify response itself carries no session data - the session is an
// httpOnly cookie set by this endpoint (CLAUDE.md: auth token is never
// exposed to JS, never localStorage). This is one of the three route
// handlers that exist in Next per CLAUDE.md's architecture rule: the
// browser calls this through a Next route handler so the handler can set
// the httpOnly cookie, not this backend endpoint directly.
export const VerifyResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .openapi("VerifyResponse");

export const MeResponseSchema = z
  .object({
    id: z.string().min(1),
    email: z.email(),
    capabilities: z
      .object({
        write_actions: z.boolean().openapi({
          description:
            "Whether this account may run steps that change state in a " +
            "target application (`action_class: write`). False on the " +
            "read-only tier. The UI reads this to show write steps blocked " +
            "up front; the SERVER is still authoritative and marks each " +
            "affected plan step `blocked`.",
        }),
      })
      .openapi({
        description:
          "REQUIRED (B0.5 B7). What this account's tier permits. An object, " +
          "not a tier name, so a capability can be added without the client " +
          "having to know what tier implies it.",
      }),
    created_at: TimestampSchema,
  })
  .openapi("Me");

export function registerAuthPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "post",
    path: "/auth/magic-link",
    tags: ["auth"],
    summary: "Request a magic link email",
    request: {
      body: {
        content: { "application/json": { schema: MagicLinkRequestSchema } },
      },
    },
    responses: {
      200: {
        description:
          "Link sent (always 200, regardless of whether the email is registered - do not leak account existence).",
        content: { "application/json": { schema: MagicLinkResponseSchema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/verify",
    tags: ["auth"],
    summary: "Exchange a magic-link token for a session cookie",
    request: {
      body: {
        content: { "application/json": { schema: VerifyRequestSchema } },
      },
    },
    responses: {
      200: {
        description:
          "Session established via httpOnly cookie (Set-Cookie header, not in the JSON body).",
        content: { "application/json": { schema: VerifyResponseSchema } },
      },
      401: {
        description: "Token invalid or expired.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/auth/me",
    tags: ["auth"],
    summary: "Current session",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "The signed-in user.",
        content: { "application/json": { schema: MeResponseSchema } },
      },
      401: {
        description: "No session.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/auth/logout",
    tags: ["auth"],
    summary: "Clear the session",
    security: [{ cookieAuth: [] }],
    responses: {
      200: { description: "Session cookie cleared." },
    },
  });
}
