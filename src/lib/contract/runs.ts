import "./zod-openapi-setup";
import { z } from "zod";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  ErrorSchema,
  IdSchema,
  PaginationQuerySchema,
  TimestampSchema,
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
 */

export const RunStatusSchema = z
  .enum(["queued", "running", "passed", "failed", "cancelled"])
  .openapi({ description: "Overall run status." });

// Same six values as the app's design-token status scale
// (styles/tokens.css --status-*) - one vocabulary for step status end to
// end, engine to pixel.
export const StepStatusSchema = z
  .enum(["pass", "fail", "running", "skipped", "warning", "queued"])
  .openapi({
    description:
      "Per-step status. Matches the design system's status token names 1:1.",
  });

export const StepSchema = z
  .object({
    index: z.number().int().min(0),
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
          "Resolved, ready-to-fetch URL. Whether it's a signed expiring URL or a " +
          "session-authenticated route is a backend decision, not fixed by this " +
          "contract - see the open decision in docs/API_CONTRACT.md.",
      }),
  })
  .openapi("Step");

export const CoverageSchema = z
  .object({
    generated: z.number().int().min(0).openapi({
      description:
        "Scenarios actually generated - i.e. elements that were uniquely locatable.",
    }),
    candidate: z.number().int().min(0).openapi({
      description:
        "Total candidate elements the engine attempted to generate scenarios for.",
    }),
  })
  .openapi("Coverage");

const RunSharedFields = {
  id: IdSchema,
  workspace_id: IdSchema,
  target_id: IdSchema,
  suite_id: IdSchema,
  status: RunStatusSchema,
  pass_rate: z.number().min(0).max(1).openapi({
    description:
      "Fraction of generated scenarios that passed. Always present alongside coverage.",
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
  .object({ ...RunSharedFields, steps: z.array(StepSchema) })
  .openapi("RunDetail");

export const CreateRunRequestSchema = z
  .object({
    workspace_id: IdSchema,
    suite_id: IdSchema,
    target_id: IdSchema,
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
}
