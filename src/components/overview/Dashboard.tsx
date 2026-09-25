"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  ArrowRightIcon,
  CircleIcon,
  KeyRoundIcon,
  ScanSearchIcon,
  ShieldCheckIcon,
} from "lucide-react";
import type { useOverview } from "@/lib/api/queries/overview";
import { isUnrecognised } from "@/lib/api/tolerant";
import { formatDateTime } from "@/lib/format/datetime";
import { StatusBadge, statusIcon } from "@/components/status/StatusBadge";
import { toBadgeStatus } from "@/components/status/badgeStatus";
import { RunPassRate } from "@/components/status/RunPassRate";
import { runStatusLabel } from "@/components/run/runStatus";
import { Card, CardError, CardSkeleton } from "./Card";
import { StackedBar } from "./StackedBar";
import { RunsChart, VERDICTS } from "./RunsChart";

type Query = ReturnType<typeof useOverview>;
type Overview = NonNullable<Query["data"]>;

const quietLink =
  "inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-gold-text underline-offset-4 hover:underline";

/**
 * The KPI row, the chart, and needs-attention - every number from one
 * /overview response. Loading shows shaped skeletons; a failed request
 * turns every card into "Couldn't load" with a retry (never zeros).
 */
export function Dashboard({
  overview,
  tzCaption,
}: {
  overview: Query;
  tzCaption: string;
}) {
  const retry = () => void overview.refetch();

  if (overview.isError) {
    return (
      <div className="flex flex-col gap-5" data-testid="overview-failed">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            "Runs in range",
            "Latest suite run",
            "Targets",
            "Proofs shared",
          ].map((t) => (
            <Card key={t} title={t}>
              <CardError onRetry={retry} />
            </Card>
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="Runs per day" className="lg:col-span-2">
            <CardError onRetry={retry} />
          </Card>
          <Card title="Needs attention">
            <CardError onRetry={retry} />
          </Card>
        </div>
      </div>
    );
  }

  if (overview.isPending) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <p role="status" className="sr-only">
          Loading the overview…
        </p>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            "Runs in range",
            "Latest suite run",
            "Targets",
            "Proofs shared",
          ].map((t) => (
            <Card key={t} title={t}>
              <CardSkeleton />
            </Card>
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="Runs per day" className="lg:col-span-2">
            <CardSkeleton lines={4} />
          </Card>
          <Card title="Needs attention">
            <CardSkeleton lines={3} />
          </Card>
        </div>
      </div>
    );
  }

  const data = overview.data;
  return (
    <div className="flex flex-col gap-5">
      {data.targets.total === 0 ? (
        <NewAccountChecklist data={data} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <RunsKpi data={data} />
          <LatestSuiteRunKpi data={data} />
          <TargetsKpi data={data} />
          <ProofsKpi data={data} />
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card
          title="Runs per day"
          aside="Finished runs, by verdict"
          className="lg:col-span-2"
          testId="runs-per-day"
        >
          <RunsChart days={data.runs_by_day} tzCaption={tzCaption} />
        </Card>
        <AttentionCard data={data} />
      </div>
      <p className="text-xs text-(--ink-muted)">
        As of {formatDateTime(data.generated_at)}.
      </p>
    </div>
  );
}

function RunsKpi({ data }: { data: Overview }) {
  const sum = (k: (typeof VERDICTS)[number]["key"]) =>
    data.runs_by_day.reduce((n, d) => n + d[k], 0);
  const segments = VERDICTS.filter(
    (v) => v.key !== "other" || sum("other") > 0,
  ).map((v) => ({
    key: v.key,
    label: v.label,
    count: sum(v.key),
    color: v.color,
  }));
  const total = segments.reduce((n, s) => n + s.count, 0);
  return (
    <Card title="Runs in range" testId="kpi-runs">
      <p className="text-3xl font-semibold tabular-nums">{total}</p>
      <StackedBar segments={segments} label="finished runs" />
      <Link href="/runs" className={quietLink}>
        Open run history{" "}
        <ArrowRightIcon className="size-3.5" aria-hidden="true" />
      </Link>
    </Card>
  );
}

function LatestSuiteRunKpi({ data }: { data: Overview }) {
  const run = data.latest_suite_run;
  if (!run) {
    return (
      <Card title="Latest suite run" testId="kpi-latest">
        <p className="text-sm text-(--ink-muted)">
          No suite has run yet. A suite is generated the first time a target is
          scanned.
        </p>
      </Card>
    );
  }
  const other =
    run.steps.total - run.steps.passed - run.steps.failed - run.steps.skipped;
  const segments = [
    {
      key: "passed",
      label: "Passed",
      count: run.steps.passed,
      color: "var(--status-pass-fg)",
    },
    {
      key: "failed",
      label: "Failed",
      count: run.steps.failed,
      color: "var(--status-fail-fg)",
    },
    {
      key: "skipped",
      label: "Skipped",
      count: run.steps.skipped,
      color: "var(--status-skipped-fg)",
    },
    ...(other > 0
      ? [
          {
            key: "other",
            label: "Other",
            count: other,
            color: "var(--ink-faint)",
          },
        ]
      : []),
  ];
  return (
    <Card title="Latest suite run" testId="kpi-latest">
      <Link
        href={`/runs/${run.run_id}` as Route}
        className="-mt-2 w-fit truncate font-mono text-xs text-(--ink-muted) underline-offset-4 hover:underline"
      >
        {run.run_id}
      </Link>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {/* The dashboard's one verdict: filled. */}
        <StatusBadge
          status={toBadgeStatus(run.status)}
          variant="filled"
          label={runStatusLabel(run.status)}
        />
        <span className="truncate text-sm" title={run.target_name}>
          {run.target_name}
        </span>
      </div>
      <RunPassRate
        status={run.status}
        passRate={run.pass_rate}
        coverage={run.coverage}
        pendingText="Pass rate is reported when the run finishes."
        className="text-sm"
      />
      <StackedBar segments={segments} label={`steps of ${run.steps.total}`} />
    </Card>
  );
}

function TargetsKpi({ data }: { data: Overview }) {
  const { total, scanned, needs_attention } = data.targets;
  return (
    <Card title="Targets" testId="kpi-targets">
      <p className="text-3xl font-semibold tabular-nums">{total}</p>
      <ul className="flex flex-wrap gap-2 text-xs">
        <li className="inline-flex items-center gap-1.5 rounded-md bg-(--status-pass-tint) px-2 py-0.5">
          <PassIcon
            aria-hidden="true"
            className="size-3.5 text-(--status-pass-fg)"
          />
          <span className="font-semibold tabular-nums">{scanned}</span> scanned
        </li>
        <li className="inline-flex items-center gap-1.5 rounded-md bg-(--status-warning-tint) px-2 py-0.5">
          <ScanSearchIcon
            aria-hidden="true"
            className="size-3.5 text-(--status-warning-fg)"
          />
          <span className="font-semibold tabular-nums">{needs_attention}</span>{" "}
          need attention
        </li>
      </ul>
      <Link href="/targets" className={quietLink}>
        Open the target list{" "}
        <ArrowRightIcon className="size-3.5" aria-hidden="true" />
      </Link>
    </Card>
  );
}

function ProofsKpi({ data }: { data: Overview }) {
  const { live, revoked } = data.proofs;
  return (
    <Card title="Proofs shared" testId="kpi-proofs">
      <p className="text-3xl font-semibold tabular-nums">{live}</p>
      <p className="text-xs text-(--ink-muted)">
        <span className="font-semibold text-foreground tabular-nums">
          {live}
        </span>{" "}
        live ·{" "}
        <span className="font-semibold text-foreground tabular-nums">
          {revoked}
        </span>{" "}
        revoked
      </p>
    </Card>
  );
}

const PassIcon = statusIcon("pass");

const ATTENTION = {
  run_failed: {
    icon: statusIcon("fail"),
    color: "var(--status-fail-fg)",
    label: "Run failed",
  },
  run_timed_out: {
    icon: statusIcon("timed_out"),
    color: "var(--status-timed-out-fg)",
    label: "Run timed out",
  },
  scan_failed: {
    icon: ScanSearchIcon,
    color: "var(--status-warning-fg)",
    label: "Scan failed",
  },
  login_expired: {
    icon: KeyRoundIcon,
    color: "var(--status-warning-fg)",
    label: "Sign-in expired",
  },
} as const;

function attentionAction(item: Overview["attention"]["items"][number]): {
  href: Route;
  label: string;
} | null {
  if (isUnrecognised(item.kind)) return null;
  switch (item.kind) {
    case "run_failed":
    case "run_timed_out":
      return { href: `/runs/${item.ref_id}` as Route, label: "Open the run" };
    case "scan_failed":
      return { href: "/targets", label: "Open the target list" };
    case "login_expired":
      return {
        href: `/targets/${item.target_id}/login` as Route,
        label: "Sign in again",
      };
  }
}

function AttentionCard({ data }: { data: Overview }) {
  const { total, items } = data.attention;
  return (
    <Card
      title="Needs attention"
      aside={
        total > items.length ? `Latest ${items.length} of ${total}` : undefined
      }
      testId="attention"
    >
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-(--ink-muted)">
          <ShieldCheckIcon
            aria-hidden="true"
            className="size-4 text-(--status-pass-fg)"
          />
          Nothing needs attention.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => {
            const known = isUnrecognised(item.kind)
              ? null
              : ATTENTION[item.kind];
            const Icon = known?.icon ?? CircleIcon;
            const action = attentionAction(item);
            return (
              <li
                key={`${item.kind}-${item.ref_id}`}
                className="flex gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Icon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                  style={{ color: known?.color ?? "var(--ink-faint)" }}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-semibold">
                      {known?.label ??
                        `Unrecognised: ${isUnrecognised(item.kind) ? item.kind.raw : ""}`}
                    </span>
                    <span
                      className="truncate text-(--ink-muted)"
                      title={item.target_name}
                    >
                      {item.target_name}
                    </span>
                  </p>
                  {/* Untrusted, server-provided text: rendered as text,
                      clamped so a long one can't break the layout. */}
                  <p
                    className="line-clamp-2 break-words text-xs text-(--ink-muted)"
                    title={item.reason}
                  >
                    {item.reason}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 text-xs">
                    <span className="text-(--ink-muted) tabular-nums">
                      {formatDateTime(item.occurred_at)}
                    </span>
                    {action && (
                      <Link href={action.href} className={quietLink}>
                        {action.label}
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/**
 * A workspace with no targets: the KPI area becomes the getting-started
 * path as a checklist. Each "done" comes from the server's own counts.
 */
function NewAccountChecklist({ data }: { data: Overview }) {
  const ranAny = data.runs_by_day.some(
    (d) => d.passed + d.failed + d.timed_out + d.cancelled + d.other > 0,
  );
  const steps: {
    title: string;
    body: string;
    done: boolean;
    href: Route;
    cta: string;
  }[] = [
    {
      title: "Register a target",
      body: "Add the site you want tested and scan it. We only ever load the site; we never ask for its password.",
      done: data.targets.total > 0,
      href: "/targets",
      cta: "Add a site",
    },
    {
      title: "Compose a test",
      body: "Pick a scanned target and describe the check in plain English. Nothing runs until you approve the plan.",
      done: data.targets.scanned > 0,
      href: "/targets",
      cta: "Choose a site",
    },
    {
      title: "Watch it run",
      body: "A real browser performs each approved step. Results appear only when the engine reports them.",
      done: ranAny,
      href: "/runs",
      cta: "Open the run history",
    },
    {
      title: "Share the proof",
      body: "A finished run becomes a proof you can share with a public link.",
      done: data.proofs.live + data.proofs.revoked > 0,
      href: "/runs",
      cta: "Find a finished run",
    },
  ];
  return (
    <section
      aria-label="Getting started"
      data-testid="getting-started"
      className="rounded-xl border border-border bg-card p-5 shadow-card"
    >
      <h2 className="mb-1 text-sm font-semibold">Getting started</h2>
      <p className="mb-4 text-sm text-(--ink-muted)">
        {steps.filter((s) => s.done).length} of {steps.length} done.
      </p>
      <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => (
          <li
            key={s.title}
            data-done={s.done}
            className="flex flex-col gap-2 rounded-lg border border-border bg-(--surface-page) p-4"
          >
            <p className="flex items-center gap-2 text-xs font-semibold tabular-nums">
              {s.done ? (
                <PassIcon
                  aria-hidden="true"
                  className="size-4 text-(--status-pass-fg)"
                />
              ) : (
                <CircleIcon
                  aria-hidden="true"
                  className="size-4 text-(--ink-faint)"
                />
              )}
              {String(i + 1).padStart(2, "0")}
              <span className={s.done ? "text-(--ink)" : "text-(--ink-muted)"}>
                {s.done ? "Done" : "Not done"}
              </span>
            </p>
            <h3 className="text-sm font-semibold">{s.title}</h3>
            <p className="text-xs leading-relaxed text-(--ink-muted)">
              {s.body}
            </p>
            <Link href={s.href} className={`${quietLink} mt-auto`}>
              {s.cta} <ArrowRightIcon className="size-3.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
