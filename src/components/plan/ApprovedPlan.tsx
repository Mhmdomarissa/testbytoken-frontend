import { PlanStepRow } from "./PlanStepRow";
import { approvability, type PlanStep } from "./reviewState";

/**
 * A plan that has been approved, read-only: what was proposed, what was
 * approved and in what order, and what was left out. The record the proof
 * later has to be able to state - so the exclusions are as visible as the
 * approved steps, not hidden behind them.
 */
export function ApprovedPlan({
  steps,
  approvedIds,
  approvedAt,
}: {
  steps: PlanStep[];
  approvedIds: string[];
  approvedAt: string;
}) {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const approved = approvedIds.flatMap((id) => {
    const s = byId.get(id);
    return s ? [s] : [];
  });
  const excluded = steps.filter((s) => !approvedIds.includes(s.id));

  return (
    <div className="flex flex-col gap-4" data-testid="approved-plan">
      <p className="text-sm text-muted-foreground">
        Approved {new Date(approvedAt).toLocaleString()}. This approval is
        permanent; the plan can no longer be edited.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-light">
          Approved to run ({approved.length})
        </h2>
        <ol className="flex flex-col gap-2">
          {approved.map((step, i) => (
            <PlanStepRow
              key={step.id}
              step={step}
              position={{ kind: "will-run", nth: i + 1 }}
            />
          ))}
        </ol>
      </section>

      {excluded.length > 0 && (
        <section className="flex flex-col gap-2" data-testid="excluded-steps">
          <h2 className="font-heading text-lg font-light">
            Not run ({excluded.length})
          </h2>
          <ol className="flex flex-col gap-2">
            {excluded.map((step) => (
              <PlanStepRow
                key={step.id}
                step={step}
                position={
                  approvability(step).ok
                    ? { kind: "left-out" }
                    : { kind: "not-approvable" }
                }
              />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
