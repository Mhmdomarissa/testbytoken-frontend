"use client";

import type { OverviewRange } from "@/lib/api/queries/overview";
import { cn } from "@/lib/utils";

const OPTIONS: { value: OverviewRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "14d", label: "14 days" },
  { value: "30d", label: "30 days" },
];

/** A segmented switch; the choice lives in the URL (?range=) so it can be linked. */
export function RangeSwitch({
  value,
  onChange,
}: {
  value: OverviewRange;
  onChange: (range: OverviewRange) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Range"
      className="inline-flex rounded-lg border border-border bg-card p-0.5 shadow-card"
    >
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-(--duration-fast) outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-(--surface-raised) text-foreground"
                : "text-(--ink-muted) hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
