import { UnrecognisedValue } from "@/lib/api/tolerant";

const TERMINAL = new Set(["passed", "failed", "cancelled", "timed_out"]);

const LABELS = new Map<string, string>([
  ["queued", "Queued"],
  ["running", "Running"],
  ["passed", "Passed"],
  ["failed", "Failed"],
  ["cancelled", "Cancelled"],
  ["timed_out", "Timed out"],
]);

/** The server says this run is over. An unrecognised status is NOT over: we can't call it finished on a state we don't understand. */
export function isRunOver(
  status: string | UnrecognisedValue | null | undefined,
): boolean {
  return (
    status !== null &&
    status !== undefined &&
    !(status instanceof UnrecognisedValue) &&
    TERMINAL.has(status)
  );
}

/** Run-shaped wording for the chip (a run's "passed" is not a step's "Pass"). Undefined for a value we don't know, so the chip shows the raw value. */
export function runStatusLabel(
  status: string | UnrecognisedValue,
): string | undefined {
  return status instanceof UnrecognisedValue ? undefined : LABELS.get(status);
}
