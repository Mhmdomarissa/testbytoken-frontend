import "./zod-openapi-setup";
import { z } from "zod";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  ErrorSchema,
  IdSchema,
  JobStatusSchema,
  PaginationQuerySchema,
  TimestampSchema,
  extensibleEnum,
  paginated,
} from "./common";

/**
 * A run executes a suite's scenarios and produces per-step results.
 *
 * NON-NEGOTIABLE (docs/PHASE_A.md): every run carries both pass_rate AND
 * coverage. Pass rate alone is misleading - the engine correctly declines
 * to generate tests for elements it can't uniquely locate, so a green run
 * can hide low coverage. Both fields are required (not optional) on every
 * shape below, including the list view, so the UI can never render one
 * without the other.
 *
 * pass_rate is NULL until the run is terminal (Part P follow-up). A pass
 * rate over the steps that have run so far is a number about a run that
 * hasn't finished - "100% pass" on a run that ends at 50% - and the UI
 * rendered exactly that on the runs list. Nullable, not optional: the key
 * is always present, so "missing" and "not yet" stay distinguishable.
 */

export const RunStatusSchema = JobStatusSchema.extract([
  "queued",
  "running",
  "passed",
  "failed",
  "cancelled",
  "timed_out",
]).openapi({
  description:
    "Overall run status - the run-shaped subset of the JobStatus vocabulary. " +
    "`timed_out` is distinct from `failed`: a failure has a specific reason " +
    "from a specific step; a timeout is the absence of information (the " +
    "engine stopped responding) and carries no such reason. Extensible: new " +
    "members MAY be added; clients MUST tolerate unknown members.",
  "x-extensible-enum": true,
});

// Same six values as the app's design-token status scale
// (styles/tokens.css --status-*) - one vocabulary for step status end to
// end, engine to pixel.
export const StepStatusSchema = extensibleEnum(
  ["pass", "fail", "running", "skipped", "warning", "queued"],
  "Per-step status. Matches the design system's status token names 1:1.",
);

export const StepSchema = z
  .object({
    id: IdSchema.openapi({
      description:
        "REQUIRED (B0.5 B1). Stable identity of this step, unique within its " +
        "run: minted when the step is created and never derived from its " +
        "position. Clients key step state on this, not on `index` - a run " +
        "whose steps are re-indexed (a plan edit, an inserted retry) must " +
        "not merge two distinct steps into one. The same `id` appears on " +
        "every event and response that mentions the step.",
      example: "stp_3f9a1c",
    }),
    index: z.number().int().min(0).openapi({
      description: "Display order only. Not an identity - see `id`.",
    }),
    plan_step_id: IdSchema.nullable().openapi({
      description:
        "The approved plan step this executed step came from; null for a " +
        "run that did not come from a plan. Lets a proof say what was " +
        "approved and what actually ran.",
    }),
    action: z.string().openapi({
      description:
        "Engine-defined action name, e.g. `click`, `fill`, `navigate`, `assert_visible`. Intentionally an open string, not an enum - the engine's action vocabulary evolves independently of this contract.",
    }),
    target: z.string().openapi({
      description: "Locator or description of what the action acted on.",
    }),
    assertion: z.string().nullable(),
    status: StepStatusSchema,
    message: z.string().openapi({
      description:
        "Human-readable outcome, e.g. the assertion failure detail. Rendered as inert text - never HTML (CLAUDE.md).",
    }),
    duration_ms: z.number().int().min(0),
    screenshot_url: z
      .url()
      .nullable()
      .openapi({
        description:
          "Resolved, ready-to-fetch URL - never a token embedded in the URL itself " +
          "(docs/API_CONTRACT.md). On GET /runs/{id} this is a session-authenticated " +
          "route (same cookie as the rest of the API): this Step only ever appears " +
          "here inside the authenticated app. When the same Step shape appears " +
          "embedded in a Proof (GET /proofs/{id} or the public GET /p/{token}), see " +
          "Proof's own screenshot authorization split in docs/API_CONTRACT.md - the " +
          "field name and shape are identical, the backing authorization is not.",
      }),
  })
  .openapi("Step");

export const CoverageBasisSchema = extensibleEnum(
  ["inventory", "plan"],
  "What `generated` and `candidate` COUNT. `inventory` (a suite run): " +
    "`candidate` = elements the engine found, `generated` = those it could " +
    "uniquely locate and so generate a scenario for. `plan` (a run from a " +
    "plan): `candidate` = steps the plan proposed, `generated` = steps " +
    "approved to run. The two are different denominators and are NOT " +
    "comparable: 2 of 5 plan steps says nothing about how much of the " +
    "application was tested - see the proof's `plan.grounded_against` for " +
    "that. A client MUST label a coverage figure with its basis.",
);

export const CoverageSchema = z
  .object({
    basis: CoverageBasisSchema,
    generated: z.number().int().min(0).openapi({
      description:
        "Scenarios actually generated - i.e. elements that were uniquely locatable. FOR A PLAN RUN (`plan_id` non-null): the number of plan steps approved to run.",
    }),
    candidate: z.number().int().min(0).openapi({
      description:
        "Total candidate elements the engine attempted to generate scenarios for. FOR A PLAN RUN (`plan_id` non-null): the number of steps the plan PROPOSED, so everything left out of the approval - by the person, or because it could not be approved - is inside the denominator and shows as not covered.",
    }),
  })
  .openapi("Coverage");

const RunSharedFields = {
  id: IdSchema,
  workspace_id: IdSchema,
  target_id: IdSchema,
  suite_id: IdSchema.nullable().openapi({
    description:
      "The suite this run executed: NULLABLE - non-null only for a suite-originated run, null for a run that came from a plan. Exactly one of `suite_id` / `plan_id` is set. Suites survive alongside plans; no further suite semantics are defined until Phase C.",
  }),
  plan_id: IdSchema.nullable().openapi({
    description:
      "REQUIRED (B0.5 B7). The approved plan this run executes, or null for a suite run. A run references the plan it came from; that plan is immutable.",
  }),
  login_session_id: IdSchema.nullable().openapi({
    description:
      "The captured login session the run used (B0.5 B8), or null. An opaque reference - the session itself is never returned by any endpoint.",
  }),
  status: RunStatusSchema,
  pass_rate: z.number().min(0).max(1).nullable().openapi({
    description:
      "Fraction of the scenarios/steps that RAN which passed. NULL while `status` is `queued` or `running`, and non-null once it is terminal (`passed`, `failed`, `cancelled`, `timed_out`): a rate over the steps so far is not the run's pass rate, and must not be reported as one. A client MUST NOT render a pass rate for a status it does not recognise as terminal, whatever this field holds. Always present alongside coverage - and never a substitute for it: for a plan run, 2 of 5 proposed steps approved and both passing is a pass_rate of 1 with coverage 2 of 5.",
  }),
  coverage: CoverageSchema,
  token_cost: z
    .number()
    .min(0)
    .openapi({ description: "Compute cost in test-tokens." }),
  proof_id: IdSchema.nullable().openapi({
    description: "Set once the run has finished.",
  }),
  started_at: TimestampSchema,
  finished_at: TimestampSchema.nullable(),
};

export const RunSummarySchema = z.object(RunSharedFields).openapi("RunSummary");

export const RunDetailSchema = z
  .object({
    ...RunSharedFields,
    report_url: z
      .url()
      .nullable()
      .openapi({
        description:
          "REQUIRED (B0.5 B9). Resolved URL of the engine's generated HTML " +
          "report (`GET /runs/{id}/report`), or null until the run finishes. " +
          "Session-scoped, like every other authenticated URL here - never a " +
          "token in the URL. UNTRUSTED CONTENT: see the endpoint.",
      }),
    steps: z.array(StepSchema),
  })
  .openapi("RunDetail");

export const CreateRunRequestSchema = z
  .object({
    workspace_id: IdSchema,
    target_id: IdSchema,
    suite_id: IdSchema.optional().openapi({
      description:
        "Run an existing suite. Exactly one of `suite_id` / `plan_id` MUST be given; anything else is a 422 `invalid_request`.",
    }),
    plan_id: IdSchema.optional().openapi({
      description:
        "Run an APPROVED plan (B0.5 B7) - what executes is the plan's approved step list, in that order. A plan that is not `approved` is a 409 `plan_not_approved`.",
    }),
    login_session_id: IdSchema.optional().openapi({
      description:
        "A `completed`, unexpired login session to run under (B0.5 B8). Opaque reference; no credential ever crosses this API.",
    }),
  })
  .openapi("CreateRunRequest");

export const RunListQuerySchema = PaginationQuerySchema.extend({
  target_id: IdSchema.optional(),
  suite_id: IdSchema.optional(),
  status: RunStatusSchema.optional(),
});

const RunIdParam = z.object({ id: IdSchema });

export function registerRunPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "post",
    path: "/runs",
    tags: ["runs"],
    summary: "Start a run of a suite against a target",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: CreateRunRequestSchema } },
      },
    },
    responses: {
      201: {
        description: "Run queued.",
        content: { "application/json": { schema: RunDetailSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/runs",
    tags: ["runs"],
    summary: "List runs, paginated and filtered",
    security: [{ cookieAuth: [] }],
    request: { query: RunListQuerySchema },
    responses: {
      200: {
        description: "A page of runs.",
        content: {
          "application/json": { schema: paginated(RunSummarySchema) },
        },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/runs/{id}",
    tags: ["runs"],
    summary: "Get a run's full detail, including every step",
    description:
      "AUTHORITATIVE. This response is the source of truth for a run's " +
      "status and steps. `GET /jobs/{id}/events` is a delivery mechanism " +
      "for changes to this state, never a second opinion about it: if the " +
      "two ever disagree, this wins. Clients reconcile against it when a " +
      "stream reconnects and when it delivers `done`. The server MUST " +
      "derive both from the same state, so a step present here is present " +
      "in the stream and vice versa - including the terminal step of a " +
      "`timed_out` run and the `skipped` steps of a `cancelled` one.",
    security: [{ cookieAuth: [] }],
    request: { params: RunIdParam },
    responses: {
      200: {
        description: "The run.",
        content: { "application/json": { schema: RunDetailSchema } },
      },
      404: {
        description: "Not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/runs/{id}/cancel",
    tags: ["runs"],
    summary: "Cancel a queued or running run",
    security: [{ cookieAuth: [] }],
    request: { params: RunIdParam },
    responses: {
      200: {
        description:
          "Cancellation accepted; remaining scenarios are marked skipped.",
        content: { "application/json": { schema: RunDetailSchema } },
      },
      409: {
        description: "Run already finished.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/runs/{id}/report",
    tags: ["runs"],
    summary: "The engine's generated HTML report for a finished run",
    description:
      "REQUIRED (B0.5 B9). **UNTRUSTED CONTENT.** The report is HTML produced " +
      "from a run against a site we do not control, and it quotes that site's " +
      "text. It MUST NOT be rendered inline in the app's DOM. The frontend " +
      "embeds it only in an `<iframe sandbox>` WITHOUT `allow-same-origin`, and " +
      "the server MUST make that the only safe way to consume it, not merely " +
      "the recommended one: respond with `Content-Security-Policy: sandbox` " +
      "(no `allow-same-origin`, no `allow-scripts`), `X-Content-Type-Options: " +
      "nosniff` and `Content-Disposition: inline`, so even a direct " +
      "navigation to this URL is sandboxed. Authorization class: " +
      "session-scoped (same cookie as the rest of the API; never a token in " +
      "the URL). 404 until the run has finished. There is deliberately no " +
      "public/proof-scoped variant: the shareable artefact is the Proof " +
      "snapshot, not this report.",
    security: [{ cookieAuth: [] }],
    request: { params: RunIdParam },
    responses: {
      200: {
        description: "The report, as `text/html`. Untrusted - sandbox only.",
        content: { "text/html": { schema: z.string() } },
      },
      404: {
        description: "Not found, or the run has not finished.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });
}
