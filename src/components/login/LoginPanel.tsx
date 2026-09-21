"use client";

import type { z } from "zod";
import { ExternalLinkIcon } from "lucide-react";
import type { LoginSessionSchema } from "@/lib/contract";
import { StatusBadge } from "@/components/status/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  UnrecognisedValue,
  truncateRaw,
  type Tolerated,
} from "@/lib/api/tolerant";
import { loginFailureCopy } from "./failureCopy";
import { checkViewUrl, ticketIsFresh } from "./viewUrl";

export type LoginSession = Tolerated<z.infer<typeof LoginSessionSchema>>;

const formatWhen = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * One panel, one job: say exactly which state the server reported the
 * sign-in is in, and offer only what that state allows. There is no input
 * of any kind in here - the customer signs in inside the live browser, not
 * in this app, so nothing on this screen can receive a credential.
 *
 * The live-browser link is treated as what it is: a short-lived,
 * single-use ticket on another origin. It is opened in a new tab with no
 * opener and no referrer, never shown as text (so it can't be copied into
 * a ticket or a screenshot), only offered while the reading it came from is
 * fresh, and refused outright if it isn't https on a different origin.
 */
export function LoginPanel({
  session,
  fetchedAt,
  now,
  appOrigin,
  targetName,
  busy,
  error,
  onComplete,
  onCancel,
  onRestart,
  children,
}: {
  session: LoginSession;
  /** `Date.now()` when `session` was read - the age of its ticket. */
  fetchedAt: number;
  now: number;
  appOrigin: string;
  targetName: string;
  busy: boolean;
  error: string | null;
  onComplete: () => void;
  onCancel: () => void;
  onRestart: () => void;
  /** What to offer once signed in (continue a scan, start one). */
  children?: React.ReactNode;
}) {
  const status = session.status;
  const expires = formatWhen.format(new Date(session.expires_at));

  if (status instanceof UnrecognisedValue) {
    return (
      <Shell
        status={<StatusBadge status={status} />}
        testId="login-unrecognised"
      >
        <p className="text-sm">
          The server reports this sign-in as &ldquo;{truncateRaw(status.raw)}
          &rdquo;, a state this version of the app doesn&apos;t recognise, so
          nothing can be done with it here.
        </p>
        <div>
          <Button variant="outline" onClick={() => onRestart()}>
            Start over
          </Button>
        </div>
      </Shell>
    );
  }

  if (status === "provisioning") {
    return (
      <Shell testId="login-provisioning">
        <p role="status" className="text-sm">
          Starting a browser for you&hellip;
        </p>
        <Actions>
          <Button variant="ghost" onClick={() => onCancel()} disabled={busy}>
            Cancel
          </Button>
        </Actions>
      </Shell>
    );
  }

  if (status === "ready" || status === "in_progress") {
    const view = checkViewUrl(session.view_url, appOrigin);
    const fresh = ticketIsFresh(fetchedAt, now);
    return (
      <Shell testId={`login-${status}`}>
        <p className="text-sm" role="status">
          {status === "ready"
            ? `Your browser is ready. Open it and sign in to ${targetName} yourself - MFA and single sign-on included - then come back and tell us you're done.`
            : "You're connected. Finish signing in in the browser, then tell us you're done."}
        </p>
        <p className="text-xs text-muted-foreground">
          You type your details into that browser, never into this app. This app
          doesn&apos;t receive your credentials. Sign in before {expires}.
        </p>

        {view.ok ? (
          fresh ? (
            <div className="flex flex-col gap-1">
              <a
                data-testid="open-browser"
                href={view.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${buttonVariants({
                  variant: status === "ready" ? "default" : "outline",
                })} w-fit`}
              >
                <ExternalLinkIcon />
                {status === "ready"
                  ? "Open the browser"
                  : "Open the browser again"}
              </a>
              <span className="text-xs text-muted-foreground">
                Opens {view.host} in a new tab.
              </span>
            </div>
          ) : (
            <Button variant="outline" disabled>
              Refreshing the link&hellip;
            </Button>
          )
        ) : (
          <p
            role="alert"
            data-testid="unsafe-view-url"
            className="text-sm text-destructive"
          >
            {view.reason === "missing"
              ? "The server didn't send a link to the browser."
              : `The link the server sent isn't safe to open (${view.reason.replace("_", " ")}). Nothing was opened.`}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Actions>
          <Button
            variant={status === "in_progress" ? "default" : "outline"}
            onClick={() => onComplete()}
            disabled={busy}
          >
            {busy ? "Checking…" : "I've finished signing in"}
          </Button>
          <Button variant="ghost" onClick={() => onCancel()} disabled={busy}>
            Cancel
          </Button>
        </Actions>
      </Shell>
    );
  }

  if (status === "completed") {
    return (
      <Shell
        status={<StatusBadge status="pass" label="Signed in" />}
        testId="login-completed"
      >
        <p role="status" className="text-sm">
          Signed in. We captured your session; scans and runs can use it until{" "}
          {expires}.
        </p>
        <p className="text-xs text-muted-foreground">
          Only an opaque reference to it is kept here - never the session
          itself.
        </p>
        {children}
      </Shell>
    );
  }

  if (status === "failed") {
    const failure = session.failure;
    const copy = loginFailureCopy(failure?.kind ?? "internal");
    return (
      <Shell
        status={<StatusBadge status="fail" label="Failed" />}
        testId="login-failed"
      >
        <p className="font-medium">{copy.title}</p>
        {failure && failure.kind instanceof UnrecognisedValue && (
          <p className="font-mono text-xs text-muted-foreground">
            kind: {truncateRaw(failure.kind.raw)}
          </p>
        )}
        {failure && (
          <p className="break-words text-sm text-muted-foreground">
            {failure.message}
          </p>
        )}
        <p className="text-sm">{copy.guidance}</p>
        <div>
          <Button onClick={() => onRestart()}>Try again</Button>
        </div>
      </Shell>
    );
  }

  if (status === "expired") {
    return (
      <Shell
        status={<StatusBadge status="timed_out" label="Expired" />}
        testId="login-expired"
      >
        <p className="text-sm">
          This sign-in ran out of time before it was finished. Nothing was
          captured.
        </p>
        <div>
          <Button onClick={() => onRestart()}>Start over</Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      status={<StatusBadge status="skipped" label="Cancelled" />}
      testId="login-cancelled"
    >
      <p className="text-sm">Cancelled. Nothing was captured.</p>
      <div>
        <Button onClick={() => onRestart()}>Start over</Button>
      </div>
    </Shell>
  );
}

function Shell({
  status,
  testId,
  children,
}: {
  status?: React.ReactNode;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className="flex max-w-2xl flex-col gap-3 border border-border p-4"
    >
      {status}
      {children}
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}
