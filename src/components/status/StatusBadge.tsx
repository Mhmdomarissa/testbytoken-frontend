import {
  CircleCheckIcon,
  OctagonXIcon,
  LoaderCircleIcon,
  ClockIcon,
  ClockAlertIcon,
  CircleHelpIcon,
  CircleSlashIcon,
  CircleStopIcon,
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
 * UI v2 (section 1.3) - the chip goes quiet. Its anatomy is what carries
 * the accessibility, and it is asserted in StatusBadge.test.tsx and
 * src/lib/color/contrast.test.ts against the committed tokens:
 *   - ground: the status TINT;
 *   - icon: the status colour - non-text, so >=3:1 on its tint and on
 *     card/raised, which is what frees the hues;
 *   - label: the normal text colour, >=4.5:1 on every tint.
 * One FILLED chip per page, for that page's own verdict: the status colour
 * as ground and --status-on as label ink (>=4.5:1). Every status keeps a
 * unique icon silhouette and a unique label; only pass vs fail are
 * guaranteed apart in lightness (>=1.5:1, both themes).
 */
export type Status =
  | "pass"
  | "fail"
  | "running"
  | "skipped"
  | "cancelled"
  | "warning"
  | "queued"
  | "timed_out";

const STATUS_META: Record<
  Status,
  { label: string; icon: LucideIcon; spin?: boolean }
> = {
  pass: { label: "Pass", icon: CircleCheckIcon },
  fail: { label: "Fail", icon: OctagonXIcon },
  running: { label: "Running", icon: LoaderCircleIcon, spin: true },
  queued: { label: "Queued", icon: ClockIcon },
  skipped: { label: "Skipped", icon: CircleSlashIcon },
  // Its own status (UI v2): shares the neutral grey with skipped and
  // queued, but never their icon - a stopped run is not a skipped step.
  cancelled: { label: "Cancelled", icon: CircleStopIcon },
  warning: { label: "Warning", icon: TriangleAlertIcon },
  // Distinct from `fail`: own icon (a clock, not an octagon - it reads as
  // "ran out of time", not "assertion failed"), own color rung, own
  // label - not `fail` with different text (Phase A review, pre-Phase-B
  // item 3: timed_out needs the same full treatment every other status got).
  timed_out: { label: "Timed out", icon: ClockAlertIcon },
};

/**
 * A status's icon, for a surface that marks a status without a chip (the
 * overview's attention list, its "scanned" count). Taking it from here
 * rather than from lucide-react directly keeps one importer of these icon
 * modules - a second one made Turbopack split them into separate modules
 * in the chunk every route shares (+194 B gzip on /p/[token]).
 */
export function statusIcon(status: Status): LucideIcon {
  return STATUS_META[status].icon;
}

export function StatusBadge({
  status,
  label,
  variant = "quiet",
  className,
}: {
  status: Status | UnrecognisedValue;
  /** Override the default label, e.g. a Run's "passed"/"failed" wording. Ignored for an unrecognised status - the raw value is the only honest label there. */
  label?: string;
  /**
   * "quiet" (default): the status tint as ground, the status colour on the
   * icon only, the label in the normal text colour. "filled": the page's
   * ONE verdict (a run's own result, a proof's) - the status colour as
   * ground with the measured on-status label ink. UI v2, section 1.3.
   */
  variant?: "quiet" | "filled";
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
  // (`--status-timed-out-fg`). Without this,
  // `var(--status-timed_out-tint)` resolves to nothing - not a
  // visible error, just a badge that silently renders with an inherited
  // (default) fill instead of its own, which is worse than a build error
  // for exactly the WCAG 1.4.1 reason this component exists.
  const cssName = status.replace(/_/g, "-");
  const filled = variant === "filled";
  return (
    <span
      data-variant={variant}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        className,
      )}
      style={{
        backgroundColor: filled
          ? `var(--status-${cssName}-fg)`
          : `var(--status-${cssName}-tint)`,
        color: filled ? "var(--status-on)" : "var(--ink)",
      }}
    >
      <Icon
        className={cn("size-3.5 shrink-0", meta.spin && "animate-spin")}
        style={filled ? undefined : { color: `var(--status-${cssName}-fg)` }}
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
        "inline-flex max-w-64 items-center gap-1.5 rounded-md border border-dashed border-(--ink) px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-(--ink)",
        className,
      )}
    >
      <CircleHelpIcon className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">Unrecognised: {truncateRaw(raw)}</span>
    </span>
  );
}
