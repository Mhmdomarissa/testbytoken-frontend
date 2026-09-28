import { http } from "msw";
import { UsageSchema, UsageBudgetSchema } from "@/lib/contract";
import { json } from "../respond";
import { runs } from "../data";

export const usageHandlers = [
  http.get("*/usage", async () => {
    const tokens_used = runs.reduce((sum, r) => sum + r.token_cost, 0);
    // The current calendar month (UTC), so the demo's period never ages.
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth();
    return json(UsageSchema, {
      period_start: new Date(Date.UTC(y, m, 1)).toISOString(),
      period_end: new Date(Date.UTC(y, m + 1, 1) - 1000).toISOString(),
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
