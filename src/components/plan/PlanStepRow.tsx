import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { StatusBadge } from "@/components/status/StatusBadge";
import { Button } from "@/components/ui/button";
import { isUnrecognised, truncateRaw } from "@/lib/api/tolerant";
import { approvability, humanise, isWrite, type PlanStep } from "./reviewState";

export type Position =
  | { kind: "will-run"; nth: number }
  | { kind: "left-out" }
  | { kind: "not-approvable" };

/**
 * One proposed step, exactly as the planner proposed it. Everything here
 * that a site or the planner wrote (descriptions, labels, locators, URLs,
 * reasons) is untrusted text: wrapped, never a link, never HTML.
 *
 * The three things Phase B 1.3 insists on are visible on the row itself:
 * which inventory element the step is bound to; that an UNGROUNDED step is
 * shown in place with its reason; and that a BLOCKED step is shown in place
 * with the server's reason. None of them is dropped or collapsed.
 */
export function PlanStepRow({
  step,
  position,
  controls,
}: {
  step: PlanStep;
  position: Position;
  /** Absent when the plan is read-only (approved / discarded). */
  controls?: {
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMove: (direction: -1 | 1) => void;
    onToggle: () => void;
  };
}) {
  const approvable = approvability(step);
  const write = isWrite(step);
  const leftOut = position.kind === "left-out";

  return (
    <li
      data-testid={`plan-step-${step.id}`}
      data-position={position.kind}
      className={`flex flex-col gap-2 border border-border p-3 text-sm ${
        approvable.ok ? "" : "bg-card"
      } ${leftOut ? "opacity-70" : ""}`}
    >
      <div className="flex flex-wrap items-start gap-2">
        <span className="min-w-6 font-mono text-xs text-muted-foreground">
          {position.kind === "will-run" ? `#${position.nth}` : "-"}
        </span>
        <p className="min-w-0 flex-1 break-words font-medium">
          {step.description}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {position.kind === "will-run" && (
            <span className="text-xs text-muted-foreground">Will run</span>
          )}
          {leftOut && <StatusBadge status="skipped" label="Left out" />}
          {!approvable.ok && approvable.why === "ungrounded" && (
            <StatusBadge status="warning" label="Not grounded" />
          )}
          {!approvable.ok && approvable.why === "blocked" && (
            <StatusBadge status="warning" label="Blocked" />
          )}
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Action</dt>
        <dd className="min-w-0 break-words font-mono">
          {step.action}
          {step.input !== null && (
            <>
              {" "}
              <span className="text-muted-foreground">with input</span>{" "}
              <span data-testid="step-input">&quot;{step.input}&quot;</span>
            </>
          )}
        </dd>

        <dt className="text-muted-foreground">Effect</dt>
        <dd data-testid="step-effect">
          {!write
            ? "Read-only - only observes"
            : "Changes state in your application"}
          {isUnrecognised(step.action_class) && (
            <span className="text-muted-foreground">
              {" "}
              (unrecognised class &quot;{truncateRaw(step.action_class.raw)}
              &quot; - treated as a write)
            </span>
          )}
        </dd>

        <dt className="text-muted-foreground">Bound to</dt>
        <dd className="min-w-0 break-words" data-testid="step-binding">
          <Binding step={step} />
        </dd>
      </dl>

      {!approvable.ok && approvable.why === "blocked" && step.blocked && (
        <p className="break-words border-l-2 border-border pl-3 text-xs">
          <span className="font-medium">
            Blocked ({humanise(step.blocked.reason_code)}):
          </span>{" "}
          {step.blocked.message}
        </p>
      )}

      {controls && (
        <div className="flex flex-wrap gap-2">
          {approvable.ok ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={controls.onToggle}
                aria-pressed={leftOut}
              >
                {leftOut ? "Put back" : "Leave out"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Move step ${step.index + 1} up`}
                disabled={!controls.canMoveUp}
                onClick={() => controls.onMove(-1)}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Move step ${step.index + 1} down`}
                disabled={!controls.canMoveDown}
                onClick={() => controls.onMove(1)}
              >
                <ArrowDownIcon />
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              This step can&apos;t be approved, so it can&apos;t run.
            </span>
          )}
        </div>
      )}
    </li>
  );
}

function Binding({ step }: { step: PlanStep }) {
  const b = step.binding;
  if (b.type === "element") {
    return (
      <span>
        inventory element{" "}
        <span className="font-medium">
          {b.label === "" ? "(no label)" : b.label}
        </span>{" "}
        <span className="text-muted-foreground">
          ({b.role ?? "no role"}) at{" "}
        </span>
        <span className="font-mono">{b.locator}</span>{" "}
        <span className="text-muted-foreground">on {b.page_url}</span>
      </span>
    );
  }
  if (b.type === "page") {
    return (
      <span>
        the page <span className="font-mono">{b.page_url}</span>
      </span>
    );
  }
  return (
    <span>
      <span className="font-medium">
        nothing - the planner could not ground this step
      </span>{" "}
      ({humanise(b.reason_code as string | { raw: string })}): {b.reason}
    </span>
  );
}
