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
 * B0.5 B7 - the compose-and-plan surface. All of it is REQUIRED.
 *
 * This is the product's differentiator: the gate where a person sees what
 * a machine PROPOSED before it executes. Two design rules, stated here
 * because they are what makes the audit claim true:
 *
 *   1. A plan is INSPECTABLE BEFORE execution. Nothing runs until a human
 *      approves it.
 *   2. A plan is IMMUTABLE AFTER generation. Its `steps` never change - not
 *      during review, not after approval. A person's edits (dropping steps,
 *      reordering) are made in the client and submitted ONCE, at approval,
 *      as the ordered list of step ids to run; the server records that
 *      list on the plan as `approval` and never rewrites it. So a Proof can
 *      always say exactly what was proposed, what was approved, and what
 *      was left out - a proof that can't say what was approved isn't a proof.
 *
 * Deliberately cheap for a backend: no PATCH, no per-edit round trips, no
 * revision counter, no merge logic. Generation is the expensive part and
 * it already exists in the engine; everything else here is a read, or one
 * write of one immutable record.
 */

export const PlanStatusSchema = extensibleEnum(
  ["generating", "proposed", "approved", "discarded", "failed"],
  "`generating`: the planner is still working (steps empty). `proposed`: " +
    "ready for review, executes nothing. `approved`: a human approved a " +
    "list of its steps; a run may now execute it. `discarded`: abandoned " +
    "unapproved. `failed`: the planner could not produce a plan.",
);

export const ActionClassSchema = extensibleEnum(
  ["read", "write"],
  "Whether a step only observes (`read`) or changes state in the target " +
    "application (`write`: submits a form, deletes, purchases). SAFETY: a " +
    "client MUST treat an unknown class as `write`.",
);

export const UngroundedReasonSchema = extensibleEnum(
  [
    "no_locator",
    "ambiguous_element",
    "not_in_inventory",
    "login_required",
    "credential_required",
    "unsupported_action",
  ],
  "Why the planner could not bind a step to a real element. " +
    "`credential_required`: the step would have typed a credential - the " +
    "engine refuses; sign-in goes through a login session, never a plan.",
);

export const BlockedReasonSchema = extensibleEnum(
  ["read_only_tier", "policy"],
  "Why an otherwise-groundable step may not run. `read_only_tier`: the " +
    "account's capabilities do not include write actions (GET /auth/me).",
);

export const PlanStepBindingSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("element"),
      element_id: IdSchema,
      label: z.string().openapi({
        description:
          "The element's label, frozen at generation. Untrusted text.",
      }),
      role: z.string().nullable(),
      page_url: z.url(),
      locator: z.string(),
      uniquely_locatable: z.literal(true).openapi({
        description:
          "Always true: a step is bound only to an element the engine can " +
          "target reliably. An element that is not uniquely locatable yields " +
          "an `ungrounded` binding, never a shaky `element` one.",
      }),
    }),
    z
      .object({
        type: z.literal("page"),
        page_url: z.url(),
      })
      .openapi({
        description:
          "For steps that act on a page rather than an element (`navigate`). " +
          "Found while building the reference mock: every plan starts with a " +
          "navigation, which is neither an element step nor ungrounded.",
      }),
    z.object({
      type: z.literal("ungrounded"),
      reason_code: UngroundedReasonSchema,
      reason: z.string().openapi({
        description:
          "Human-readable, safe to show as-is; may quote page text - untrusted.",
      }),
    }),
  ])
  .openapi({
    description:
      "What the step is bound to: a real inventory element, a page, or nothing " +
      "(ungrounded). UNGROUNDED STEPS ARE PART OF THE PLAN, not " +
      "omitted from it: the UI must show them, in place, with the reason " +
      "(Phase B section 1.3). An ungrounded step cannot be approved.",
  });

export const PlanStepSchema = z
  .object({
    id: IdSchema.openapi({
      description:
        "Stable, unique within the plan. Carried onto the executed run's " +
        "`Step.plan_step_id`.",
    }),
    index: z.number().int().min(0).openapi({ description: "Proposed order." }),
    description: z.string().openapi({
      description:
        'Plain-English statement of the step, e.g. "Click the Add to cart button".',
    }),
    action: z.string().openapi({
      description: "Engine action name, same open vocabulary as `Step.action`.",
    }),
    input: z
      .string()
      .nullable()
      .openapi({
        description:
          "Literal text a fill-style action would enter, or null. NEVER a " +
          "credential: a step that needs one is `ungrounded` with " +
          "`credential_required`.",
      }),
    action_class: ActionClassSchema,
    binding: PlanStepBindingSchema,
    blocked: z
      .object({ reason_code: BlockedReasonSchema, message: z.string() })
      .nullable()
      .openapi({
        description:
          "Non-null when the step may not run for this account (e.g. a write " +
          "step on a read-only tier). Set by the SERVER - the client does not " +
          "infer it. A blocked step is shown, in place, with the reason, and " +
          "cannot be approved.",
      }),
  })
  .openapi("PlanStep");

export const PlanApprovalSchema = z
  .object({
    approved_at: TimestampSchema,
    step_ids: z.array(IdSchema).openapi({
      description:
        "The ordered ids of the plan steps that were approved to run. Steps " +
        "of the plan absent from this list were left out (removed by the " +
        "person, or not approvable). Immutable once set.",
    }),
  })
  .openapi("PlanApproval");

export const PlanSchema = z
  .object({
    id: IdSchema,
    workspace_id: IdSchema,
    target_id: IdSchema,
    scan_id: IdSchema.openapi({
      description: "The scan whose inventory the plan was grounded against.",
    }),
    intent: z.string().openapi({
      description: "What the person asked for, verbatim.",
    }),
    status: PlanStatusSchema,
    steps: z.array(PlanStepSchema).openapi({
      description:
        "The proposed steps, in proposed order. Empty while `generating`. " +
        "IMMUTABLE once the plan leaves `generating`.",
    }),
    failure: z
      .object({ message: z.string() })
      .nullable()
      .openapi({ description: "Non-null exactly when `status` is `failed`." }),
    approval: PlanApprovalSchema.nullable().openapi({
      description: "Non-null exactly when `status` is `approved`. Immutable.",
    }),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
  })
  .openapi("Plan");

export const CreatePlanRequestSchema = z
  .object({
    workspace_id: IdSchema,
    target_id: IdSchema,
    scan_id: IdSchema,
    intent: z.string().min(1).max(2000),
  })
  .openapi("CreatePlanRequest");

export const ApprovePlanRequestSchema = z
  .object({
    step_ids: z
      .array(IdSchema)
      .min(1)
      .openapi({
        description:
          "The ordered ids to run: a non-empty subset of the plan's steps, in " +
          "the order the person chose. No duplicates, no unknown ids, and " +
          "nothing ungrounded or blocked - any of those is a 422 " +
          "`invalid_step_selection`. Steps cannot be added or edited: this " +
          "list is a selection and an ordering, nothing more.",
      }),
  })
  .openapi("ApprovePlanRequest");

const PlanIdParam = z.object({ id: IdSchema });

export function registerPlanPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "post",
    path: "/plans",
    tags: ["plans"],
    summary: "Ask for a proposed plan from a plain-English intent",
    description:
      "Always asynchronous, uniformly: returns 201 with `status: generating` " +
      "and empty steps; poll `GET /plans/{id}` until it leaves `generating`. " +
      "(One shape, not 'sometimes synchronous' - a client should not have to " +
      "handle both.) Executes NOTHING.",
    security: [{ cookieAuth: [] }],
    request: {
      body: {
        content: { "application/json": { schema: CreatePlanRequestSchema } },
      },
    },
    responses: {
      201: {
        description: "Plan created, generating.",
        content: { "application/json": { schema: PlanSchema } },
      },
      404: {
        description: "Target or scan not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/plans/{id}",
    tags: ["plans"],
    summary: "Get a plan (poll while generating)",
    security: [{ cookieAuth: [] }],
    request: { params: PlanIdParam },
    responses: {
      200: {
        description: "The plan.",
        content: { "application/json": { schema: PlanSchema } },
      },
      404: {
        description: "Not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/plans/{id}/approve",
    tags: ["plans"],
    summary: "Approve a proposed plan, with the person's edits",
    description:
      "The single write that turns a proposal into something a run may " +
      "execute. Records `approval` on the plan and moves it to `approved`; " +
      "after that the plan is permanently read-only.",
    security: [{ cookieAuth: [] }],
    request: {
      params: PlanIdParam,
      body: {
        content: { "application/json": { schema: ApprovePlanRequestSchema } },
      },
    },
    responses: {
      200: {
        description: "The approved plan.",
        content: { "application/json": { schema: PlanSchema } },
      },
      404: {
        description: "Not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      409: {
        description:
          "`plan_not_proposed`: still generating, or already approved / " +
          "discarded / failed. Approval is not repeatable.",
        content: { "application/json": { schema: ErrorSchema } },
      },
      422: {
        description: "`invalid_step_selection` - see the request schema.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/plans/{id}/discard",
    tags: ["plans"],
    summary: "Abandon a proposed plan",
    description:
      "Nice-to-have. The person cancelled review. Unapproved, undiscarded " +
      "proposals MAY be garbage-collected after at least 24 hours.",
    security: [{ cookieAuth: [] }],
    request: { params: PlanIdParam },
    responses: {
      200: {
        description: "The discarded plan.",
        content: { "application/json": { schema: PlanSchema } },
      },
      409: {
        description:
          "`plan_not_proposed` - an approved plan cannot be discarded.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });
}
