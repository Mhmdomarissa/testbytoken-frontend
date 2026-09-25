"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, ScanSearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTarget } from "@/lib/api/queries/targets";
import {
  useApprovePlan,
  useCreatePlan,
  useDiscardPlan,
  usePlan,
} from "@/lib/api/queries/plans";
import { useCreateRun } from "@/lib/api/queries/runs";
import { useScan } from "@/lib/api/queries/scans";
import { ApiError } from "@/lib/api/errors";
import { isUnrecognised } from "@/lib/api/tolerant";
import { DEMO_WORKSPACE_ID } from "@/lib/workspace";
import { useFocusRegionOnChange } from "@/hooks/useFocusRegionOnChange";
import { StatusBadge } from "@/components/status/StatusBadge";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorState } from "@/components/state/ErrorState";
import { ListSkeleton } from "@/components/state/ListSkeleton";
import { ApprovedPlan } from "@/components/plan/ApprovedPlan";
import { PlanReview } from "@/components/plan/PlanReview";
import { PlanSkeleton } from "@/components/plan/PlanSkeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/PageHeader";
import { useEntityCrumb } from "@/components/shell/Breadcrumbs";

const MAX_INTENT = 2000;

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong.";
}

export default function ComposePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      <Compose params={params} />
    </Suspense>
  );
}

function BackToTargets() {
  return (
    <Link
      href="/targets"
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      <ArrowLeftIcon />
      Back to targets
    </Link>
  );
}

function Compose({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan");
  const target = useTarget(id);
  useEntityCrumb(target.data?.name);
  const plan = usePlan(planId ?? undefined);
  // How big the inventory was that the plan was grounded against - null until known.
  const scan = useScan(plan.data?.scan_id);
  const inventoryElements =
    scan.data?.modules.reduce((n, m) => n + m.element_count, 0) ?? null;
  const [draft, setDraft] = useState("");

  const createPlan = useCreatePlan();
  const approve = useApprovePlan(planId ?? "");
  const discard = useDiscardPlan(planId ?? "");
  const createRun = useCreateRun();

  const setPlanParam = (next: string | null) =>
    router.replace(
      next === null
        ? `/targets/${id}/compose`
        : `/targets/${id}/compose?plan=${next}`,
    );

  // The form, or the plan's status, gets replaced wholesale as things
  // progress (propose -> proposed -> approved) - the button that triggered
  // each swap is gone once it happens, so without this the browser drops
  // focus to <body> (Phase B B10 - the same class of bug ShellMain.tsx
  // fixes for a route change, here for an in-place one instead).
  const composePhase =
    planId === null
      ? "form"
      : `plan:${plan.isPending ? "loading" : plan.isError ? "error" : String(plan.data?.status)}`;
  const focusRef = useFocusRegionOnChange<HTMLDivElement>(composePhase);

  if (target.isPending) return <ListSkeleton rows={3} />;
  if (target.isError) {
    return target.error instanceof ApiError && target.error.status === 404 ? (
      <EmptyState
        icon={ScanSearchIcon}
        title="Target not found"
        description="It may have been removed."
        action={<BackToTargets />}
      />
    ) : (
      <ErrorState
        message={message(target.error)}
        onRetry={() => void target.refetch()}
      />
    );
  }

  const t = target.data;
  const lastScan = t.last_scan;

  function startRun(forPlanId: string) {
    createRun.mutate({
      workspace_id: DEMO_WORKSPACE_ID,
      target_id: id,
      plan_id: forPlanId,
    });
  }

  const heading = (
    <PageHeader
      back={{ href: "/targets", label: "Targets" }}
      title={`${t.name} - compose a test`}
      titleHint={t.name}
      description={
        <p className="truncate" title={t.base_url}>
          {t.base_url}
        </p>
      }
    />
  );

  // No plan yet: the compose form - which needs a finished scan to ground against.
  if (planId === null) {
    const scanReady =
      lastScan !== null &&
      !isUnrecognised(lastScan.status) &&
      lastScan.status === "completed";
    return (
      <div ref={focusRef} tabIndex={-1} className="flex flex-col gap-6">
        {heading}
        {!scanReady ? (
          <EmptyState
            icon={ScanSearchIcon}
            title="Scan this target first"
            description="A plan is grounded against what a scan found. Once a scan has completed you can describe a test here."
            action={<BackToTargets />}
          />
        ) : (
          <form
            className="arrive flex max-w-2xl flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              createPlan.mutate(
                {
                  workspace_id: DEMO_WORKSPACE_ID,
                  target_id: id,
                  scan_id: lastScan.id,
                  intent: draft.trim(),
                },
                { onSuccess: (p) => setPlanParam(p.id) },
              );
            }}
          >
            <label htmlFor="intent" className="font-heading text-xl font-light">
              What do you want to test?
            </label>
            <Textarea
              id="intent"
              className="glow-focus text-sm leading-relaxed"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_INTENT}
              rows={4}
              placeholder="e.g. Add an item to the cart and check the total updates"
            />
            <p className="text-sm text-muted-foreground">
              Describe it in plain English. We&apos;ll propose the steps for you
              to review - <strong>nothing runs until you approve.</strong>
            </p>
            {createPlan.isError && (
              <p role="alert" className="text-sm text-destructive">
                {message(createPlan.error)}
              </p>
            )}
            <div>
              <Button
                type="submit"
                className="glow-hover glow-focus"
                disabled={draft.trim() === "" || createPlan.isPending}
              >
                {createPlan.isPending
                  ? "Asking the planner…"
                  : "Propose a plan"}
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // A plan exists: show exactly the state the server reported.
  let body: React.ReactNode;
  if (plan.isPending) {
    body = <PlanSkeleton rows={4} />;
  } else if (plan.isError) {
    body =
      plan.error instanceof ApiError && plan.error.status === 404 ? (
        <EmptyState
          icon={ScanSearchIcon}
          title="Plan not found"
          description="It may have expired. Compose a new one."
          action={
            <Button size="sm" onClick={() => setPlanParam(null)}>
              Compose a new test
            </Button>
          }
        />
      ) : (
        <ErrorState
          message={message(plan.error)}
          onRetry={() => void plan.refetch()}
        />
      );
  } else {
    const p = plan.data;
    const status = p.status;
    if (isUnrecognised(status)) {
      body = (
        <div
          className="flex flex-col items-start gap-3"
          data-testid="plan-unrecognised"
        >
          <StatusBadge status={status} />
          <p className="text-sm">
            This plan is in a state this version of the app doesn&apos;t
            recognise, so nothing can be done with it here.
          </p>
        </div>
      );
    } else if (status === "generating") {
      body = (
        <div
          role="status"
          data-testid="plan-generating"
          className="flex max-w-2xl flex-col gap-3"
        >
          <p className="text-sm">
            The planner is turning your request into steps. Nothing is running.
          </p>
          <p className="break-words text-sm text-muted-foreground">
            &ldquo;{p.intent}&rdquo;
          </p>
          <PlanSkeleton />
        </div>
      );
    } else if (status === "failed") {
      body = (
        <div
          className="flex max-w-2xl flex-col gap-3"
          data-testid="plan-failed"
        >
          <p className="font-medium">
            The planner couldn&apos;t produce a plan.
          </p>
          <p className="break-words text-sm">
            {p.failure?.message ?? "No reason was given."}
          </p>
          <div>
            <Button
              onClick={() => {
                setDraft(p.intent);
                setPlanParam(null);
              }}
            >
              Change the request and try again
            </Button>
          </div>
        </div>
      );
    } else if (status === "discarded") {
      body = (
        <div
          className="flex max-w-2xl flex-col gap-3"
          data-testid="plan-discarded"
        >
          <p className="font-medium">This plan was discarded.</p>
          <p className="text-sm text-muted-foreground">Nothing ran.</p>
          <div>
            <Button onClick={() => setPlanParam(null)}>
              Compose a new test
            </Button>
          </div>
        </div>
      );
    } else if (status === "approved" && p.approval) {
      body = (
        <div className="flex flex-col gap-4">
          <p
            data-testid="plan-intent"
            className="font-heading text-2xl leading-tight font-light break-words sm:text-3xl"
          >
            {p.intent}
          </p>
          <ApprovedPlan
            steps={p.steps}
            inventoryElements={inventoryElements}
            approvedIds={p.approval.step_ids}
            approvedAt={p.approval.approved_at}
          />
          {createRun.isSuccess && (
            <div
              role="status"
              data-testid="run-started"
              className="arrive relative flex flex-col gap-5 border border-border bg-card py-6 pr-6 pl-8 sm:flex-row sm:items-center sm:justify-between"
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-0.75 bg-primary"
              />
              {/* The payoff of the whole compose flow, so it reads as the
                  primary moment - but it says only what the server said
                  (a run was created, with this id), never how it's going. */}
              <div className="flex min-w-0 flex-col gap-1.5">
                <p className="font-heading text-2xl leading-tight font-light">
                  Run started
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-mono break-all text-foreground">
                    {createRun.data.id}
                  </span>
                  . Results appear only when the engine reports them.
                </p>
              </div>
              <Link
                href={`/runs/${createRun.data.id}`}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "shrink-0 self-start px-5 sm:self-auto",
                )}
              >
                Watch this run
                <ArrowRightIcon aria-hidden="true" />
              </Link>
            </div>
          )}
          {createRun.isError && (
            <p role="alert" className="text-sm text-destructive">
              The plan is approved, but the run couldn&apos;t start:{" "}
              {message(createRun.error)}
            </p>
          )}
          {!createRun.isSuccess && (
            <div>
              <Button
                disabled={createRun.isPending}
                onClick={() => startRun(p.id)}
              >
                {createRun.isPending ? "Starting…" : "Start a run of this plan"}
              </Button>
            </div>
          )}
        </div>
      );
    } else {
      // "proposed" - and the impossible "approved without approval", which
      // is shown as what it is rather than guessed at.
      body =
        status === "proposed" ? (
          <PlanReview
            intent={p.intent}
            steps={p.steps}
            inventoryElements={inventoryElements}
            busy={approve.isPending || createRun.isPending || discard.isPending}
            error={
              approve.isError
                ? message(approve.error)
                : discard.isError
                  ? message(discard.error)
                  : null
            }
            onApprove={(stepIds) =>
              approve.mutate(
                { step_ids: stepIds },
                { onSuccess: (approved) => startRun(approved.id) },
              )
            }
            onDiscard={() =>
              discard.mutate(undefined, { onSuccess: () => setPlanParam(null) })
            }
          />
        ) : (
          <ErrorState
            title="This plan is inconsistent"
            message="The server reports it approved but sent no approval record, so it can't be shown or run."
            onRetry={() => void plan.refetch()}
          />
        );
    }
  }

  return (
    <div ref={focusRef} tabIndex={-1} className="flex flex-col gap-6">
      {heading}
      {body}
    </div>
  );
}
