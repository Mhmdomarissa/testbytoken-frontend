import { cn } from "@/lib/utils";
import { UnrecognisedValue, truncateRaw } from "@/lib/api/tolerant";

/**
 * Phase B, section 1.2: "A pass rate without a coverage figure is a
 * misleading number - it hides how many flows were never attempted."
 * Enforced structurally, not by discipline: both props are required, there
 * is no pass-rate-only variant to reach for instead, and `coverage` is a
 * full object (not a pre-computed percentage) so the generated/candidate
 * split is always visible, not collapsed into one derived number that
 * could itself hide the gap it exists to reveal.
 *
 * The same rule now covers WHAT is counted: `coverage.basis` is required,
 * and the figure is always printed with its unit. "21 of 24 elements" (a
 * suite run: found / uniquely locatable) and "2 of 5 plan steps" (a plan
 * run: proposed / approved) are different denominators and can't be
 * compared, and a viewer of a public proof can't be expected to guess which
 * applies. An unrecognised basis is shown as unrecognised, not defaulted.
 *
 * Every place a run's pass rate appears - tables, cards, the run header,
 * the proof page, tooltips, an OG image - renders through this, not a
 * bare percentage.
 */
const BASIS = new Map<string, { unit: string; explanation: string }>([
  [
    "inventory",
    {
      unit: "elements",
      explanation:
        "Of the elements the engine found, how many it could uniquely locate and so generate a scenario for.",
    },
  ],
  [
    "plan",
    {
      unit: "plan steps",
      explanation:
        "Of the steps the plan proposed, how many were approved to run. This does not say how much of the application was tested.",
    },
  ],
]);

export function PassRateCoverage({
  passRate,
  coverage,
  className,
}: {
  /** Fraction 0-1, matching RunSummary/RunDetail.pass_rate. */
  passRate: number;
  coverage: {
    basis: string | UnrecognisedValue;
    generated: number;
    candidate: number;
  };
  className?: string;
}) {
  const percent = Math.round(passRate * 100);
  const known =
    coverage.basis instanceof UnrecognisedValue
      ? undefined
      : BASIS.get(coverage.basis);
  const basisLabel =
    coverage.basis instanceof UnrecognisedValue
      ? coverage.basis.raw
      : coverage.basis;
  return (
    <span
      data-testid="pass-rate-coverage"
      data-basis={basisLabel}
      title={known?.explanation}
      className={cn(
        "inline-flex items-baseline gap-1.5 tabular-nums",
        className,
      )}
    >
      <span className="font-medium">{percent}% pass</span>
      <span className="text-muted-foreground text-xs">
        &middot; {coverage.generated} of {coverage.candidate}{" "}
        {known ? known.unit : "covered"}
        {known
          ? " covered"
          : ` (unrecognised basis: ${truncateRaw(basisLabel)})`}
      </span>
    </span>
  );
}
