import { StatusBadge } from "@/components/status/StatusBadge";
import { toBadgeStatus } from "@/components/status/badgeStatus";
import { UnrecognisedValue } from "@/lib/api/tolerant";
import { Screenshot } from "./Screenshot";
import type { Step } from "./reconcile";

export const ROW_HEIGHT = 84;

const isRunning = (s: Step) =>
  !(s.status instanceof UnrecognisedValue) && s.status === "running";

/**
 * One step exactly as the server reported it. Everything a tested site
 * wrote (target, message, assertion) is inert text. The CURRENT step is the
 * one the server reports as `running` - never one inferred from position or
 * from "the last one that arrived" - and is marked with an inset bar, the
 * chip, and `aria-current` (words and shape, not colour alone).
 *
 * `compact` is for long runs: a fixed height so the list can be windowed,
 * with the text clamped and the full value in `title`. Failures are also
 * listed in full outside the window (StepList), so nothing important is
 * only readable by hovering.
 */
export function StepRow({
  step,
  position,
  total,
  compact,
  style,
}: {
  step: Step;
  /** 1-based position in the whole list. */
  position: number;
  total: number;
  compact: boolean;
  /** Windowing positions the row absolutely; the row itself stays the list item. */
  style?: React.CSSProperties;
}) {
  const running = isRunning(step);
  return (
    <li
      data-testid={`step-${step.id}`}
      data-status={
        step.status instanceof UnrecognisedValue ? "unrecognised" : step.status
      }
      data-current={running ? "true" : undefined}
      aria-current={running ? "step" : undefined}
      aria-posinset={position}
      aria-setsize={total}
      style={compact ? { height: ROW_HEIGHT, ...style } : style}
      // Motion here follows the row's own server-reported status: it
      // arrives when its first event does (full rows only - a windowed
      // row is recycled on scroll), breathes while `running`, and its
      // mark draws when it becomes pass or fail. See globals.css.
      className={`draw-result flex flex-col border-b border-border px-4 text-sm ${
        running
          ? "breathe shadow-[inset_4px_0_0_var(--status-running-chip-fill)]"
          : ""
      } ${compact ? "gap-1 overflow-hidden py-2" : "arrive gap-1.5 py-3"}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="w-8 shrink-0 text-sm font-light text-(--text-tertiary) tabular-nums"
        >
          {step.index + 1}
        </span>
        <StatusBadge status={toBadgeStatus(step.status)} />
        <span className="shrink-0 font-mono text-xs">{step.action}</span>
        <span
          className={`min-w-0 font-mono text-xs text-muted-foreground ${
            compact ? "truncate" : "break-all"
          }`}
          title={step.target}
        >
          {step.target}
        </span>
        {!running && (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
            {step.duration_ms} ms
          </span>
        )}
      </div>
      {running ? (
        <p className="pl-10.5 text-xs text-muted-foreground">In progress.</p>
      ) : (
        <>
          {step.assertion && (
            <p
              className={`pl-10.5 text-xs text-muted-foreground ${
                compact ? "truncate" : "break-words"
              }`}
              title={step.assertion}
            >
              Asserts: {step.assertion}
            </p>
          )}
          <p
            className={`pl-10.5 ${compact ? "line-clamp-2" : "break-words"}`}
            title={step.message}
          >
            {step.message === "" ? (
              <span className="text-muted-foreground">(no message)</span>
            ) : (
              step.message
            )}
          </p>
          {/* Only in full (non-compact) rows: a compact row has a fixed
              height the windowing math depends on, so it never grows to
              fit a thumbnail. Every step still gets one somewhere - the
              short-run list is all full rows, and a windowed list's
              failed/warning steps are also listed in full above it
              (StepList's failures summary). */}
          {!compact && step.screenshot_url && (
            <div className="pl-10.5">
              <Screenshot
                url={step.screenshot_url}
                alt={`Screenshot after step ${position}: ${step.action} ${step.target}`}
              />
            </div>
          )}
        </>
      )}
    </li>
  );
}
