"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ListChecksIcon } from "lucide-react";
import { RunSummarySchema, RunStatusSchema, paginated } from "@/lib/contract";
import type { z } from "zod";
import { useResource } from "@/hooks/useResource";
import { ListSkeleton } from "@/components/state/ListSkeleton";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorState } from "@/components/state/ErrorState";
import { StatusBadge, type Status } from "@/components/status/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const RunListResponseSchema = paginated(RunSummarySchema);

// Run status vocabulary differs slightly from the six-value step/design
// status scale (a run additionally has "queued"/"running"/"passed"/
// "failed"/"cancelled") - this maps each onto the closest status token.
const STATUS_TOKEN: Record<z.infer<typeof RunStatusSchema>, Status> = {
  queued: "queued",
  running: "running",
  passed: "pass",
  failed: "fail",
  cancelled: "skipped",
  // Same color family as `failed` (both are bad outcomes) - the distinct
  // "timed_out" text label (passed separately below) is what actually
  // distinguishes it, not the color.
  timed_out: "fail",
};

export default function RunsPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <RunsList />
    </Suspense>
  );
}

function RunsList() {
  const searchParams = useSearchParams();
  const url = `/runs${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const runs = useResource(url, RunListResponseSchema);
  const filteredToEmptyTarget = searchParams.get("target_id") === "tgt_empty";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredToEmptyTarget ? (
            <>
              Filtered to a target with no run history yet.{" "}
              <Link href="/runs" className="underline">
                Clear filter
              </Link>
            </>
          ) : (
            <>
              All runs.{" "}
              <Link href="/runs?target_id=tgt_empty" className="underline">
                View a target with none
              </Link>
            </>
          )}
        </p>
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/runs?simulate_error=true" />}
          nativeButton={false}
        >
          Simulate error
        </Button>
      </div>

      {runs.status === "loading" && <ListSkeleton rows={4} />}

      {runs.status === "error" && (
        <ErrorState message={runs.message} onRetry={runs.retry} />
      )}

      {runs.status === "success" && runs.data.data.length === 0 && (
        <EmptyState
          icon={ListChecksIcon}
          title="No runs yet"
          description="This target has never been run. Runs appear here once one starts."
        />
      )}

      {runs.status === "success" && runs.data.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pass rate</TableHead>
              <TableHead>Coverage</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.data.data.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="font-mono text-xs">{run.id}</TableCell>
                <TableCell>
                  <StatusBadge
                    status={STATUS_TOKEN[run.status]}
                    label={run.status}
                  />
                </TableCell>
                <TableCell className="tabular-nums">
                  {Math.round(run.pass_rate * 100)}%
                </TableCell>
                <TableCell className="tabular-nums">
                  {run.coverage.generated}/{run.coverage.candidate}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {run.token_cost.toFixed(1)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
