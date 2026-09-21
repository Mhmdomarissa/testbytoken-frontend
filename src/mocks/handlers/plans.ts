import { http } from "msw";
import {
  ApprovePlanRequestSchema,
  CreatePlanRequestSchema,
  PlanSchema,
} from "@/lib/contract";
import { json, errorResponse } from "../respond";
import { scanStore, targetStore } from "../store";
import { approvePlan, createPlan, discardPlan, resolvePlan } from "../planning";

export const planHandlers = [
  http.post("*/plans", async ({ request }) => {
    const parsed = CreatePlanRequestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return errorResponse(
        422,
        "invalid_request",
        "Give a target, a scan and an intent (1-2000 characters).",
      );
    }
    const { workspace_id, target_id, scan_id, intent } = parsed.data;
    if (!targetStore.has(target_id) || !scanStore.has(scan_id)) {
      return errorResponse(404, "not_found", "Target or scan not found.");
    }
    return json(
      PlanSchema,
      createPlan({
        workspaceId: workspace_id,
        targetId: target_id,
        scanId: scan_id,
        intent,
      }),
      { status: 201 },
    );
  }),

  http.get("*/plans/:id", async ({ params }) => {
    const plan = resolvePlan(params.id as string);
    if (!plan) return errorResponse(404, "not_found", "Plan not found.");
    return json(PlanSchema, plan);
  }),

  http.post("*/plans/:id/approve", async ({ params, request }) => {
    const parsed = ApprovePlanRequestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return errorResponse(
        422,
        "invalid_step_selection",
        "Select at least one step.",
      );
    }
    const result = approvePlan(params.id as string, parsed.data.step_ids);
    if (!result.ok)
      return errorResponse(result.status, result.code, result.message);
    return json(PlanSchema, result.plan);
  }),

  http.post("*/plans/:id/discard", async ({ params }) => {
    const result = discardPlan(params.id as string);
    if (!result.ok)
      return errorResponse(result.status, result.code, result.message);
    return json(PlanSchema, result.plan);
  }),
];
