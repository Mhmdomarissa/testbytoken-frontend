"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { z } from "zod";
import {
  PlanSchema,
  ProofSchema,
  RunDetailSchema,
  ScanSchema,
  TargetSchema,
} from "@/lib/contract";
import { apiPost } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { isUnrecognised, type Tolerated } from "@/lib/api/tolerant";
import { useJobEvents } from "@/lib/api/sse/useJobEvents";
import { DEMO_WORKSPACE_ID } from "@/lib/workspace";
import { useFocusRegionOnChange } from "@/hooks/useFocusRegionOnChange";
import { StatusBadge } from "@/components/status/StatusBadge";
import { toBadgeStatus } from "@/components/status/badgeStatus";
import { RunPassRate } from "@/components/status/RunPassRate";
import { ListSkeleton } from "@/components/state/ListSkeleton";
import { PlanReview } from "@/components/plan/PlanReview";
import { ApprovedPlan } from "@/components/plan/ApprovedPlan";
import { isWrite } from "@/components/plan/reviewState";
import { StepList } from "@/components/run/StepList";
import { LiveStatus, liveState } from "@/components/run/LiveStatus";
import { reconcileRun } from "@/components/run/reconcile";
import { isRunOver, runStatusLabel } from "@/components/run/runStatus";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { usePolled } from "./usePolled";
import { ghostClass } from "./styles";

type Plan = Tolerated<z.infer<typeof PlanSchema>>;
type Run = Tolerated<z.infer<typeof RunDetailSchema>>;

/**
 * The seeded demo target (src/mocks/data.ts). The only target whose scan
 * has a real inventory for the reference planner to ground against - a
 * second "demo target" would get the same checkout steps under another
 * site's name, which is worse than one target and honest scenarios.
 */
const DEMO_TARGET_ID = "tgt_checkout";

/**
 * What the visitor picks is what the demo engine is ASKED to do, never a
 * result: each scenario is a documented intent prefix the mock planner
 * understands (src/mocks/planning.ts), shown to the visitor rather than
 * hidden, and prepended to their own words. What comes back is whatever
 * the mock reports - the page adds nothing.
 */
const SCENARIOS = [
  { id: "normal", label: "Normal run", prefix: "", note: null },
  {
    id: "fail-run",
    label: "Failing step",
    prefix: "fail-run: ",
    note: "Adds “fail-run:” to your request - the demo engine’s cue to fail one step, so you can see how a failure is reported.",
  },
  {
    id: "fail",
    label: "Unplannable",
    prefix: "fail: ",
    note: "Adds “fail:” to your request - the demo planner declines it, so you can see how that is reported.",
  },
] as const;
type ScenarioId = (typeof SCENARIOS)[number]["id"];

const MAX_INTENT = 2000;
const PLAN_POLL_MS = 1_000;
const RUN_POLL_MS = 3_000;

function message(error: unknown): string {
  if (error instanceof ApiError) {
    return error.kind === "network" || error.kind === "timeout"
      ? "The demo engine isn’t reachable right now."
      : error.message;
  }
  return "Something went wrong.";
}

const planMoving = (p: Plan) =>
  isUnrecognised(p.status) || p.status === "generating";
const runMoving = (r: Run) =>
  isUnrecognised(r.status) || r.status === "queued" || r.status === "running";
const never = () => false;

interface DemoState {
  scenario: ScenarioId;
  setScenario: (id: ScenarioId) => void;
  draft: string;
  setDraft: (s: string) => void;
  planId: string | undefined;
  runId: string | undefined;
  busy: boolean;
  actionError: string | null;
  propose: () => void;
  approve: (plan: Plan, stepIds: string[]) => void;
  discard: (plan: Plan) => void;
  startOver: (keepDraft: boolean) => void;
  target: ReturnType<typeof usePolled<typeof TargetSchema>>;
}

const DemoContext = createContext<DemoState | null>(null);

function useDemo(): DemoState {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo outside DemoProvider");
  return ctx;
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<ScenarioId>("normal");
  const [draft, setDraft] = useState("");
  const [planId, setPlanId] = useState<string>();
  const [runId, setRunId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const target = usePolled(
    `/targets/${DEMO_TARGET_ID}`,
    TargetSchema,
    never,
    0,
  );

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(message(e));
    } finally {
      setBusy(false);
    }
  }

  const value: DemoState = {
    scenario,
    setScenario,
    draft,
    setDraft,
    planId,
    runId,
    busy,
    actionError,
    target,
    propose: () =>
      void act(async () => {
        const scan = target.value?.last_scan;
        if (!scan) throw new Error("no scan");
        const prefix = SCENARIOS.find((s) => s.id === scenario)!.prefix;
        const plan = await apiPost("/plans", PlanSchema, {
          workspace_id: DEMO_WORKSPACE_ID,
          target_id: DEMO_TARGET_ID,
          scan_id: scan.id,
          intent: prefix + draft.trim(),
        });
        setPlanId(plan.id);
      }),
    approve: (plan, stepIds) => {
      // Read-only by construction: the demo never asks the engine to run a
      // step that changes state in an application, whatever the planner
      // or the account would allow. An unknown action class counts as a
      // write (isWrite, per the contract).
      const write = plan.steps.find(
        (s) => stepIds.includes(s.id) && isWrite(s),
      );
      if (write) {
        setActionError(
          `The demo only runs steps that read. “${write.description}” would change something in the application, so nothing was run.`,
        );
        return;
      }
      void act(async () => {
        await apiPost(`/plans/${plan.id}/approve`, PlanSchema, {
          step_ids: stepIds,
        });
        const run = await apiPost("/runs", RunDetailSchema, {
          workspace_id: DEMO_WORKSPACE_ID,
          target_id: DEMO_TARGET_ID,
          plan_id: plan.id,
        });
        setRunId(run.id);
      });
    },
    discard: (plan) =>
      void act(async () => {
        await apiPost(`/plans/${plan.id}/discard`, PlanSchema);
        setPlanId(undefined);
      }),
    startOver: (keepDraft) => {
      setPlanId(undefined);
      setRunId(undefined);
      setActionError(null);
      if (!keepDraft) setDraft("");
    },
  };

  return <DemoContext value={value}>{children}</DemoContext>;
}

/** The launcher card in the hero: pick a scenario, describe a test, propose it. */
export function DemoForm() {
  const d = useDemo();
  const prefix = SCENARIOS.find((s) => s.id === d.scenario)!;
  const inFlight = d.planId !== undefined;
  const targetError = d.target.error;
  const ready = d.target.value?.last_scan != null;

  // Starting over unmounts the report region that held focus; move it back
  // here (after the fieldset is re-enabled) rather than letting it fall to
  // <body>. Not on first mount - that would pull the page down to the demo.
  const formRef = useRef<HTMLFieldSetElement>(null);
  const wasInFlight = useRef(inFlight);
  useEffect(() => {
    if (wasInFlight.current && !inFlight) formRef.current?.focus();
    wasInFlight.current = inFlight;
  }, [inFlight]);

  return (
    <div
      id="demo"
      className="border border-border bg-background p-6 sm:p-10"
      data-testid="demo-launcher"
    >
      <Eyebrow className="mb-4">Try the demo</Eyebrow>
      <p
        className="mb-6 text-xs leading-relaxed text-muted-foreground"
        data-testid="demo-disclosure"
      >
        A demonstration: it plans and runs against a sample checkout application
        with simulated results - not your site.
        {d.target.value && (
          <span className="mt-1 block">
            Sample target:{" "}
            <span className="font-mono wrap-anywhere">
              {d.target.value.base_url}
            </span>
          </span>
        )}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          d.propose();
        }}
      >
        <fieldset
          ref={formRef}
          tabIndex={-1}
          disabled={inFlight}
          className="flex flex-col gap-6 outline-none"
        >
          <div>
            <p
              id="demo-scenario-label"
              className="mb-2.5 text-[0.625rem] font-bold tracking-[0.22em] text-muted-foreground uppercase"
            >
              <b className="font-extrabold text-foreground">01</b> — Pick a demo
              scenario
            </p>
            <div
              role="group"
              aria-labelledby="demo-scenario-label"
              className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
            >
              {SCENARIOS.map((s) => {
                const active = s.id === d.scenario;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => d.setScenario(s.id)}
                    className={
                      "min-h-11 border px-3.5 py-2.5 text-[0.625rem] font-bold tracking-[0.14em] uppercase transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring " +
                      (active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground")
                    }
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            {prefix.note && (
              <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                {prefix.note}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="demo-intent"
              className="mb-2.5 block text-[0.625rem] font-bold tracking-[0.22em] text-muted-foreground uppercase"
            >
              <b className="font-extrabold text-foreground">02</b> — What would
              you like to test?
            </label>
            <input
              id="demo-intent"
              type="text"
              value={d.draft}
              onChange={(e) => d.setDraft(e.target.value)}
              maxLength={MAX_INTENT - prefix.prefix.length}
              placeholder="e.g. test all the buttons and make sure all the links work"
              className="h-11 w-full border border-input bg-card px-4 text-sm text-foreground transition-colors duration-150 placeholder:text-[var(--ink-faint)] focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          </div>
          <button
            type="submit"
            disabled={!ready || d.draft.trim() === "" || d.busy}
            className="min-h-12 w-full bg-primary px-6 text-xs font-extrabold tracking-[0.16em] text-primary-foreground uppercase transition-colors duration-150 hover:bg-[color-mix(in_oklch,var(--gold),var(--ink)_18%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {d.busy && !inFlight ? "Asking the planner…" : "Propose a plan"}
          </button>
        </fieldset>
      </form>
      {inFlight && (
        <p className="mt-4 text-xs text-muted-foreground" role="status">
          Your plan is below.{" "}
          <a
            href="#demo-report"
            className="text-foreground underline decoration-primary underline-offset-4"
          >
            Go to it
          </a>
        </p>
      )}
      {targetError != null && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {message(targetError)} The demo can&apos;t start.
        </p>
      )}
      {!inFlight && d.actionError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {d.actionError}
        </p>
      )}
      <p className="mt-5 flex gap-2.5 text-xs leading-relaxed text-muted-foreground">
        Testing behind a login? After sign-up you sign in yourself, in a live
        browser session - your password is never typed here, and never stored.
      </p>
    </div>
  );
}

/** The report section: the plan for review, then the run, exactly as reported. */
export function DemoReport() {
  const d = useDemo();
  const plan = usePolled(
    d.planId === undefined ? undefined : `/plans/${d.planId}`,
    PlanSchema,
    planMoving,
    PLAN_POLL_MS,
    // A proposed plan has stopped polling; re-read it once the run starts
    // so the report shows the approval record, not the proposal.
    d.runId,
  );
  const phase =
    d.planId === undefined
      ? "none"
      : d.runId !== undefined
        ? "run"
        : `plan:${plan.value ? String(plan.value.status) : "loading"}`;
  const focusRef = useFocusRegionOnChange<HTMLElement>(phase);

  if (d.planId === undefined) return null;

  const scanId = d.target.value?.last_scan?.id;

  return (
    <section
      id="demo-report"
      ref={focusRef}
      tabIndex={-1}
      aria-labelledby="demo-report-heading"
      className="scroll-mt-[76px] border-t border-border bg-card px-4 py-16 outline-none sm:px-8 md:py-24"
      data-testid="demo-report"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <Eyebrow centered>Your test report</Eyebrow>
          <h2
            id="demo-report-heading"
            className="font-heading text-3xl leading-tight font-light sm:text-4xl"
          >
            A real browser,{" "}
            <em className="border-b-2 border-primary not-italic">
              showing its work.
            </em>
          </h2>
          <p className="text-xs text-muted-foreground">
            Demonstration - simulated results against a sample application.
          </p>
        </div>
        {d.runId !== undefined && plan.value ? (
          <DemoRun runId={d.runId} plan={plan.value} scanId={scanId} />
        ) : (
          <PlanStage plan={plan.value} error={plan.error} scanId={scanId} />
        )}
      </div>
    </section>
  );
}

function useInventoryElements(scanId: string | undefined): number | null {
  const scan = usePolled(
    scanId === undefined ? undefined : `/scans/${scanId}`,
    ScanSchema,
    never,
    0,
  );
  return scan.value?.modules.reduce((n, m) => n + m.element_count, 0) ?? null;
}

function PlanStage({
  plan,
  error,
  scanId,
}: {
  plan: Plan | null;
  error: unknown;
  scanId: string | undefined;
}) {
  const d = useDemo();
  const inventoryElements = useInventoryElements(scanId);

  if (error != null && plan === null) {
    return (
      <Stuck text={message(error)} onStartOver={() => d.startOver(true)} />
    );
  }
  if (plan === null) return <ListSkeleton rows={4} />;

  const status = plan.status;
  if (isUnrecognised(status)) {
    return (
      <div
        className="flex flex-col items-start gap-3"
        data-testid="plan-unrecognised"
      >
        <StatusBadge status={status} />
        <p className="text-sm">
          The planner reports a state this version of the page doesn&apos;t
          recognise, so nothing more can be done with it here.
        </p>
        <StartOver onClick={() => d.startOver(true)} />
      </div>
    );
  }
  if (status === "generating") {
    return (
      <div
        role="status"
        className="flex flex-col gap-3"
        data-testid="plan-generating"
      >
        <p className="text-sm">
          The planner is turning your request into steps. Nothing is running.
        </p>
        <p className="text-sm break-words text-muted-foreground">
          &ldquo;{plan.intent}&rdquo;
        </p>
        <ListSkeleton rows={3} />
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div
        className="flex flex-col items-start gap-3"
        data-testid="plan-failed"
      >
        <p className="font-medium">The planner couldn&apos;t produce a plan.</p>
        <p className="text-sm break-words">
          {plan.failure?.message ?? "No reason was given."}
        </p>
        <StartOver
          label="Change the request and try again"
          onClick={() => d.startOver(true)}
        />
      </div>
    );
  }
  if (status === "proposed") {
    return (
      <div className="flex flex-col gap-4">
        <PlanReview
          intent={plan.intent}
          steps={plan.steps}
          inventoryElements={inventoryElements}
          busy={d.busy}
          error={d.actionError}
          onApprove={(ids) => d.approve(plan, ids)}
          onDiscard={() => d.discard(plan)}
        />
      </div>
    );
  }
  // discarded, or approved without a run of ours: nothing ran from here.
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm">
        This plan is {status}. Nothing is running from it.
      </p>
      {d.actionError && (
        <p role="alert" className="text-sm text-destructive">
          {d.actionError}
        </p>
      )}
      <StartOver onClick={() => d.startOver(false)} />
    </div>
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

function DemoRun({
  runId,
  plan,
  scanId,
}: {
  runId: string;
  plan: Plan;
  scanId: string | undefined;
}) {
  const d = useDemo();
  const events = useJobEvents(runId);
  // Same reconciliation triggers as the console's run page: re-read the
  // server's record when the stream says `done`, and whenever it reconnects.
  const run = usePolled(
    `/runs/${runId}`,
    RunDetailSchema,
    runMoving,
    RUN_POLL_MS,
    `${events.finished}:${events.reconnectCount}`,
  );
  const server = run.value;
  const proof = usePolled(
    server?.proof_id ? `/proofs/${server.proof_id}` : undefined,
    ProofSchema,
    never,
    0,
  );
  const inventoryElements = useInventoryElements(scanId);
  const now = useNow();

  const serverTerminal = isRunOver(server?.status);
  const reconciled = reconcileRun({
    streamSteps: Object.values(events.steps),
    streamStatus: events.status,
    streamFinished: events.finished,
    serverSteps: server?.steps ?? null,
    serverStatus: server?.status ?? null,
    serverTerminal,
    serverFetchedAfterFinish:
      events.finishedAt !== null && run.fetchedAt >= events.finishedAt,
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

  return (
    <div className="flex flex-col gap-6" data-testid="demo-run">
      <div
        className="flex flex-wrap items-center justify-between gap-3 border border-border border-l-4 border-l-primary bg-background px-5 py-4"
        data-testid="run-summary"
      >
        <div className="flex flex-wrap items-center gap-3">
          {status !== null ? (
            <span
              data-testid="run-status"
              data-status={isUnrecognised(status) ? "unrecognised" : status}
            >
              <StatusBadge
                status={toBadgeStatus(status)}
                variant="filled"
                label={runStatusLabel(status)}
              />
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Waiting for the first report.
            </span>
          )}
          {server ? (
            <RunPassRate
              status={server.status}
              passRate={server.pass_rate}
              coverage={server.coverage}
              pendingText="The pass rate is reported when the run finishes."
            />
          ) : (
            <span className="text-sm text-muted-foreground">
              The pass rate is reported when the run finishes.
            </span>
          )}
        </div>
        <span className="text-[0.625rem] font-bold tracking-[0.2em] text-muted-foreground uppercase">
          Demonstration · simulated
        </span>
      </div>

      {run.error != null && (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t reach the server&apos;s record of this run:{" "}
          {message(run.error)} What is shown is the live stream only.
        </p>
      )}

      <dl className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
        <Meta label="Target">
          {d.target.value ? (
            <span className="break-all font-mono text-xs">
              {d.target.value.base_url}
            </span>
          ) : (
            "-"
          )}
        </Meta>
        <Meta label="Run ID">
          <span className="break-all font-mono text-xs" data-testid="run-id">
            {runId}
          </span>
        </Meta>
        <Meta label="Compute">
          {server ? (
            <span className="tabular-nums">{server.token_cost} tokens</span>
          ) : (
            "-"
          )}
        </Meta>
      </dl>

      <LiveStatus
        live={live}
        reconnects={events.reconnectCount}
        unreadable={events.unreadableFrameCount}
      />

      <div className="flex flex-col gap-2">
        <h3 className="font-heading text-lg font-light">
          {over
            ? `${reconciled.steps.length} ${reconciled.steps.length === 1 ? "step" : "steps"}`
            : `${reconciled.steps.length} ${reconciled.steps.length === 1 ? "step" : "steps"} so far`}
        </h3>
        {reconciled.steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {over
              ? "This run has no steps."
              : "No steps yet. The engine hasn't reported one."}
          </p>
        ) : (
          <StepList steps={reconciled.steps} live={!over} />
        )}
      </div>

      {plan.approval && (
        <div className="flex flex-col gap-3">
          <h3 className="font-heading text-lg font-light">
            What was approved, and what wasn&apos;t
          </h3>
          <p className="text-sm break-words text-muted-foreground">
            &ldquo;{plan.intent}&rdquo;
          </p>
          <ApprovedPlan
            steps={plan.steps}
            inventoryElements={inventoryElements}
            approvedIds={plan.approval.step_ids}
            approvedAt={plan.approval.approved_at}
          />
        </div>
      )}

      {proof.value && (
        <div
          className="border-l-4 border-primary bg-background px-5 py-4"
          data-testid="proof-hash"
        >
          <p className="mb-2 text-[0.5625rem] font-bold tracking-[0.2em] text-muted-foreground uppercase">
            Hash of this record
          </p>
          <p className="font-mono text-xs break-all">{proof.value.hash}</p>
        </div>
      )}

      <div className="flex justify-center pt-4">
        <GhostButton onClick={() => d.startOver(false)}>
          Run another test
        </GhostButton>
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-background px-5 py-4">
      <dt className="mb-1.5 text-[0.5625rem] font-bold tracking-[0.2em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm font-semibold">{children}</dd>
    </div>
  );
}

function Stuck({
  text,
  onStartOver,
}: {
  text: string;
  onStartOver: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p role="alert" className="text-sm text-destructive">
        {text}
      </p>
      <StartOver onClick={onStartOver} />
    </div>
  );
}

function StartOver({
  onClick,
  label = "Start over",
}: {
  onClick: () => void;
  label?: string;
}) {
  return <GhostButton onClick={onClick}>{label}</GhostButton>;
}

function GhostButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={ghostClass}>
      {children}
    </button>
  );
}
