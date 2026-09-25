/**
 * The shape of a plan before the planner has returned one: rows the size
 * and structure of PlanStepRow, so the real steps arrive into the space
 * that was waiting for them. Purely decorative - the words beside it say
 * what's happening - so it's hidden from assistive tech, and it shows no
 * count, status or text: nothing here is a claim about the plan.
 */
export function PlanSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="relative flex flex-col gap-3 border border-border py-4 pr-4 pl-6"
        >
          <span className="absolute inset-y-0 left-0 w-0.75 bg-(--line-input)" />
          <div className="flex items-center gap-3">
            <div className="sheen h-4 w-6 bg-(--line)" />
            <div
              className="sheen h-4 bg-(--line)"
              style={{ width: `${48 - i * 9}%` }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="sheen h-2.5 w-2/5 bg-(--line)" />
            <div className="sheen h-2.5 w-3/5 bg-(--line)" />
          </div>
        </div>
      ))}
    </div>
  );
}
