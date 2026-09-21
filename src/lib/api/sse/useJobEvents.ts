"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/contract";
import { parseJobEventFrame } from "./parseFrame";
import {
  applyJobEvent,
  initialJobEventsState,
  type JobEventsState,
} from "./jobEventsReducer";

export type ConnectionStatus =
  "connecting" | "open" | "reconnecting" | "closed";

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

/** Exponential backoff with full jitter, capped - avoids every open tab hammering the server in lockstep after a shared outage. */
function backoffDelay(attempt: number): number {
  return (
    Math.random() * Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS)
  );
}

/** A connection that has produced no frame of ANY kind for this many heartbeat intervals is dead, not quiet. */
export const DEAD_AFTER_HEARTBEAT_INTERVALS = 2.5;

/**
 * B0.5 B3: with a heartbeat every 15s (docs/API_CONTRACT.md), "nothing has
 * happened for 30s" and "the connection died" are different, checkable
 * facts. A quiet JOB still produces heartbeats; a dead CONNECTION produces
 * nothing. Pure, so it is unit-tested without a browser.
 */
export function isConnectionDead(
  lastFrameAt: number,
  now: number,
  intervalMs: number = HEARTBEAT_INTERVAL_MS,
): boolean {
  return now - lastFrameAt > DEAD_AFTER_HEARTBEAT_INTERVALS * intervalMs;
}

export interface UseJobEventsResult extends JobEventsState {
  connectionStatus: ConnectionStatus;
  /** `Date.now()` of the last frame received, or null before the first one. Exposed so a consumer can render its own "no update in Ns" affordance - see the file comment on why this hook does not do that itself. */
  lastEventAt: number | null;
  /**
   * `Date.now()` of the last frame of ANY kind, heartbeats included, or
   * null before the first. The difference from `lastEventAt` is the whole
   * point of the heartbeat: a job that has been quiet for a minute but is
   * still heartbeating is ALIVE and quiet (show "no news for 60s"); a
   * stream whose `lastFrameAt` is old is dead (this hook reconnects it, and
   * says so via `connectionStatus`).
   */
  lastFrameAt: number | null;
  /**
   * Frames received but structurally unusable (not JSON, unknown event
   * type). Never silent: a consumer shows "N updates could not be read"
   * so a missing step can't pass for a step that never happened.
   * Unfamiliar status VALUES are not counted here - they parse and
   * render as unrecognised.
   */
  unreadableFrameCount: number;
  /**
   * True once the server has sent `done` - the stream is closed on purpose
   * and nothing more will arrive. `finishedAt` is `Date.now()` then, so a
   * consumer can tell whether a fetch it made afterwards is later than the
   * end of the stream (docs/API_CONTRACT.md: reconcile against GET on
   * `done`).
   */
  finished: boolean;
  finishedAt: number | null;
  /** How many times the connection dropped and was re-established - a dropped stream is visible data, not something a consumer has to infer from `connectionStatus` flickering. */
  reconnectCount: number;
}

/**
 * Subscribes to `GET /jobs/{id}/events` (docs/API_CONTRACT.md) for a scan
 * or run id and folds every frame through the pure reducer in
 * jobEventsReducer.ts. This is "the hard part" docs/PHASE_B.md's B1 calls
 * out by name. Handles:
 *
 * - **Reconnection with backoff.** Exponential + full jitter, capped at
 *   30s, reset to the first (1s) step on any successful reconnect.
 * - **Resuming from the last received event id.** `?since=` is sent
 *   explicitly on every (re)connection, rather than relying on
 *   `EventSource`'s native `Last-Event-ID` header - some proxies and load
 *   balancers strip custom request headers on a reconnect, but a query
 *   parameter always survives.
 * - **Out-of-order arrival and duplicate events.** Handled entirely by
 *   the reducer (jobEventsReducer.ts), not here - this hook's only job is
 *   to feed it every frame in whatever order they actually arrive.
 * - **A stream that goes quiet without closing.** Deliberately NOT
 *   treated as a failure by this hook. A legitimately slow/stalled run
 *   (Phase A's `LIVE_STALL_TIMELINE` goes quiet for a real 15s before
 *   resolving) looks, from here, identical to a connection that died
 *   without ever firing `onerror` - there is no way to tell them apart
 *   without a server-sent heartbeat, which this contract doesn't define
 *   yet (flagged in the B1 report as a contract gap worth considering).
 *   Forcing a reconnect on an idle timer would misrepresent a healthy,
 *   quiet run as a connection problem - exactly the "connection loss is
 *   a state, not an absence" rule (docs/PHASE_B.md, §1.1) this hook
 *   exists to uphold, not violate. Instead, `lastEventAt` is exposed so a
 *   consumer (B7) can show its own "no update in Ns" affordance without
 *   this hook silently reconnecting a stream that isn't actually broken.
 */
export function useJobEvents(jobId: string | undefined): UseJobEventsResult {
  const [state, setState] = useState<JobEventsState>(initialJobEventsState);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [lastFrameAt, setLastFrameAt] = useState<number | null>(null);
  const [unreadableFrameCount, setUnreadableFrameCount] = useState(0);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  // Reset during render, not in the effect below, when `jobId` itself
  // changes - the React-recommended way to "adjust state when a prop
  // changes" without an extra render pass. A fresh subscription starts
  // from scratch; it never carries over a previous job's steps/status.
  const [trackedJobId, setTrackedJobId] = useState(jobId);
  if (jobId !== trackedJobId) {
    setTrackedJobId(jobId);
    setState(initialJobEventsState);
    setLastEventAt(null);
    setLastFrameAt(null);
    setUnreadableFrameCount(0);
    setReconnectCount(0);
    setFinishedAt(null);
  }

  useEffect(() => {
    if (jobId === undefined) return;

    let cancelled = false;
    let source: EventSource | undefined;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let lastEventId: string | null = null;
    // Set by a `done` event. The server closes the stream right after it,
    // which the browser reports as an error indistinguishable from a
    // dropped connection - without this, a FINISHED job reconnects forever
    // and the UI shows "reconnecting" on a completed run (found by running
    // this hook in a real browser: e2e/job-events.spec.ts).
    let finished = false;
    // Last frame of any kind, tracked locally too: the watchdog runs on a
    // timer, outside React's render cycle.
    let lastFrameLocal = Date.now();

    function connect() {
      if (cancelled) return;
      setConnectionStatus(attempt === 0 ? "connecting" : "reconnecting");

      const since = lastEventId
        ? `?since=${encodeURIComponent(lastEventId)}`
        : "";
      source = new EventSource(`${API_BASE_URL}/jobs/${jobId}/events${since}`, {
        withCredentials: true,
      });

      source.onopen = () => {
        if (cancelled) return;
        attempt = 0;
        lastFrameLocal = Date.now(); // a connection that opens and then says nothing is caught too
        setConnectionStatus("open");
      };

      source.onmessage = (message: MessageEvent<string>) => {
        if (cancelled) return;
        const frame = parseJobEventFrame(message.data);
        if (!frame.ok) {
          if (process.env.NODE_ENV !== "production") {
            console.error(
              `[useJobEvents] Unreadable SSE frame (${frame.reason}):`,
              frame.raw,
            );
          }
          setUnreadableFrameCount((n) => n + 1);
          return;
        }
        const { event } = frame;
        lastFrameLocal = Date.now();
        setLastFrameAt(lastFrameLocal);
        // A heartbeat proves the connection is alive and nothing else: it
        // has no id, is not part of the event sequence, and must not move
        // `lastEventId` (which `?since=` resumes from).
        if (event.type === "heartbeat") return;
        lastEventId = event.id;
        setLastEventAt(lastFrameLocal);
        setState((prev) => applyJobEvent(prev, event));
        if (event.type === "done") {
          finished = true;
          setFinishedAt(Date.now());
          source?.close();
          setConnectionStatus("closed");
        }
      };

      // Fires on a real transport failure (connection refused, dropped,
      // non-2xx on (re)connect) - never on a merely quiet stream, which
      // is exactly the distinction this hook relies on. See file comment.
      source.onerror = handleDrop;
    }

    function handleDrop() {
      if (cancelled || finished) return;
      source?.close();
      const delay = backoffDelay(attempt);
      attempt += 1;
      setConnectionStatus("reconnecting");
      setReconnectCount((n) => n + 1);
      reconnectTimer = setTimeout(connect, delay);
    }

    connect();

    // Dead-connection watchdog (B0.5 B3). Only ever fires on missing
    // HEARTBEATS, never on a merely quiet job - the server guarantees a
    // frame every 15s for as long as the stream is open.
    const watchdog = setInterval(() => {
      if (cancelled || finished || reconnectTimer !== undefined) return;
      if (
        source?.readyState === EventSource.OPEN &&
        isConnectionDead(lastFrameLocal, Date.now())
      ) {
        handleDrop();
      }
    }, 5_000);

    return () => {
      cancelled = true;
      source?.close();
      if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
      clearInterval(watchdog);
    };
  }, [jobId]);

  // No job id means nothing to connect to - "closed" is a derived fact
  // about that, not a transition the EventSource lifecycle ever produces.
  return {
    ...state,
    connectionStatus: jobId === undefined ? "closed" : connectionStatus,
    lastEventAt,
    lastFrameAt,
    unreadableFrameCount,
    finished: finishedAt !== null,
    finishedAt,
    reconnectCount,
  };
}
