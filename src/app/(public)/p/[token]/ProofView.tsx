"use client";

import { useEffect, useState } from "react";
import { ShieldOffIcon } from "lucide-react";
import { PublicProofSchema } from "@/lib/contract";
import {
  tolerant,
  UnrecognisedValue,
  type Tolerated,
} from "@/lib/api/tolerant";
import { StatusBadge } from "@/components/status/StatusBadge";
import { toBadgeStatus } from "@/components/status/badgeStatus";
import { PassRateCoverage } from "@/components/status/PassRateCoverage";
import { EmptyState } from "@/components/state/EmptyState";
import { runStatusLabel } from "@/components/run/runStatus";
import { StepList } from "@/components/run/StepList";
import { useFocusRegionOnChange } from "@/hooks/useFocusRegionOnChange";
import { UncoveredList } from "./UncoveredList";
import { PlanSummary } from "./PlanSummary";

type PublicProof = Tolerated<import("zod").z.infer<typeof PublicProofSchema>>;

type State =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error"; message: string }
  | { status: "ready"; proof: PublicProof };

/**
 * Fetches and renders `GET /p/{token}` - the whole of what an outsider,
 * possibly on a phone, possibly with no account, sees. Plain `fetch()`, no
 * data layer: this page must not import the console's query hooks or
 * TanStack Query at all (src/app/route-boundary.test.ts fails the build
 * on it), which is also why there's no retry-with-backoff here the way an
 * authenticated screen would have one - a public visitor gets a button.
 *
 * Every field rendered here is one `PublicProofSchema` already promises
 * contains NOTHING from the authenticated world (no run id, no workspace
 * or user id, no share token - docs/API_CONTRACT.md, B10). This component
 * does not add anything beyond what that response carries.
 */
export function ProofView({ token }: { token: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  // Reset during render, not in the effect below, when `token` itself
  // changes - the React-recommended way to "adjust state when a prop
  // changes" without an extra render pass (same pattern as
  // useJobEvents.ts's `trackedJobId`, EngineReport.tsx's `trackedUrl`).
  const [trackedToken, setTrackedToken] = useState(token);
  if (token !== trackedToken) {
    setTrackedToken(token);
    setState({ status: "loading" });
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/p/${token}`)
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setState({ status: "not-found" });
          return;
        }
        if (!res.ok) throw new Error(`Request failed (${res.status}).`);
        const body: unknown = await res.json();
        const proof = tolerant(PublicProofSchema).parse(body) as PublicProof;
        if (!cancelled) setState({ status: "ready", proof });
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: "error",
            message: "Something went wrong loading this proof.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // The console has ShellMain.tsx for the same reason: this page is often
  // reached by a same-tab client-side transition (SharePanel's "View
  // public page" link), not only a fresh cold load - without this, focus
  // drops to <body> exactly like an unhandled route change (Phase B B10).
  const focusRef = useFocusRegionOnChange<HTMLElement>(state.status);

  if (state.status === "loading") {
    return (
      <Shell focusRef={focusRef}>
        <p role="status" className="text-sm text-muted-foreground">
          Loading…
        </p>
      </Shell>
    );
  }

  if (state.status === "not-found") {
    return (
      <Shell focusRef={focusRef}>
        <EmptyState
          icon={ShieldOffIcon}
          title="This link isn't available"
          description="It may be invalid, expired, or the owner may have stopped sharing it."
        />
      </Shell>
    );
  }

  if (state.status === "error") {
    return (
      <Shell focusRef={focusRef}>
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      </Shell>
    );
  }

  const { snapshot } = state.proof;
  const verdict = snapshot.verdict;

  return (
    <Shell focusRef={focusRef}>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Test by Token &middot; auditable proof
          </p>
          <h1
            className="truncate font-heading text-2xl font-light"
            title={snapshot.target.name}
          >
            {snapshot.target.name}
          </h1>
          <p
            className="truncate font-mono text-xs text-muted-foreground"
            title={snapshot.target.base_url}
          >
            {snapshot.target.base_url}
          </p>
        </header>

        <div
          className="flex flex-wrap items-center gap-3"
          data-testid="proof-summary"
        >
          <span
            data-testid="proof-verdict"
            data-status={
              verdict instanceof UnrecognisedValue ? "unrecognised" : verdict
            }
          >
            <StatusBadge
              status={toBadgeStatus(verdict)}
              label={runStatusLabel(verdict)}
            />
          </span>
          <PassRateCoverage
            passRate={snapshot.pass_rate}
            coverage={snapshot.coverage}
          />
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Finished</dt>
            <dd>{new Date(snapshot.finished_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Duration</dt>
            <dd>{formatDuration(snapshot.duration_ms)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Steps</dt>
            <dd>{snapshot.steps.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Not covered</dt>
            <dd data-testid="uncovered-total">{snapshot.uncovered_total}</dd>
          </div>
        </dl>

        {snapshot.plan && <PlanSummary plan={snapshot.plan} />}

        <section className="flex flex-col gap-2" aria-label="Steps">
          <h2 className="font-heading text-lg font-light">
            {snapshot.steps.length}{" "}
            {snapshot.steps.length === 1 ? "step" : "steps"}
          </h2>
          <StepList steps={snapshot.steps} live={false} />
        </section>

        {/* A proof that hides the gaps is not a proof (Phase B B9) - always
            rendered, even when empty, so "nothing uncovered" is a stated
            fact rather than a silently missing section. */}
        <UncoveredList
          uncovered={snapshot.uncovered}
          total={snapshot.uncovered_total}
        />

        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          <p>
            Hash <span className="font-mono">{state.proof.hash}</span>
          </p>
        </footer>
      </div>
    </Shell>
  );
}

function Shell({
  children,
  focusRef,
}: {
  children: React.ReactNode;
  focusRef: React.RefObject<HTMLElement | null>;
}) {
  return (
    <main
      ref={focusRef}
      tabIndex={-1}
      className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 px-6 py-10"
    >
      {children}
    </main>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
