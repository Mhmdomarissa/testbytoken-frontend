import "./zod-openapi-setup";
import { z } from "zod";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  ErrorSchema,
  IdSchema,
  TimestampSchema,
  extensibleEnum,
} from "./common";
import { CoverageSchema, StepSchema } from "./runs";
import { ActionClassSchema } from "./plans";

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

export const ProofVerdictSchema = extensibleEnum(
  ["passed", "failed", "cancelled", "timed_out"],
  "The terminal outcome of the run this proof attests to, frozen at creation.",
);

export const UncoveredReasonSchema = extensibleEnum(
  ["not_uniquely_locatable", "ungrounded", "skipped", "blocked"],
  "Why a candidate element has no executed scenario.",
);

/**
 * B0.5 B10 - a proof carries a FROZEN SNAPSHOT of the result it attests to.
 * Not a link to the run. Two structural reasons:
 *
 *   1. A proof that reads through to live data isn't a proof: re-run the
 *      test and it silently changes. The value is that it attests to ONE
 *      moment.
 *   2. The public page has no credentials. Giving it a path to
 *      authenticated data to work around that is how a data leak is built.
 *
 * So everything the public proof page must show - verdict, pass rate AND
 * coverage (numerator and denominator), what was NOT covered, target,
 * timestamps, every step with its status and reason, the plan that was
 * approved - is in this object, copied at creation, and nothing here
 * changes afterwards. `hash` is over the canonical JSON of this snapshot.
 */
export const ProofSnapshotSchema = z
  .object({
    verdict: ProofVerdictSchema,
    pass_rate: z.number().min(0).max(1).openapi({
      description:
        "Frozen. Never shown without `coverage` (Phase B section 1.2).",
    }),
    coverage: CoverageSchema,
    target: z.object({ name: z.string(), base_url: z.url() }).openapi({
      description:
        "A frozen COPY of the target's name and URL - not a reference. " +
        "Renaming or deleting the target later does not alter the proof.",
    }),
    started_at: TimestampSchema,
    finished_at: TimestampSchema,
    duration_ms: z.number().int().min(0),
    token_cost: z.number().min(0),
    steps: z.array(StepSchema).openapi({
      description:
        "Every step with its status and reason (`message`). `screenshot_url` " +
        "is authorized per endpoint - see the Proof/PublicProof endpoints.",
    }),
    plan: z
      .object({
        id: IdSchema,
        intent: z.string(),
        approved_at: TimestampSchema,
        approved_steps: z.array(
          z.object({
            id: IdSchema,
            description: z.string(),
            action_class: ActionClassSchema,
          }),
        ),
        excluded_steps: z.array(
          z.object({
            id: IdSchema,
            description: z.string(),
            action_class: ActionClassSchema,
            reason: extensibleEnum(
              ["removed_by_user", "ungrounded", "blocked"],
              "Why a proposed step was not approved to run.",
            ),
          }),
        ),
      })
      .nullable()
      .openapi({
        description:
          "What was PROPOSED and what was APPROVED, frozen from the plan. " +
          "Null for a run that came from a suite rather than a plan. A proof " +
          "that cannot say what was approved is not a proof.",
      }),
    uncovered_total: z
      .number()
      .int()
      .min(0)
      .openapi({
        description:
          "MUST equal `coverage.candidate - coverage.generated`. The gap, as a " +
          "number.",
      }),
    uncovered: z
      .array(
        z.object({
          label: z.string().openapi({ description: "Untrusted text." }),
          page_url: z.url(),
          reason_code: UncoveredReasonSchema,
          reason: z.string().openapi({ description: "Untrusted text." }),
        }),
      )
      .openapi({
        description:
          "WHICH candidates were not covered, with why - what the public " +
          "page shows under 'not covered'. At most 200 entries; " +
          "`uncovered_total` is the true count when there are more. A proof " +
          "that hides the gaps is not a proof.",
      }),
  })
  .openapi("ProofSnapshot");

/** What the PUBLIC page receives: the snapshot and nothing from the authenticated world. */
export const PublicProofSchema = z
  .object({
    id: IdSchema,
    hash: z.string().openapi({
      description:
        "Tamper-evident hash over the canonical JSON of `snapshot`, e.g. sha256 hex digest.",
      example: "sha256:9f2c...",
    }),
    created_at: TimestampSchema,
    snapshot: ProofSnapshotSchema,
  })
  .openapi("PublicProof");

/**
 * The owner's view: the same immutable proof plus the two things only the
 * owner may see - which run it came from, and its sharing state.
 */
export const ProofSchema = PublicProofSchema.extend({
  run_id: IdSchema,
  share: ShareSchema.nullable(),
}).openapi("Proof");

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
      "Revoking sharing (`POST /proofs/{id}/share` with `enabled: false`) " +
      "kills THIS page and its screenshot URLs and nothing else: the proof " +
      "itself stays, unchanged, in the owner's authenticated view. " +
      "Rendered by a public Next route handler/page per CLAUDE.md, not proxied " +
      "to the API from a general-purpose route. Screenshot URLs on this response " +
      "are proof-scoped: signed against this proof's own share token, valid only " +
      "for this one run, and revoked the moment the proof is revoked (a proof " +
      "page that still renders screenshots after revocation is a bug). Never a " +
      "bearer/session token in the URL - see docs/API_CONTRACT.md.",
    request: { params: ShareTokenParam },
    responses: {
      200: {
        description:
          "The proof, as `PublicProof`: the frozen snapshot and NOTHING else - " +
          "no run id, no workspace/user ids, no share token, no ids that " +
          "resolve to authenticated data. Self-contained by construction.",
        content: { "application/json": { schema: PublicProofSchema } },
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
