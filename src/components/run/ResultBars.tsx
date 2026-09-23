/**
 * A finished run's two numbers, drawn: the pass rate and its coverage,
 * always together - the same pairing PassRateCoverage enforces, and never
 * one without the other. They show only what the server sent (pass_rate,
 * and generated of candidate), each as its own bar - never combined into
 * a figure the server didn't report. The bars grow to their value; no
 * digit counts. Decorative: PassRateCoverage beside them is what's read.
 */
export function ResultBars({
  passRate,
  coverage,
}: {
  passRate: number;
  coverage: { generated: number; candidate: number };
}) {
  const covered =
    coverage.candidate > 0 ? coverage.generated / coverage.candidate : 0;
  return (
    <div
      aria-hidden="true"
      className="grid w-full max-w-xs grid-cols-[4.5rem_1fr] items-center gap-x-3 gap-y-2 text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
    >
      <span>Pass</span>
      <Bar value={passRate} className="bg-(--status-pass-fg)" />
      <span>Covered</span>
      <Bar value={covered} className="bg-primary" />
    </div>
  );
}

function Bar({ value, className }: { value: number; className: string }) {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div className="h-1 bg-(--border-default)">
      <div
        className={`fill-in h-full ${className}`}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
