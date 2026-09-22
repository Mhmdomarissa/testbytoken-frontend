import type { z } from "zod";
import type { ProofSnapshotSchema } from "@/lib/contract";
import { UnrecognisedValue, truncateRaw } from "@/lib/api/tolerant";
import type { Tolerated } from "@/lib/api/tolerant";

type Plan = NonNullable<Tolerated<z.infer<typeof ProofSnapshotSchema>>["plan"]>;

function humanise(code: string): string {
  return code.replace(/_/g, " ");
}

/**
 * "What was PROPOSED and what was APPROVED, frozen from the plan"
 * (docs/API_CONTRACT.md) - for a plan-originated run only; `null` for a
 * suite run, which ProofView doesn't render this section for at all.
 * Exclusions keep WHO excluded them (the person vs. the system) rather
 * than one flattened "not run" bucket, matching the same distinction the
 * authenticated plan record makes (src/components/plan/ApprovedPlan.tsx) -
 * this is a smaller, public-safe reduction of that same data (no
 * bindings, no locators, just description + why), not the same component.
 */
export function PlanSummary({ plan }: { plan: Plan }) {
  const byUser = plan.excluded_steps.filter(
    (s) =>
      !(s.reason instanceof UnrecognisedValue) &&
      s.reason === "removed_by_user",
  );
  const bySystem = plan.excluded_steps.filter(
    (s) =>
      s.reason instanceof UnrecognisedValue ||
      s.reason !== ("removed_by_user" as string),
  );

  return (
    <section
      className="flex flex-col gap-2 border border-border p-3 text-sm"
      aria-label="What was asked for"
      data-testid="plan-summary"
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        From a plan
      </p>
      <p className="break-words">&ldquo;{plan.intent}&rdquo;</p>
      <p className="text-muted-foreground">
        {plan.approved_steps.length} of{" "}
        {plan.approved_steps.length + plan.excluded_steps.length} proposed steps
        approved to run.
        {plan.excluded_steps.length > 0 &&
          ` ${byUser.length} left out by the person who approved it, ${bySystem.length} the system could not approve.`}
      </p>
      {plan.excluded_steps.length > 0 && (
        <ul className="flex flex-col gap-1">
          {plan.excluded_steps.map((step) => (
            <li key={step.id} className="text-muted-foreground">
              <span className="text-foreground">{step.description}</span>{" "}
              &mdash;{" "}
              {step.reason instanceof UnrecognisedValue
                ? `unrecognised: ${truncateRaw(step.reason.raw)}`
                : humanise(step.reason)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
