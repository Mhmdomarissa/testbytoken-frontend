"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ListChecksIcon } from "lucide-react";
import { useCancelRun, useRun } from "@/lib/api/queries/runs";
import { useTarget } from "@/lib/api/queries/targets";
import { useJobEvents } from "@/lib/api/sse/useJobEvents";
import { ApiError } from "@/lib/api/errors";
import { UnrecognisedValue } from "@/lib/api/tolerant";
import { StatusBadge } from "@/components/status/StatusBadge";
import { toBadgeStatus } from "@/components/status/badgeStatus";
import { PassRateCoverage } from "@/components/status/PassRateCoverage";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorState } from "@/components/state/ErrorState";
import { ListSkeleton } from "@/components/state/ListSkeleton";
import { LiveStatus, liveState } from "@/components/run/LiveStatus";
import { StepList } from "@/components/run/StepList";
import { reconcileRun } from "@/components/run/reconcile";
import { isRunOver, runStatusLabel } from "@/components/run/runStatus";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong.";
}

export default function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <Watch params={params} />
    </Suspense>
  );
}

/** `Date.now()`, re-read every second, so "no update for Ns" can be judged without impure renders. */
function useNow(): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, 1_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Watch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const run = useRun(id); // GET /runs/{id}: the authority
  const events = useJobEvents(id); // GET /jobs/{id}/events: delivery of changes
  const target = useTarget(run.data?.target_id);
  const cancel = useCancelRun(id);
  const now = useNow();
  const [confirming, setConfirming] = useState(false);

  // docs/API_CONTRACT.md: reconcile against GET when the stream delivers
  // `done` and whenever it reconnects.
  const { refetch } = run;
  useEffect(() => {
    if (events.finished) void refetch();
  }, [events.finished, refetch]);
  useEffect(() => {
    if (events.reconnectCount > 0) void refetch();
  }, [events.reconnectCount, refetch]);

  if (
    run.isError &&
    run.error instanceof ApiError &&
    run.error.status === 404
  ) {
    return (
      <EmptyState
        icon={ListChecksIcon}
        title="Run not found"
        description="It may have been removed."
        action={<BackToRuns />}
      />
    );
  }
  if (run.isPending && Object.keys(events.steps).length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <ListSkeleton rows={4} />
      </div>
    );
  }
  if (run.isError && Object.keys(events.steps).length === 0 && !run.data) {
    return (
      <ErrorState
        message={message(run.error)}
        onRetry={() => void run.refetch()}
      />
    );
  }

  const server = run.data;
  const serverTerminal = isRunOver(server?.status);
  const reconciled = reconcileRun({
    streamSteps: Object.values(events.steps),
    streamStatus: events.status,
    streamFinished: events.finished,
    serverSteps: server?.steps ?? null,
    serverStatus: server?.status ?? null,
    serverTerminal,
    serverFetchedAfterFinish:
      events.finishedAt !== null && run.dataUpdatedAt >= events.finishedAt,
  });
  const over = isRunOver(reconciled.status);
  const status = reconciled.status;
  const live = liveState({
    connection: events.connectionStatus,
    finished: events.finished,
    runOver: serverTerminal,
    now,
    lastEventAt: events.lastEventAt,
    lastFrameAt: events.lastFrameAt,
  });
  const anyRunning = reconciled.steps.some(
    (s) => !(s.status instanceof UnrecognisedValue) && s.status === "running",
  );
  const cancellable =
    !over &&
    status !== null &&
    !(status instanceof UnrecognisedValue) &&
    (status === "queued" || status === "running");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/runs"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3" aria-hidden="true" />
          Runs
        </Link>
        <h1 className="flex flex-wrap items-center gap-3 font-heading text-2xl font-light">
          <span className="break-all">Run</span>
          <span
            className="font-mono text-base text-muted-foreground"
            data-testid="run-id"
          >
            {id}
          </span>
        </h1>
        {server && (
          <p className="break-words text-sm text-muted-foreground">
            {target.data ? `${target.data.name} - ` : ""}
            {server.plan_id !== null
              ? `from an approved plan (${server.plan_id})`
              : server.suite_id !== null
                ? `from a suite (${server.suite_id})`
                : ""}
            {" - started "}
            {new Date(server.started_at).toLocaleString()}
          </p>
        )}
      </div>

      <div
        className="flex flex-wrap items-center gap-3"
        data-testid="run-summary"
      >
        {status !== null ? (
          <span
            data-testid="run-status"
            data-status={
              status instanceof UnrecognisedValue ? "unrecognised" : status
            }
          >
            <StatusBadge
              status={toBadgeStatus(status)}
              label={runStatusLabel(status)}
            />
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            Waiting for the first report.
          </span>
        )}
        {server && serverTerminal ? (
          <PassRateCoverage
            passRate={server.pass_rate}
            coverage={server.coverage}
          />
        ) : (
          <span
            className="text-sm text-muted-foreground"
            data-testid="no-result-yet"
          >
            The pass rate is reported when the run finishes.
          </span>
        )}
        {cancellable && (
          <Button
            variant="outline"
            className="ml-auto"
            disabled={cancel.isPending}
            onClick={() => setConfirming(true)}
          >
            {cancel.isPending ? "Cancelling…" : "Cancel run"}
          </Button>
        )}
      </div>

      {status instanceof UnrecognisedValue && (
        <p role="status" className="text-sm" data-testid="run-unrecognised">
          The server reports this run as &ldquo;{status.raw}&rdquo;, a state
          this version of the app doesn&apos;t recognise. It is shown as
          reported; nothing is assumed about it.
        </p>
      )}
      {!(status instanceof UnrecognisedValue) && status === "timed_out" && (
        <p role="status" className="text-sm" data-testid="run-timed-out">
          This run timed out: the engine stopped responding. That is different
          from a failed step, and no report was produced.
        </p>
      )}
      {!(status instanceof UnrecognisedValue) && status === "cancelled" && (
        <p role="status" className="text-sm" data-testid="run-cancelled">
          This run was cancelled. Steps that had not run are shown as skipped.
        </p>
      )}
      {cancel.isError && (
        <p role="alert" className="text-sm text-destructive">
          {message(cancel.error)}
        </p>
      )}
      {run.isError && (
        <p
          role="alert"
          className="text-sm text-destructive"
          data-testid="server-record-error"
        >
          Couldn&apos;t reach the server&apos;s record of this run:{" "}
          {message(run.error)} What is shown is the live stream only.
        </p>
      )}

      <LiveStatus
        live={live}
        reconnects={events.reconnectCount}
        unreadable={events.unreadableFrameCount}
      />

      {reconciled.notes.length > 0 && (
        <div
          role="status"
          data-testid="reconcile-notes"
          className="flex flex-col gap-1 border border-border bg-card p-3 text-sm"
        >
          <p className="font-medium">
            The live stream and the server&apos;s record disagreed. The
            server&apos;s is shown.
          </p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {reconciled.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="flex flex-col gap-2" aria-label="Steps">
        <h2 className="font-heading text-lg font-light">
          {over
            ? `${reconciled.steps.length} ${reconciled.steps.length === 1 ? "step" : "steps"}`
            : `${reconciled.steps.length} ${reconciled.steps.length === 1 ? "step" : "steps"} so far`}
        </h2>
        {reconciled.steps.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="no-steps">
            {over
              ? "This run has no steps."
              : "No steps yet. The engine hasn't reported one."}
          </p>
        ) : (
          <StepList steps={reconciled.steps} live={!over} />
        )}
        {!over && reconciled.steps.length > 0 && !anyRunning && (
          <p
            className="text-sm text-muted-foreground"
            data-testid="waiting-next"
          >
            Waiting for the next step from the engine.
          </p>
        )}
      </section>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Cancel this run?</DialogTitle>
            <DialogDescription>
              The run stops and the steps that haven&apos;t run are marked
              skipped. What already ran stays in the record.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep running
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirming(false);
                cancel.mutate();
              }}
            >
              Cancel run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BackToRuns() {
  return (
    <Link
      href="/runs"
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      <ArrowLeftIcon />
      Back to runs
    </Link>
  );
}
