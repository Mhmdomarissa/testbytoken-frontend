"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlanStepRow } from "./PlanStepRow";
import {
  approvability,
  initialReview,
  move,
  reviewSummary,
  selectedStepIds,
  toggleLeftOut,
  type PlanStep,
} from "./reviewState";

/**
 * The gate. A person sees what a machine PROPOSED, edits it (leave steps
 * out, reorder), and only then says run. The plan itself is never touched:
 * the edits live here until the one approval write, and that write can only
 * ever contain approvable step ids.
 *
 * Every exclusion is stated on screen (Phase B 1.3): steps left out by the
 * person, and steps that can't be approved (ungrounded, blocked) - each
 * still listed in its place.
 */
export function PlanReview({
  intent,
  steps,
  busy,
  error,
  onApprove,
  onDiscard,
}: {
  intent: string;
  steps: PlanStep[];
  busy: boolean;
  error: string | null;
  onApprove: (stepIds: string[]) => void;
  onDiscard: () => void;
}) {
  const [review, setReview] = useState(() => initialReview(steps));
  const byId = new Map(steps.map((s) => [s.id, s]));
  const summary = reviewSummary(review, steps);
  const selected = selectedStepIds(review, steps);
  const canApprove = selected.length > 0 && !busy;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Proposed - nothing has run
        </p>
        <p
          data-testid="plan-intent"
          className="break-words font-heading text-xl font-light"
        >
          {intent}
        </p>
      </div>

      <ol className="flex flex-col gap-2" aria-label="Proposed steps">
        {review.order.map((id, i) => {
          const step = byId.get(id)!;
          const ok = approvability(step).ok;
          const isLeftOut = review.leftOut.has(id);
          const nth = selected.indexOf(id) + 1;
          return (
            <PlanStepRow
              key={id}
              step={step}
              position={
                !ok
                  ? { kind: "not-approvable" }
                  : isLeftOut
                    ? { kind: "left-out" }
                    : { kind: "will-run", nth }
              }
              controls={{
                canMoveUp: i > 0,
                canMoveDown: i < review.order.length - 1,
                onMove: (d) => setReview((r) => move(r, id, d)),
                onToggle: () => setReview((r) => toggleLeftOut(r, step)),
              }}
            />
          );
        })}
      </ol>

      <div
        data-testid="approval-summary"
        className="flex flex-col gap-1 border border-border bg-card p-3 text-sm"
      >
        <p className="font-medium">
          {summary.selected === 0
            ? "No steps selected - there is nothing to run."
            : `This will run ${summary.selected} of ${summary.total} proposed steps, in the order shown.`}
        </p>
        {summary.leftOutByYou > 0 && (
          <p className="text-muted-foreground">
            {summary.leftOutByYou} left out by you.
          </p>
        )}
        {summary.notApprovable > 0 && (
          <p className="text-muted-foreground">
            {summary.notApprovable} can&apos;t be approved (not grounded, or
            blocked for this account) - they are listed above and will not run.
          </p>
        )}
        {summary.writes > 0 && (
          <p>
            {summary.writes} of the steps that will run change state in your
            application.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button disabled={!canApprove} onClick={() => onApprove(selected)}>
          {busy
            ? "Working…"
            : selected.length === 0
              ? "Approve and run"
              : `Approve and run ${selected.length} ${selected.length === 1 ? "step" : "steps"}`}
        </Button>
        <Button variant="outline" disabled={busy} onClick={onDiscard}>
          Discard this plan
        </Button>
      </div>
    </div>
  );
}
