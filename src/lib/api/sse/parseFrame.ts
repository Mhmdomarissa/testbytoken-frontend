import { JobEventSchema } from "@/lib/contract";
import { tolerant } from "../tolerant";
import type { JobEvent } from "./jobEventsReducer";

export type ParsedFrame =
  | { ok: true; event: JobEvent }
  | { ok: false; reason: "invalid_json" | "invalid_shape"; raw: string };

const tolerantJobEvent = tolerant(JobEventSchema);

/**
 * One SSE frame's `data:` payload -> a JobEvent, or a reason it can't be.
 *
 * The only frames refused are the structurally unusable ones: not JSON,
 * an unknown event `type`, a missing id. An unfamiliar status VALUE is
 * not one of them - it parses (as an UnrecognisedValue) and is applied
 * like any other event, because dropping it would make the step vanish
 * from the UI with no trace, which is worse than the bug this product
 * exists to fix (docs/PHASE_B0_5.md A1). Refusals are returned, not
 * swallowed: the caller counts them and shows that frames were dropped.
 */
export function parseJobEventFrame(data: string): ParsedFrame {
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return { ok: false, reason: "invalid_json", raw: data };
  }
  const parsed = tolerantJobEvent.safeParse(json);
  if (!parsed.success) {
    return { ok: false, reason: "invalid_shape", raw: data };
  }
  return { ok: true, event: parsed.data };
}
