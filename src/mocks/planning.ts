import type { z } from "zod";
import type { PlanSchema, PlanStepSchema } from "@/lib/contract";
import { elementsForModule, modCheckout } from "./data";
import { mockAccount, planStore } from "./store";

type Plan = z.infer<typeof PlanSchema>;
type PlanStep = z.infer<typeof PlanStepSchema>;

/**
 * B0.5 B7's reference planner: deterministic, not a model. What matters for
 * a screen is the SHAPE of what comes back - a mix of grounded, ungrounded
 * and blocked steps - not the quality of the plan. Documented behaviours:
 *
 *   - Takes PLAN_GENERATION_MS to leave `generating` (a real loading state).
 *   - An intent starting with "fail:" makes generation FAIL (`status:
 *     failed` with a message) - the planner-error state.
 *   - Always proposes the same five steps: a navigation, a write click on a
 *     grounded element, a read click on a grounded element, a step on an
 *     AMBIGUOUS element (ungrounded), and a step that would type a password
 *     (ungrounded, `credential_required` - the engine refuses; no plan ever
 *     types a credential).
 *   - Write steps are `blocked` for a read-only account (mockAccount) - the
 *     default here. An intent starting with "writes:" is planned as if for
 *     an account that CAN run write steps, so the unblocked-write path is
 *     reachable in a browser without a second account.
 */
export const PLAN_GENERATION_MS = 1_500;

function proposedSteps(intent: string): PlanStep[] {
  const elements = elementsForModule(modCheckout.id) ?? [];
  const byId = (id: string) => {
    const el = elements.find((e) => e.id === id);
    if (!el) throw new Error(`mock planner: fixture element ${id} missing`);
    return el;
  };
  const submit = byId("el_submit");
  const unicode = byId("el_unicode");
  const duplicate = byId("el_duplicate");
  const writeBlocked =
    mockAccount.writeActions || intent.startsWith("writes:")
      ? null
      : {
          reason_code: "read_only_tier" as const,
          message:
            "This account is on the read-only tier, which can't run steps that change state in your application.",
        };

  return [
    {
      id: "pstp_1",
      index: 0,
      description: "Open the checkout page",
      action: "navigate",
      input: null,
      action_class: "read",
      binding: { type: "page", page_url: submit.page_url },
      blocked: null,
    },
    {
      id: "pstp_2",
      index: 1,
      description: `Click "${submit.label}"`,
      action: "click",
      input: null,
      action_class: "write",
      binding: {
        type: "element",
        element_id: submit.id,
        label: submit.label,
        role: submit.role,
        page_url: submit.page_url,
        locator: submit.locator,
        uniquely_locatable: true,
      },
      blocked: writeBlocked,
    },
    {
      id: "pstp_3",
      index: 2,
      description: "Open the payment link",
      action: "click",
      input: null,
      action_class: "read",
      binding: {
        type: "element",
        element_id: unicode.id,
        label: unicode.label,
        role: unicode.role,
        page_url: unicode.page_url,
        locator: unicode.locator,
        uniquely_locatable: true,
      },
      blocked: null,
    },
    {
      id: "pstp_4",
      index: 3,
      description: `Click "${duplicate.label}" on the second line item`,
      action: "click",
      input: null,
      action_class: "write",
      binding: {
        type: "ungrounded",
        reason_code: "ambiguous_element",
        reason: `More than one element matched "${duplicate.locator}", so the engine can't reliably target this one.`,
      },
      blocked: null,
    },
    {
      id: "pstp_5",
      index: 4,
      description: "Sign in with the account password",
      action: "fill",
      input: null,
      action_class: "write",
      binding: {
        type: "ungrounded",
        reason_code: "credential_required",
        reason:
          "This step would type a credential. The engine never does - sign in through a login session instead.",
      },
      blocked: null,
    },
  ];
}

export function createPlan(input: {
  workspaceId: string;
  targetId: string;
  scanId: string;
  intent: string;
}): Plan {
  const now = new Date().toISOString();
  const plan: Plan = {
    id: `plan_${Math.random().toString(36).slice(2, 10)}`,
    workspace_id: input.workspaceId,
    target_id: input.targetId,
    scan_id: input.scanId,
    intent: input.intent,
    status: "generating",
    steps: [],
    failure: null,
    approval: null,
    created_at: now,
    updated_at: now,
  };
  planStore.set(plan.id, { plan, createdAtMs: Date.now() });
  return plan;
}

/**
 * The plan as of NOW. `generating` -> `proposed`/`failed` is computed from
 * elapsed time, and the steps are frozen into the stored plan the first
 * time it settles - after that they never change (the contract's
 * immutability rule, enforced here rather than merely hoped for).
 */
export function resolvePlan(id: string): Plan | undefined {
  const entry = planStore.get(id);
  if (!entry) return undefined;
  const { plan, createdAtMs } = entry;

  if (
    plan.status === "generating" &&
    Date.now() - createdAtMs >= PLAN_GENERATION_MS
  ) {
    const settled: Plan = plan.intent.startsWith("fail:")
      ? {
          ...plan,
          status: "failed",
          failure: {
            message:
              "The planner couldn't turn that request into steps for this application. Try describing one specific thing to check.",
          },
          updated_at: new Date().toISOString(),
        }
      : {
          ...plan,
          status: "proposed",
          steps: proposedSteps(plan.intent),
          updated_at: new Date().toISOString(),
        };
    planStore.set(id, { plan: settled, createdAtMs });
    return settled;
  }
  return plan;
}

export type ApproveResult =
  | { ok: true; plan: Plan }
  | { ok: false; status: 404 | 409 | 422; code: string; message: string };

export function approvePlan(id: string, stepIds: string[]): ApproveResult {
  const plan = resolvePlan(id);
  if (!plan)
    return {
      ok: false,
      status: 404,
      code: "not_found",
      message: "Plan not found.",
    };
  if (plan.status !== "proposed") {
    return {
      ok: false,
      status: 409,
      code: "plan_not_proposed",
      message: `This plan is ${plan.status}, so it can't be approved.`,
    };
  }
  if (stepIds.length === 0 || new Set(stepIds).size !== stepIds.length) {
    return {
      ok: false,
      status: 422,
      code: "invalid_step_selection",
      message: "Select at least one step, each at most once.",
    };
  }
  for (const stepId of stepIds) {
    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) {
      return {
        ok: false,
        status: 422,
        code: "invalid_step_selection",
        message: `Unknown step "${stepId}".`,
      };
    }
    if (step.binding.type === "ungrounded") {
      return {
        ok: false,
        status: 422,
        code: "invalid_step_selection",
        message: `"${step.description}" couldn't be grounded, so it can't be approved.`,
      };
    }
    if (step.blocked) {
      return {
        ok: false,
        status: 422,
        code: "invalid_step_selection",
        message: `"${step.description}" is blocked for this account, so it can't be approved.`,
      };
    }
  }
  const approved: Plan = {
    ...plan,
    status: "approved",
    approval: { approved_at: new Date().toISOString(), step_ids: stepIds },
    updated_at: new Date().toISOString(),
  };
  const entry = planStore.get(id)!;
  planStore.set(id, { ...entry, plan: approved });
  return { ok: true, plan: approved };
}

export function discardPlan(id: string): ApproveResult {
  const plan = resolvePlan(id);
  if (!plan)
    return {
      ok: false,
      status: 404,
      code: "not_found",
      message: "Plan not found.",
    };
  if (plan.status === "approved") {
    return {
      ok: false,
      status: 409,
      code: "plan_not_proposed",
      message: "An approved plan can't be discarded.",
    };
  }
  const discarded: Plan = {
    ...plan,
    status: "discarded",
    updated_at: new Date().toISOString(),
  };
  planStore.set(id, { ...planStore.get(id)!, plan: discarded });
  return { ok: true, plan: discarded };
}
