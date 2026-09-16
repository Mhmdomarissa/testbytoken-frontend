import "./zod-openapi-setup";
import { z } from "zod";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { TimestampSchema } from "./common";

export const UsageSchema = z
  .object({
    period_start: TimestampSchema,
    period_end: TimestampSchema,
    tokens_used: z.number().min(0),
    runs_count: z.number().int().min(0),
  })
  .openapi("Usage");

export const UsageBudgetSchema = z
  .object({
    monthly_limit_tokens: z.number().min(0),
    tokens_remaining: z.number().min(0),
    alert_threshold_percent: z.number().min(0).max(100),
  })
  .openapi("UsageBudget");

export function registerUsagePaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/usage",
    tags: ["usage"],
    summary: "Current billing period usage",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Usage for the current period.",
        content: { "application/json": { schema: UsageSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/usage/budget",
    tags: ["usage"],
    summary: "Token budget and remaining balance",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "Budget.",
        content: { "application/json": { schema: UsageBudgetSchema } },
      },
    },
  });
}
