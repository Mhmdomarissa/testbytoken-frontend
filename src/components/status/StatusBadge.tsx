import {
  CircleCheckIcon,
  OctagonXIcon,
  LoaderCircleIcon,
  ClockIcon,
  ClockAlertIcon,
  CircleSlashIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The single place a status (run, step, scan, job) renders anywhere in
 * the app - tables, timelines, run summaries, charts. Per the Phase A
 * review (WCAG 1.4.1: color alone binary-searched every status to the
 * same lightness, making pass/fail indistinguishable for ~6% of male
 * users and identical in greyscale): every status carries three
 * independent channels - color, a distinct-silhouette icon, and a text
 * label. Never render a status as a color swatch alone; use this
 * component instead of a one-off styled span.
 */
export type Status =
  "pass" | "fail" | "running" | "skipped" | "warning" | "queued" | "timed_out";

const STATUS_META: Record<
  Status,
  { label: string; icon: LucideIcon; spin?: boolean }
> = {
  pass: { label: "Pass", icon: CircleCheckIcon },
  fail: { label: "Fail", icon: OctagonXIcon },
  running: { label: "Running", icon: LoaderCircleIcon, spin: true },
  queued: { label: "Queued", icon: ClockIcon },
  skipped: { label: "Skipped", icon: CircleSlashIcon },
  warning: { label: "Warning", icon: TriangleAlertIcon },
  // Distinct from `fail`: own icon (a clock, not an octagon - it reads as
  // "ran out of time", not "assertion failed"), own color rung, own
  // label - not `fail` with different text (Phase A review, pre-Phase-B
  // item 3: timed_out needs the same full treatment every other status got).
  timed_out: { label: "Timed out", icon: ClockAlertIcon },
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: Status;
  /** Override the default label, e.g. a Run's "passed"/"failed" wording. */
  label?: string;
  className?: string;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  // `status` values are snake_case (matching the contract's enum, e.g.
  // `timed_out`); the CSS custom properties they key into use hyphens
  // (`--status-timed-out-fg`). Without this, `var(--status-timed_out-fg)`
  // resolves to nothing - not a visible error, just a badge that silently
  // renders with inherited (default) color/background/border instead of
  // its own, which is worse than a build error for exactly the WCAG 1.4.1
  // reason this component exists.
  const cssName = status.replace(/_/g, "-");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide",
        className,
      )}
      style={{
        color: `var(--status-${cssName}-fg)`,
        backgroundColor: `var(--status-${cssName}-bg)`,
        borderColor: `var(--status-${cssName}-border)`,
      }}
    >
      <Icon
        className={cn("size-3", meta.spin && "animate-spin")}
        aria-hidden="true"
      />
      {label ?? meta.label}
    </span>
  );
}
