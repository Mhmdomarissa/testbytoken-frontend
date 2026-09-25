"use client";

import { useEffect, useState } from "react";
import { useResource } from "@/hooks/useResource";
import { WorkspaceSchema } from "@/lib/contract";
import { enumLabel } from "@/lib/api/tolerant";
import { DEMO_WORKSPACE_ID } from "@/lib/workspace";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** "just now", "12 s ago", "4 min ago", "2 h ago" - from a timestamp WE recorded. */
function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s} s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}

/** Re-render on an interval so "ago" stays true; the time itself never changes. */
function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/**
 * The engine's state, as this page last heard it (UI v2 V1). What it shows
 * is exactly what the workspace endpoint said, plus WHEN we heard it: the
 * time is our own - the moment our request came back - not a server field
 * (the contract has no "last check"; logged in API_CONTRACT.md). When the
 * request fails it says so, with the last time we did hear, and never
 * leaves a stale "ready" on screen.
 *
 * Today the workspace is fetched once when the console mounts - there is
 * no poll yet (that is a behaviour change, proposed separately), so "ago"
 * keeps growing until the page reloads, which is the truth about how
 * fresh this is.
 */
export function EngineStatusCard() {
  const workspace = useResource(
    `/workspaces/${DEMO_WORKSPACE_ID}`,
    WorkspaceSchema,
  );
  const [heardAt, setHeardAt] = useState<number | null>(null);
  const now = useNow(5_000);

  // Stamp the moment each successful response lands. `data` is a new
  // object per response, so this runs once per response, not per render.
  const data = workspace.status === "success" ? workspace.data : null;
  useEffect(() => {
    if (!data) return;
    let live = true;
    queueMicrotask(() => {
      if (live) setHeardAt(Date.now());
    });
    return () => {
      live = false;
    };
  }, [data]);

  let dot: string;
  let label: string;
  let detail: string;
  if (workspace.status === "loading") {
    dot = "bg-(--status-queued-fg)";
    label = "Checking the engine…";
    detail = heardAt ? `Last heard ${ago(now - heardAt)}` : "Not heard yet";
  } else if (workspace.status === "error") {
    dot = "bg-(--status-fail-fg)";
    label = "Can't reach the engine";
    detail = heardAt ? `Last heard ${ago(now - heardAt)}` : "Never heard";
  } else {
    const ready = workspace.data.status === "ready";
    dot = ready ? "bg-(--status-pass-fg)" : "bg-(--status-warning-fg)";
    label = ready ? "Engine ready" : enumLabel(workspace.data.status);
    detail = heardAt ? `Checked ${ago(now - heardAt)}` : "Checked just now";
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            data-testid="engine-status"
            data-state={workspace.status}
            tabIndex={0}
            className="flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-(--surface-card) px-3 py-2 text-xs shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:shadow-none"
          />
        }
      >
        <span
          aria-hidden="true"
          className={cn("size-2 shrink-0 rounded-full", dot)}
        />
        <span className="flex min-w-0 flex-col group-data-[collapsible=icon]:sr-only">
          <span className="truncate font-medium">{label}</span>
          <span className="truncate text-(--ink-muted) tabular-nums">
            {detail}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-64">
        {label}. {detail} - when this page last heard from the engine
        {workspace.status === "error" ? ` (${workspace.message})` : ""}.
      </TooltipContent>
    </Tooltip>
  );
}
