import { http } from "msw";
import { OverviewSchema } from "@/lib/contract/overview";
import { checkSimulatedError, errorResponse, json } from "../respond";
import {
  computeOverview,
  dayFormatter,
  dayRange,
  RANGE_DAYS,
  type Range,
} from "../overview";

export const overviewHandlers = [
  http.get("*/overview", async ({ request }) => {
    const simulatedError = checkSimulatedError(request);
    if (simulatedError) return simulatedError;

    const url = new URL(request.url);
    const range = (url.searchParams.get("range") ?? "7d") as Range;
    if (!(range in RANGE_DAYS))
      return errorResponse(
        400,
        "invalid_range",
        "range must be 7d, 14d or 30d.",
      );
    const tz = url.searchParams.get("tz") ?? "UTC";
    try {
      dayFormatter(tz);
    } catch {
      return errorResponse(400, "invalid_tz", "tz must be an IANA time zone.");
    }
    const now = new Date();

    // Mock-only: a workspace with nothing in it yet, so the new-account
    // checklist can be seen and tested (the demo account has targets).
    if (url.searchParams.get("simulate") === "new_account") {
      const days = dayRange(now, RANGE_DAYS[range], tz);
      return json(OverviewSchema, {
        range: { from: days[0]!, to: days[days.length - 1]!, tz },
        generated_at: now.toISOString(),
        runs_by_day: days.map((date) => ({
          date,
          passed: 0,
          failed: 0,
          timed_out: 0,
          cancelled: 0,
          other: 0,
        })),
        latest_suite_run: null,
        targets: { total: 0, scanned: 0, needs_attention: 0 },
        proofs: { live: 0, revoked: 0 },
        attention: { total: 0, items: [] },
      });
    }

    return json(OverviewSchema, computeOverview(now, range, tz));
  }),
];
