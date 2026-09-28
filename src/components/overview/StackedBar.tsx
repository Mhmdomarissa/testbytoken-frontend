import { cn } from "@/lib/utils";

export interface Segment {
  key: string;
  label: string;
  count: number;
  /** A CSS colour, normally a status token. Never the only channel. */
  color: string;
}

/**
 * A single stacked bar of counts - the server's numbers, drawn. Colour is
 * never alone (UI v2 rule for colour-only marks): segments are separated
 * by a 2px gap in the surface colour, every count is printed in the legend
 * beside its label, and the bar itself carries the same sentence as text
 * for assistive tech. Empty segments are listed in the legend as 0 rather
 * than dropped.
 *
 * The bar is drawn against `total`, the whole the server says there is -
 * never against the sum of what has been reported so far, which would draw
 * "1 passed" of a 12-step run as a full green bar. Whatever the segments
 * don't account for is neutral track (and said so in the legend). When the
 * whole isn't known (`total: null`), there is nothing honest to draw a
 * proportion of: no bar, only the counts.
 */
export function StackedBar({
  segments,
  total,
  className,
  label,
}: {
  segments: Segment[];
  /** The whole the counts are part of, or null when it isn't known. */
  total: number | null;
  className?: string;
  /** What is being counted, for the text alternative ("runs"). */
  label: string;
}) {
  const counted = segments.reduce((n, s) => n + s.count, 0);
  const remaining = total === null ? 0 : Math.max(0, total - counted);
  const shown = segments.filter((s) => s.count > 0);
  const parts = shown.map((s) => `${s.count} ${s.label.toLowerCase()}`);
  if (remaining > 0) parts.push(`${remaining} not reported`);
  const sentence =
    counted === 0 && remaining === 0
      ? `No ${label}.`
      : total === null
        ? parts.join(", ")
        : `${parts.join(", ")}, of ${total} ${label}`;

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {total !== null && (
        <div
          role="img"
          aria-label={sentence}
          data-testid="stacked-bar"
          className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full"
        >
          {shown.map((s) => (
            <span
              key={s.key}
              data-segment={s.key}
              className="h-full min-w-[3px]"
              style={{
                flexGrow: s.count,
                flexBasis: 0,
                backgroundColor: s.color,
              }}
            />
          ))}
          {(remaining > 0 || counted === 0) && (
            <span
              data-segment="remaining"
              className="h-full min-w-[3px] bg-(--surface-raised)"
              style={{ flexGrow: remaining || 1, flexBasis: 0 }}
            />
          )}
        </div>
      )}
      <ul
        className="flex flex-wrap gap-x-4 gap-y-1 text-xs"
        aria-hidden={total !== null ? "true" : undefined}
        aria-label={total === null ? `${label} so far` : undefined}
      >
        {segments.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="tabular-nums font-semibold">{s.count}</span>
            <span className="text-(--ink-muted)">{s.label}</span>
          </li>
        ))}
        {remaining > 0 && (
          <li className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full border border-(--line-input)"
            />
            <span className="tabular-nums font-semibold">{remaining}</span>
            <span className="text-(--ink-muted)">not reported</span>
          </li>
        )}
      </ul>
    </div>
  );
}
