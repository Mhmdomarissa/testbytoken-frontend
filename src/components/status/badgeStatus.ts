import { UnrecognisedValue } from "@/lib/api/tolerant";
import type { Status } from "./StatusBadge";

/**
 * Maps every status vocabulary the contract uses - step, run, scan/job -
 * onto the one chip vocabulary StatusBadge renders. A Map, not an object
 * literal: the keys are server-controlled strings, and `{}["constructor"]`
 * is a function, not `undefined`.
 *
 * Anything not in the map - including a value the contract knows but this
 * table forgot - becomes an UnrecognisedValue, never a default. Falling
 * back to "skipped" or "queued" would render an unfamiliar state as a
 * familiar, legitimate one, which is exactly the lie Phase B §1.1 forbids.
 */
const BADGE_STATUS = new Map<string, Status>([
  // step
  ["pass", "pass"],
  ["fail", "fail"],
  ["running", "running"],
  ["skipped", "skipped"],
  ["warning", "warning"],
  ["queued", "queued"],
  // run
  ["passed", "pass"],
  ["failed", "fail"],
  ["cancelled", "cancelled"],
  ["timed_out", "timed_out"],
  // scan / job
  ["crawling", "running"],
  ["parked", "warning"],
  ["completed", "pass"],
]);

export function toBadgeStatus(
  value: string | UnrecognisedValue,
): Status | UnrecognisedValue {
  if (value instanceof UnrecognisedValue) return value;
  return BADGE_STATUS.get(value) ?? new UnrecognisedValue(value);
}
