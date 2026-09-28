"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRuns } from "@/lib/api/queries/runs";
import { useTargets } from "@/lib/api/queries/targets";
import { formatDateTime, formatDuration } from "@/lib/format/datetime";
import { StatusBadge } from "@/components/status/StatusBadge";
import { toBadgeStatus } from "@/components/status/badgeStatus";
import { RunPassRate } from "@/components/status/RunPassRate";
import { runStatusLabel } from "@/components/run/runStatus";
import { Card, CardError, CardSkeleton } from "./Card";

const LIMIT = 10;

/**
 * The latest runs, as /runs lists them (first page, labelled as such - a
 * table of what the server sent, not a total). Target names are a lookup
 * against the targets list the console already holds. A running run's pass
 * rate is "Reported when finished", through the same gate as everywhere.
 */
export function RecentRuns() {
  const runs = useRuns({ limit: LIMIT });
  const targets = useTargets();
  const nameOf = (id: string) =>
    targets.data?.find((t) => t.id === id)?.name ?? id;

  return (
    <Card
      title="Recent runs"
      aside={
        <Link href="/runs" className="underline-offset-4 hover:underline">
          Up to {LIMIT} most recent · view all runs
        </Link>
      }
      testId="recent-runs"
    >
      {runs.isError ? (
        <CardError onRetry={() => void runs.refetch()} />
      ) : runs.isPending ? (
        <CardSkeleton lines={5} />
      ) : runs.data.data.length === 0 ? (
        <p className="text-sm text-(--ink-muted)">No runs yet.</p>
      ) : (
        <>
          {/* Phone: one stacked row per run, so pass rate and coverage are
              never scrolled off-screen. */}
          <ul className="-mx-5 sm:hidden" data-testid="recent-runs-stacked">
            {runs.data.data.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-1.5 border-b border-border px-5 py-3 text-sm last:border-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Link
                    href={`/runs/${r.id}` as Route}
                    className="min-w-0 truncate font-mono text-xs underline-offset-4 hover:underline"
                  >
                    {r.id}
                  </Link>
                  <span
                    className="min-w-0 flex-1 truncate text-xs text-(--ink-muted)"
                    title={nameOf(r.target_id)}
                  >
                    {nameOf(r.target_id)}
                  </span>
                  <StatusBadge
                    status={toBadgeStatus(r.status)}
                    label={runStatusLabel(r.status)}
                    className="shrink-0"
                  />
                </div>
                <RunPassRate
                  status={r.status}
                  passRate={r.pass_rate}
                  coverage={r.coverage}
                  pendingText="Reported when finished"
                />
                <p className="text-xs tabular-nums text-(--ink-muted)">
                  {r.finished_at ? (
                    <>{duration(r.started_at, r.finished_at)} · started </>
                  ) : (
                    "Started "
                  )}
                  {formatDateTime(r.started_at)}
                </p>
              </li>
            ))}
          </ul>
          <div className="-mx-5 hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-(--ink-muted)">
                  <th scope="col" className="px-5 py-2 font-medium">
                    Run
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Target
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Pass · coverage
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    Duration
                  </th>
                  <th scope="col" className="px-5 py-2 text-right font-medium">
                    Started
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.data.data.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-5 py-2.5">
                      <Link
                        href={`/runs/${r.id}` as Route}
                        className="font-mono text-xs underline-offset-4 hover:underline"
                      >
                        {r.id}
                      </Link>
                    </td>
                    <td
                      className="max-w-40 truncate px-2 py-2.5"
                      title={nameOf(r.target_id)}
                    >
                      {nameOf(r.target_id)}
                    </td>
                    <td className="px-2 py-2.5">
                      <StatusBadge
                        status={toBadgeStatus(r.status)}
                        label={runStatusLabel(r.status)}
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <RunPassRate
                        status={r.status}
                        passRate={r.pass_rate}
                        coverage={r.coverage}
                        pendingText="Reported when finished"
                      />
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-(--ink-muted)">
                      {r.finished_at
                        ? duration(r.started_at, r.finished_at)
                        : "—"}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-(--ink-muted)">
                      {formatDateTime(r.started_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

function duration(startedAt: string, finishedAt: string): string {
  return formatDuration(
    new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
  );
}
