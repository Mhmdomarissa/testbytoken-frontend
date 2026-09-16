import { http } from "msw";
import { UsageSchema, UsageBudgetSchema } from "@/lib/contract";
import { json } from "../respond";
import { runs } from "../data";

export const usageHandlers = [
  http.get("*/usage", async () => {
    const tokens_used = runs.reduce((sum, r) => sum + r.token_cost, 0);
    return json(UsageSchema, {
      period_start: "2026-09-01T00:00:00Z",
      period_end: "2026-09-30T23:59:59Z",
      tokens_used,
      runs_count: runs.length,
    });
  }),

  http.get("*/usage/budget", async () => {
    return json(UsageBudgetSchema, {
      monthly_limit_tokens: 500,
      tokens_remaining: 479.2,
      alert_threshold_percent: 80,
    });
  }),
];
