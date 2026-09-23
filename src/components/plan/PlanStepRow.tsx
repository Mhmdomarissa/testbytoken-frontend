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

  // The group role sits on an inner element, not the <li>: an <li> given
  // another role stops being a list item, and its <ol> fails WCAG 1.3.1
  // (axe's `list` rule - found once axe first saw an approved plan).
  return (
    <li>
      <div
        data-testid={`plan-step-${step.id}`}
        data-position={position.kind}
        role="group"
        aria-labelledby={`${step.id}-title`}
        aria-describedby={`${step.id}-state`}
        // A step that can't be approved has NO controls, so without this it has
        // no keyboard stop at all and a keyboard or switch user would tab
        // straight past the very steps this screen exists to surface. Steps with
        // controls are already reached through them (and announced as part of
        // this group).
        tabIndex={approvable.ok ? undefined : 0}
        className={`glow-focus relative flex flex-col gap-3 border py-4 pr-4 pl-6 text-sm ${
          controls && approvable.ok ? "glow-hover" : ""
        } ${approvable.ok ? "bg-background" : "bg-card"} ${
          leftOut ? "border-dashed border-(--border-strong)" : "border-border"
        }`}
      >
        {/* The row's state as an edge of light: gold will run, the
            warning edge can't, a quiet edge left out. Crossfades when
            the person toggles - both ends are real states. */}
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-0.75 transition-colors duration-(--duration-base) ease-(--ease-in-out) ${
            position.kind === "will-run"
              ? "bg-primary"
              : leftOut
                ? "bg-(--border-strong)"
                : "bg-(--status-warning-border)"
          }`}
        />
        <span id={`${step.id}-state`} className="sr-only">
          {stateText(step, position)}
        </span>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <span
            aria-hidden="true"
            className={`min-w-8 text-lg leading-none font-light tabular-nums transition-colors duration-(--duration-base) ${
              position.kind === "will-run"
                ? "text-primary"
                : "text-(--text-tertiary)"
            }`}
          >
            {position.kind === "will-run" ? `#${position.nth}` : "-"}
          </span>
          <p
            id={`${step.id}-title`}
            className="min-w-0 flex-1 text-[0.9375rem] font-medium break-words"
          >
            {step.description}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {position.kind === "will-run" && (
              <span className="text-[0.6875rem] font-semibold tracking-[0.14em] text-primary uppercase">
                Will run
              </span>
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

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs [&>dt]:text-[0.625rem] [&>dt]:font-semibold [&>dt]:tracking-[0.14em] [&>dt]:uppercase [&>dt]:leading-[1.6]">
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
          <p className="border-l-2 border-(--status-warning-border) pl-3 text-xs leading-relaxed break-words">
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
                  aria-label={`${leftOut ? "Put back" : "Leave out"}: ${step.description}`}
                >
                  {leftOut ? "Put back" : "Leave out"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Move up: ${step.description}`}
                  disabled={!controls.canMoveUp}
                  onClick={() => controls.onMove(-1)}
                >
                  <ArrowUpIcon />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Move down: ${step.description}`}
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
      </div>
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

/**
 * What a screen reader hears when it lands on the step: the state first
 * (whether it will run, and if not, why), because that is the fact the
 * person is here to learn. Plain text; the visible chips say the same.
 */
export function stateText(step: PlanStep, position: Position): string {
  const approvable = approvability(step);
  if (!approvable.ok && approvable.why === "blocked" && step.blocked) {
    return `Blocked, cannot be approved: ${step.blocked.message}`;
  }
  if (!approvable.ok) {
    const b = step.binding;
    return b.type === "ungrounded"
      ? `Not grounded, cannot be approved: ${humanise(b.reason_code as string | { raw: string })}. ${b.reason}`
      : "Cannot be approved";
  }
  if (position.kind === "left-out") return "Left out by you, will not run";
  if (position.kind === "will-run") return `Will run, number ${position.nth}`;
  return "";
}
