import type { UnrecognisedValue } from "@/lib/api/tolerant";
import { isRunOver } from "@/components/run/runStatus";
import { ResultBars } from "@/components/run/ResultBars";
import { PassRateCoverage } from "./PassRateCoverage";

type Coverage = Parameters<typeof PassRateCoverage>[0]["coverage"];

/**
 * The one way a RUN's pass rate reaches the screen. A run that is queued,
 * running, or in a state this client doesn't recognise as finished has no
 * pass rate: a rate over the steps so far is a number about a run that
 * hasn't ended ("100% pass" on a run that ends at 50%). So it renders only
 * when BOTH the status is terminal AND the server sent a value - the
 * contract says pass_rate is null until then (docs/API_CONTRACT.md), and
 * the status check holds even if a server gets that wrong. Otherwise it
 * says why there's no number, rather than leaving a blank.
 *
 * Every run surface uses this, not PassRateCoverage directly
 * (src/components/status/pass-rate-gate.test.ts keeps it that way). A
 * proof's pass rate is exempt: a proof exists only for a finished run.
 */
export function RunPassRate({
  status,
  passRate,
  coverage,
  pendingText = "Reported when the run finishes.",
  bars = false,
  className,
}: {
  status: string | UnrecognisedValue | null | undefined;
  passRate: number | null;
  coverage: Coverage;
  /** What to say while the run hasn't finished. */
  pendingText?: string;
  /** Also draw the pass and coverage bars (run detail). */
  bars?: boolean;
  className?: string;
}) {
  if (!isRunOver(status)) {
    return (
      <span
        className="text-sm text-muted-foreground"
        data-testid="no-result-yet"
      >
        {pendingText}
      </span>
    );
  }
  if (passRate === null) {
    return (
      <span
        className="text-sm text-muted-foreground"
        data-testid="no-pass-rate"
      >
        The run finished, but no pass rate was reported.
      </span>
    );
  }
  if (!bars) {
    return (
      <PassRateCoverage
        passRate={passRate}
        coverage={coverage}
        className={className}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <PassRateCoverage
        passRate={passRate}
        coverage={coverage}
        className={className}
      />
      <ResultBars passRate={passRate} coverage={coverage} />
    </div>
  );
}
