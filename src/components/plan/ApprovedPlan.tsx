import { PlanStepRow } from "./PlanStepRow";
import { exclusionReason, type PlanStep } from "./reviewState";

/**
 * A plan that has been approved, read-only: what was proposed, what was
 * approved and in what order, and what did NOT run - split by WHO excluded
 * it. A step the person left out and a step the system could not approve
 * are different facts (the proof records them separately), so they are
 * separate groups here, each counted.
 *
 * The first line is the run's own denominator in words: approving 2 of 5
 * and both passing is "2 of 5 covered", never "2 of 2".
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
  const byUser = steps.filter(
    (s) => exclusionReason(s, approvedIds) === "removed_by_user",
  );
  const bySystem = steps.filter((s) => {
    const r = exclusionReason(s, approvedIds);
    return r === "ungrounded" || r === "blocked";
  });

  return (
    <div className="flex flex-col gap-4" data-testid="approved-plan">
      <p className="text-sm text-muted-foreground">
        Approved {new Date(approvedAt).toLocaleString()}. This approval is
        permanent; the plan can no longer be edited.
      </p>

      <p data-testid="plan-scope" className="text-sm font-medium">
        {approved.length} of {steps.length} proposed steps approved to run.
        {byUser.length + bySystem.length > 0 &&
          ` ${byUser.length + bySystem.length} did not run: ${byUser.length} left out by you, ${bySystem.length} the system could not approve.`}{" "}
        <span className="font-normal text-muted-foreground">
          Any result reports this scope - a pass rate is a pass rate of the{" "}
          {approved.length} that ran, alongside {approved.length} of{" "}
          {steps.length} covered.
        </span>
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

      {byUser.length > 0 && (
        <section className="flex flex-col gap-2" data-testid="excluded-by-user">
          <h2 className="font-heading text-lg font-light">
            Left out by you ({byUser.length})
          </h2>
          <ol className="flex flex-col gap-2">
            {byUser.map((step) => (
              <PlanStepRow
                key={step.id}
                step={step}
                position={{ kind: "left-out" }}
              />
            ))}
          </ol>
        </section>
      )}

      {bySystem.length > 0 && (
        <section
          className="flex flex-col gap-2"
          data-testid="excluded-by-system"
        >
          <h2 className="font-heading text-lg font-light">
            The system could not approve ({bySystem.length})
          </h2>
          <ol className="flex flex-col gap-2">
            {bySystem.map((step) => (
              <PlanStepRow
                key={step.id}
                step={step}
                position={{ kind: "not-approvable" }}
              />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
