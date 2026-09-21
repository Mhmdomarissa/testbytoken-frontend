"use client";

import { useEffect, useState } from "react";
import { JobEventSchema } from "@/lib/contract";
import { API_BASE_URL } from "../config";
import {
  applyJobEvent,
  initialJobEventsState,
  type JobEvent,
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

export interface UseJobEventsResult extends JobEventsState {
  connectionStatus: ConnectionStatus;
  /** `Date.now()` of the last frame received, or null before the first one. Exposed so a consumer can render its own "no update in Ns" affordance - see the file comment on why this hook does not do that itself. */
  lastEventAt: number | null;
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

  // Reset during render, not in the effect below, when `jobId` itself
  // changes - the React-recommended way to "adjust state when a prop
  // changes" without an extra render pass. A fresh subscription starts
  // from scratch; it never carries over a previous job's steps/status.
  const [trackedJobId, setTrackedJobId] = useState(jobId);
  if (jobId !== trackedJobId) {
    setTrackedJobId(jobId);
    setState(initialJobEventsState);
    setLastEventAt(null);
  }

  useEffect(() => {
    if (jobId === undefined) return;

    let cancelled = false;
    let source: EventSource | undefined;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let lastEventId: string | null = null;

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
        setConnectionStatus("open");
      };

      source.onmessage = (message: MessageEvent<string>) => {
        if (cancelled) return;
        let event: JobEvent;
        try {
          event = JobEventSchema.parse(JSON.parse(message.data));
        } catch (err) {
          // A malformed frame is our contract drifting from what the
          // server actually sent, not a connection problem - loud in
          // dev, dropped (not crashed) in production.
          if (process.env.NODE_ENV !== "production") {
            console.error(
              "[useJobEvents] Malformed SSE frame, dropped:",
              message.data,
              err,
            );
          }
          return;
        }
        lastEventId = event.id;
        setLastEventAt(Date.now());
        setState((prev) => applyJobEvent(prev, event));
      };

      // Fires on a real transport failure (connection refused, dropped,
      // non-2xx on (re)connect) - never on a merely quiet stream, which
      // is exactly the distinction this hook relies on. See file comment.
      source.onerror = () => {
        if (cancelled) return;
        source?.close();
        const delay = backoffDelay(attempt);
        attempt += 1;
        setConnectionStatus("reconnecting");
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      source?.close();
      if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
    };
  }, [jobId]);

  // No job id means nothing to connect to - "closed" is a derived fact
  // about that, not a transition the EventSource lifecycle ever produces.
  return {
    ...state,
    connectionStatus: jobId === undefined ? "closed" : connectionStatus,
    lastEventAt,
  };
}
