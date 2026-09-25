"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, ShieldCheckIcon } from "lucide-react";
import { useTarget } from "@/lib/api/queries/targets";
import {
  useCancelLoginSession,
  useCompleteLoginSession,
  useCreateLoginSession,
  useLoginSession,
} from "@/lib/api/queries/loginSessions";
import {
  useContinueScan,
  useCreateScan,
  useScan,
} from "@/lib/api/queries/scans";
import { ApiError } from "@/lib/api/errors";
import { isUnrecognised } from "@/lib/api/tolerant";
import { DEMO_WORKSPACE_ID } from "@/lib/workspace";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorState } from "@/components/state/ErrorState";
import { ListSkeleton } from "@/components/state/ListSkeleton";
import { LoginPanel } from "@/components/login/LoginPanel";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { useEntityCrumb } from "@/components/shell/Breadcrumbs";

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong.";
}

export default function LoginPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<ListSkeleton rows={3} />}>
      <Login params={params} />
    </Suspense>
  );
}

/** `Date.now()`, re-read every second, so a ticket's age can be judged without impure renders. */
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

function Login({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const scanId = searchParams.get("scan");
  const target = useTarget(id);
  useEntityCrumb(target.data?.name);
  const session = useLoginSession(sessionId ?? undefined);
  const now = useNow();

  const create = useCreateLoginSession();
  const complete = useCompleteLoginSession(sessionId ?? "");
  const cancel = useCancelLoginSession(sessionId ?? "");

  const setParams = (next: { session: string | null }) => {
    const qs = new URLSearchParams();
    if (next.session) qs.set("session", next.session);
    if (scanId) qs.set("scan", scanId);
    const s = qs.toString();
    router.replace(`/targets/${id}/login${s ? `?${s}` : ""}`);
  };

  if (target.isPending) return <ListSkeleton rows={3} />;
  if (target.isError) {
    return target.error instanceof ApiError && target.error.status === 404 ? (
      <EmptyState
        icon={ShieldCheckIcon}
        title="Target not found"
        description="It may have been removed."
        action={
          <Link
            href="/targets"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ArrowLeftIcon />
            Back to targets
          </Link>
        }
      />
    ) : (
      <ErrorState
        message={message(target.error)}
        onRetry={() => void target.refetch()}
      />
    );
  }
  const t = target.data;

  const heading = (
    <PageHeader
      back={{ href: "/targets", label: "Targets" }}
      title={`${t.name} - sign in`}
      titleHint={t.name}
      description={
        <p className="truncate" title={t.base_url}>
          {t.base_url}
        </p>
      }
    />
  );

  let body: React.ReactNode;
  if (sessionId === null) {
    body = (
      <div
        data-testid="login-not-started"
        className="flex max-w-2xl flex-col gap-3"
      >
        <p className="text-sm">
          If this application needs a sign-in, you do it yourself: we start a
          live browser, you sign in inside it (MFA and single sign-on included),
          and we capture the session.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>
            This app never asks for, receives or stores your password.
          </strong>{" "}
          You type it into the live browser, not into this page.
        </p>
        {create.isError && (
          <p role="alert" className="text-sm text-destructive">
            {message(create.error)}
          </p>
        )}
        <div>
          <Button
            disabled={create.isPending}
            onClick={() =>
              create.mutate(
                { workspace_id: DEMO_WORKSPACE_ID, target_id: id },
                { onSuccess: (s) => setParams({ session: s.id }) },
              )
            }
          >
            {create.isPending ? "Starting…" : "Start a live browser"}
          </Button>
        </div>
      </div>
    );
  } else if (session.isPending) {
    body = <ListSkeleton rows={3} />;
  } else if (session.isError) {
    body =
      session.error instanceof ApiError && session.error.status === 404 ? (
        <EmptyState
          icon={ShieldCheckIcon}
          title="Sign-in not found"
          description="It may have expired. Start a new one."
          action={
            <Button size="sm" onClick={() => setParams({ session: null })}>
              Start over
            </Button>
          }
        />
      ) : (
        <ErrorState
          message={message(session.error)}
          onRetry={() => void session.refetch()}
        />
      );
  } else {
    const s = session.data;
    body = (
      <LoginPanel
        session={s}
        fetchedAt={session.dataUpdatedAt}
        now={now}
        appOrigin={typeof window === "undefined" ? "" : window.location.origin}
        targetName={t.name}
        busy={complete.isPending || cancel.isPending}
        error={
          complete.isError
            ? message(complete.error)
            : cancel.isError
              ? message(cancel.error)
              : null
        }
        onComplete={() => complete.mutate()}
        onCancel={() => cancel.mutate()}
        onRestart={() => setParams({ session: null })}
      >
        {!isUnrecognised(s.status) && s.status === "completed" && (
          <WhatNext targetId={id} loginSessionId={s.id} scanId={scanId} />
        )}
      </LoginPanel>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {heading}
      {body}
    </div>
  );
}

/** Once signed in: resume the scan that parked waiting for it, or start one that already has the session. */
function WhatNext({
  targetId,
  loginSessionId,
  scanId,
}: {
  targetId: string;
  loginSessionId: string;
  scanId: string | null;
}) {
  const router = useRouter();
  const scan = useScan(scanId ?? undefined);
  const resume = useContinueScan(scanId ?? "");
  const start = useCreateScan();

  const parked =
    scanId !== null &&
    scan.data !== undefined &&
    !isUnrecognised(scan.data.status) &&
    scan.data.status === "parked";
  const pending = resume.isPending || start.isPending;
  const error = resume.isError
    ? resume.error
    : start.isError
      ? start.error
      : null;

  return (
    <div className="flex flex-col gap-2" data-testid="login-next">
      {parked ? (
        <div>
          <Button
            disabled={pending}
            onClick={() =>
              resume.mutate(
                { login_session_id: loginSessionId },
                { onSuccess: () => router.push("/targets") },
              )
            }
          >
            {pending
              ? "Continuing…"
              : "Continue the scan that was waiting for you"}
          </Button>
        </div>
      ) : (
        <div>
          <Button
            disabled={pending}
            onClick={() =>
              start.mutate(
                {
                  workspace_id: DEMO_WORKSPACE_ID,
                  target_id: targetId,
                  login_session_id: loginSessionId,
                },
                { onSuccess: () => router.push("/targets") },
              )
            }
          >
            {pending ? "Starting…" : "Scan with this sign-in"}
          </Button>
        </div>
      )}
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {message(error)}
        </p>
      )}
    </div>
  );
}
