import {
  CircleCheckIcon,
  OctagonXIcon,
  LoaderCircleIcon,
  ClockIcon,
  ClockAlertIcon,
  CircleHelpIcon,
  CircleSlashIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UnrecognisedValue, truncateRaw } from "@/lib/api/tolerant";

/**
 * The single place a status (run, step, scan, job) renders anywhere in
 * the app - tables, timelines, run summaries, charts. Per the Phase A
 * review (WCAG 1.4.1: color alone binary-searched every status to the
 * same lightness, making pass/fail indistinguishable for ~6% of male
 * users and identical in greyscale): every status carries three
 * independent channels - a filled chip color, a distinct-silhouette
 * icon, and a text label. Never render a status as a color swatch alone;
 * use this component instead of a one-off styled span.
 *
 * Renders as a FILLED chip (Phase B, B2), not colored text on the page
 * background: the label/icon are always --color-blue-deep, drawn on top
 * of a per-status fill (styles/tokens.css's `--status-*-chip-fill`).
 * This is a real accessibility change, not a restyle - a filled chip's
 * fill only needs 3:1 against the page (AA non-text) and the label only
 * needs 4.5:1 against ITS OWN fill, not against the page, which is a
 * much wider constraint than the old text-on-page approach and is what
 * let the seven statuses spread further apart (see tokens.css's comment
 * on `--status-*-chip-fill` for the exact numbers).
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
  status: Status | UnrecognisedValue;
  /** Override the default label, e.g. a Run's "passed"/"failed" wording. Ignored for an unrecognised status - the raw value is the only honest label there. */
  label?: string;
  className?: string;
}) {
  // Phase B §1.1 / docs/PHASE_B0_5.md A1: a status this client doesn't
  // know renders as visibly unrecognised, carrying the raw value - never
  // a throw, never a blank, never a fallback that reads as a real state.
  // The second check is for a caller that bypassed the types entirely
  // (an `as` cast, JS): a status with no STATUS_META entry gets the same
  // treatment instead of `undefined.icon`.
  if (status instanceof UnrecognisedValue)
    return <UnrecognisedChip raw={status.raw} className={className} />;
  const meta = STATUS_META[status];
  if (!meta)
    return <UnrecognisedChip raw={String(status)} className={className} />;
  const Icon = meta.icon;
  // `status` values are snake_case (matching the contract's enum, e.g.
  // `timed_out`); the CSS custom properties they key into use hyphens
  // (`--status-timed-out-chip-fill`). Without this,
  // `var(--status-timed_out-chip-fill)` resolves to nothing - not a
  // visible error, just a badge that silently renders with an inherited
  // (default) fill instead of its own, which is worse than a build error
  // for exactly the WCAG 1.4.1 reason this component exists.
  const cssName = status.replace(/_/g, "-");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-(--color-blue-deep)",
        className,
      )}
      style={{ backgroundColor: `var(--status-${cssName}-chip-fill)` }}
    >
      <Icon
        className={cn("size-3", meta.spin && "animate-spin")}
        aria-hidden="true"
      />
      {label ?? meta.label}
    </span>
  );
}

/**
 * Deliberately NOT a fill from the status scale, and not a neutral grey:
 * a dashed outline in the primary text color on the bare page. Every
 * legitimate state is a solid fill, so "no fill, dashed edge, question
 * mark" can't be mistaken for one - and it needs no new hue. The raw
 * value is shown (React-escaped, capped at 40 chars, the full string in
 * the tooltip attribute) because "unrecognised" alone would hide what
 * the server actually said.
 */
function UnrecognisedChip({
  raw,
  className,
}: {
  raw: string;
  className?: string;
}) {
  return (
    <span
      title={`Unrecognised status: ${raw}`}
      data-unrecognised-status=""
      className={cn(
        "inline-flex max-w-64 items-center gap-1 border border-dashed border-(--text-primary) px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-(--text-primary)",
        className,
      )}
    >
      <CircleHelpIcon className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">Unrecognised: {truncateRaw(raw)}</span>
    </span>
  );
}
