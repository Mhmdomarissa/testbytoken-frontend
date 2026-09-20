import "./zod-openapi-setup";
import { z } from "zod";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { ErrorSchema, IdSchema, TimestampSchema } from "./common";
import { StepSchema } from "./runs";

/**
 * A proof is the finished, tamper-evident artefact of a run: steps,
 * screenshots, a hash, and its compute cost. It can optionally be shared
 * publicly via an opaque token - the public route is unauthenticated by
 * design (that's the point of sharing a proof), which is exactly why
 * screenshot authorization (docs/API_CONTRACT.md) is two classes, not one:
 *   - GET /proofs/{id} (authenticated): session-scoped screenshot URLs,
 *     same cookie as the rest of the API.
 *   - GET /p/{token} (public): proof-scoped screenshot URLs, signed
 *     against that proof's own share token, scoped to that one run, and
 *     revoked the moment the proof is revoked. Never a bearer token in
 *     the URL itself.
 * Same Proof/Step shape either way - the backing authorization differs
 * per endpoint, which is exactly why it's stated per endpoint below
 * rather than once at the type level.
 */

export const ShareSchema = z
  .object({
    token: z.string(),
    url: z
      .url()
      .openapi({ description: "Full public URL, i.e. `{origin}/p/{token}`." }),
    enabled: z.boolean(),
    expires_at: TimestampSchema.nullable(),
  })
  .openapi("Share");

export const ProofSchema = z
  .object({
    id: IdSchema,
    run_id: IdSchema,
    hash: z.string().openapi({
      description:
        "Tamper-evident hash over the canonical step sequence, e.g. sha256 hex digest.",
      example: "sha256:9f2c...",
    }),
    token_cost: z.number().min(0),
    steps: z.array(StepSchema),
    share: ShareSchema.nullable(),
    created_at: TimestampSchema,
  })
  .openapi("Proof");

export const CreateShareRequestSchema = z
  .object({
    enabled: z.boolean().default(true),
    expires_in_seconds: z
      .number()
      .int()
      .min(60)
      .optional()
      .openapi({ description: "Omit for a non-expiring share link." }),
  })
  .openapi("CreateShareRequest");

const ProofIdParam = z.object({ id: IdSchema });
const ShareTokenParam = z.object({ token: z.string() });

export function registerProofPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/proofs/{id}",
    tags: ["proofs"],
    summary: "Get a proof (authenticated)",
    description:
      "Screenshot URLs on this response are session-scoped: authorized by the " +
      "same session cookie as any other API call, not signed or token-bearing. " +
      "See docs/API_CONTRACT.md's screenshot authorization section.",
    security: [{ cookieAuth: [] }],
    request: { params: ProofIdParam },
    responses: {
      200: {
        description: "The proof.",
        content: { "application/json": { schema: ProofSchema } },
      },
      404: {
        description: "Not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/p/{token}",
    tags: ["proofs"],
    summary: "Public, unauthenticated proof view",
    description:
      "No cookie required - this is the link a customer shares externally. " +
      "Rendered by a public Next route handler/page per CLAUDE.md, not proxied " +
      "to the API from a general-purpose route. Screenshot URLs on this response " +
      "are proof-scoped: signed against this proof's own share token, valid only " +
      "for this one run, and revoked the moment the proof is revoked (a proof " +
      "page that still renders screenshots after revocation is a bug). Never a " +
      "bearer/session token in the URL - see docs/API_CONTRACT.md.",
    request: { params: ShareTokenParam },
    responses: {
      200: {
        description: "The proof.",
        content: { "application/json": { schema: ProofSchema } },
      },
      404: {
        description: "Token invalid, expired, or sharing disabled.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/proofs/{id}/share",
    tags: ["proofs"],
    summary: "Create or rotate a proof's public share link",
    security: [{ cookieAuth: [] }],
    request: {
      params: ProofIdParam,
      body: {
        content: { "application/json": { schema: CreateShareRequestSchema } },
      },
    },
    responses: {
      200: {
        description: "Share link.",
        content: { "application/json": { schema: ShareSchema } },
      },
    },
  });
}
