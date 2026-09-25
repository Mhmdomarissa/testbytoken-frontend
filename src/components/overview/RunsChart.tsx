import { formatDay } from "@/lib/format/datetime";

export interface DayCounts {
  date: string;
  passed: number;
  failed: number;
  timed_out: number;
  cancelled: number;
  other: number;
}

export const VERDICTS = [
  { key: "passed", label: "Passed", color: "var(--status-pass-fg)" },
  { key: "failed", label: "Failed", color: "var(--status-fail-fg)" },
  { key: "timed_out", label: "Timed out", color: "var(--status-timed-out-fg)" },
  { key: "cancelled", label: "Cancelled", color: "var(--status-cancelled-fg)" },
  // A status this client doesn't know: counted and shown, never dropped.
  { key: "other", label: "Unrecognised", color: "var(--ink-faint)" },
] as const satisfies readonly {
  key: keyof Omit<DayCounts, "date">;
  label: string;
  color: string;
}[];

const H = 160; // drawing height, in px (the SVG isn't vertically scaled)
const GAP = 2; // px between stacked segments and between bars

/**
 * Runs per day, stacked by verdict - hand-written SVG, no charting
 * library (UI v2 V2: one chart doesn't justify ~100 KB under a
 * zero-tolerance bundle ratchet). Every number is the server's
 * `runs_by_day`; the legend's totals are the sum of that complete array,
 * not of any paginated list. Colour is never alone: 2px gaps between
 * segments, counts in the legend, each bar titled with its day's
 * sentence, and the whole chart as a visually hidden table.
 */
export function RunsChart({
  days,
  tzCaption,
}: {
  days: DayCounts[];
  tzCaption: string;
}) {
  const shown = VERDICTS.filter(
    (v) => v.key !== "other" || days.some((d) => d.other > 0),
  );
  const totalOf = (d: DayCounts) => shown.reduce((n, v) => n + d[v.key], 0);
  const max = Math.max(1, ...days.map(totalOf));
  const totals = Object.fromEntries(
    shown.map((v) => [v.key, days.reduce((n, d) => n + d[v.key], 0)]),
  ) as Record<string, number>;
  const allZero = days.every((d) => totalOf(d) === 0);

  const n = days.length;
  const slot = 100 / n; // % of width per day
  const barWidth = Math.max(slot - 0.8, slot * 0.72);

  return (
    <figure className="flex flex-col gap-3" data-testid="runs-chart">
      <div className="relative">
        <svg
          viewBox={`0 0 100 ${H}`}
          preserveAspectRatio="none"
          className="block h-40 w-full"
          aria-hidden="true"
          focusable="false"
        >
          {/* baseline */}
          <line
            x1="0"
            x2="100"
            y1={H - 0.5}
            y2={H - 0.5}
            stroke="var(--line)"
            vectorEffect="non-scaling-stroke"
          />
          {days.map((d, i) => {
            let y = H;
            const x = i * slot + (slot - barWidth) / 2;
            return (
              <g key={d.date}>
                <title>{`${formatDay(d.date)}: ${daySentence(d, shown)}`}</title>
                {shown.map((v) => {
                  const count = d[v.key];
                  if (count === 0) return null;
                  const h = Math.max(2, (count / max) * (H - 8) - GAP);
                  y -= h + GAP;
                  return (
                    <rect
                      key={v.key}
                      data-verdict={v.key}
                      x={x}
                      y={y + GAP}
                      width={barWidth}
                      height={h}
                      fill={v.color}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
        {allZero && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-(--ink-muted)">
            No finished runs in these {n} days.
          </p>
        )}
      </div>

      <div
        className="flex justify-between text-xs text-(--ink-muted) tabular-nums"
        aria-hidden="true"
      >
        <span>{formatDay(days[0]!.date)}</span>
        <span>{formatDay(days[Math.floor((n - 1) / 2)]!.date)}</span>
        <span>{formatDay(days[n - 1]!.date)}</span>
      </div>

      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
        <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Totals">
          {shown.map((v) => (
            <li key={v.key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: v.color }}
              />
              <span className="font-semibold tabular-nums">
                {totals[v.key]}
              </span>
              <span className="text-(--ink-muted)">{v.label}</span>
            </li>
          ))}
        </ul>
        <span className="text-(--ink-muted)">{tzCaption}</span>
      </figcaption>

      <table className="sr-only">
        <caption>Finished runs per day by verdict. {tzCaption}.</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {shown.map((v) => (
              <th key={v.key} scope="col">
                {v.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{formatDay(d.date, true)}</th>
              {shown.map((v) => (
                <td key={v.key}>{d[v.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function daySentence(
  d: DayCounts,
  shown: readonly { key: keyof Omit<DayCounts, "date">; label: string }[],
): string {
  const parts = shown
    .filter((v) => d[v.key] > 0)
    .map((v) => `${d[v.key]} ${v.label.toLowerCase()}`);
  return parts.length ? parts.join(", ") : "no finished runs";
}
