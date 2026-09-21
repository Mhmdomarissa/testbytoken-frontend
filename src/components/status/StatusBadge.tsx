import {
  CircleCheckIcon,
  OctagonXIcon,
  LoaderCircleIcon,
  ClockIcon,
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
  "pass" | "fail" | "running" | "skipped" | "warning" | "queued";

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
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide",
        className,
      )}
      style={{
        color: `var(--status-${status}-fg)`,
        backgroundColor: `var(--status-${status}-bg)`,
        borderColor: `var(--status-${status}-border)`,
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
