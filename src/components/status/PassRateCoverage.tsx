import { cn } from "@/lib/utils";

/**
 * Phase B, §1.2: "A pass rate without a coverage figure is a misleading
 * number - it hides how many flows were never attempted." Enforced
 * structurally, not by discipline: both props are required, there is no
 * pass-rate-only variant to reach for instead, and `coverage` is a full
 * object (not a pre-computed percentage) so the generated/candidate split
 * is always visible, not collapsed into one derived number that could
 * itself hide the gap it exists to reveal.
 *
 * Every place a run's pass rate appears - tables, cards, the run header,
 * the proof page, tooltips, an OG image - renders through this, not a
 * bare percentage.
 */
export function PassRateCoverage({
  passRate,
  coverage,
  className,
}: {
  /** Fraction 0-1, matching RunSummary/RunDetail.pass_rate. */
  passRate: number;
  coverage: { generated: number; candidate: number };
  className?: string;
}) {
  const percent = Math.round(passRate * 100);
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 tabular-nums",
        className,
      )}
    >
      <span className="font-medium">{percent}% pass</span>
      <span className="text-muted-foreground text-xs">
        · {coverage.generated}/{coverage.candidate} covered
      </span>
    </span>
  );
}
