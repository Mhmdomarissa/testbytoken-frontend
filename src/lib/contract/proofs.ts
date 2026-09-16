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
 * screenshot URL security is an open decision (docs/API_CONTRACT.md):
 * a screenshot of the customer's authenticated app is not public data
 * even when the proof page around it is.
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
      "to the API from a general-purpose route.",
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
