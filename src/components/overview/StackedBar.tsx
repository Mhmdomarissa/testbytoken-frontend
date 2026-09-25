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
 */
export function StackedBar({
  segments,
  className,
  label,
}: {
  segments: Segment[];
  className?: string;
  /** What is being counted, for the text alternative ("runs"). */
  label: string;
}) {
  const total = segments.reduce((n, s) => n + s.count, 0);
  const sentence =
    total === 0
      ? `No ${label}.`
      : segments
          .filter((s) => s.count > 0)
          .map((s) => `${s.count} ${s.label.toLowerCase()}`)
          .join(", ");
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div
        role="img"
        aria-label={sentence}
        className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-(--surface-raised)"
      >
        {total > 0 &&
          segments
            .filter((s) => s.count > 0)
            .map((s) => (
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
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-hidden="true">
        {segments.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="tabular-nums font-semibold">{s.count}</span>
            <span className="text-(--ink-muted)">{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
