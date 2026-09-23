import { isConnectionDead } from "@/lib/api/sse/useJobEvents";
import type { ConnectionStatus } from "@/lib/api/sse/useJobEvents";

/** No new step for this long, on a healthy connection, is worth saying out loud. */
export const QUIET_AFTER_MS = 8_000;

const secs = (ms: number) => Math.max(0, Math.round(ms / 1000));

export type LiveState =
  | "connecting"
  | "live"
  | "quiet"
  | "stale"
  | "reconnecting"
  | "finished"
  | "stream-unavailable";

/**
 * What the screen must admit about its own liveness (CLAUDE.md: connection
 * loss is a state, not an absence). Pure so every case is unit-tested.
 *
 * The distinction that matters is between a QUIET RUN and a DEAD
 * CONNECTION. The server heartbeats every 15s for as long as a stream is
 * open, so "no step for 12s but a heartbeat 3s ago" is an engine that is
 * thinking (a stalled run looks exactly like this), while "no frame of any
 * kind for over 37s" is a connection that died.
 */
export function liveState(input: {
  connection: ConnectionStatus;
  finished: boolean;
  runOver: boolean;
  now: number;
  lastEventAt: number | null;
  lastFrameAt: number | null;
}): { state: LiveState; text: string } {
  const { connection, finished, runOver, now, lastEventAt, lastFrameAt } =
    input;
  if (finished || runOver) {
    return {
      state: "finished",
      text: "The run has finished. The live stream is closed.",
    };
  }
  if (connection === "reconnecting") {
    return {
      state: "reconnecting",
      text: "The live stream dropped. Reconnecting - what is shown below may be out of date until it is back.",
    };
  }
  if (connection === "closed") {
    return {
      state: "stream-unavailable",
      text: "There is no live stream for this run. What is shown is the server's record, refreshed every few seconds.",
    };
  }
  if (connection === "connecting") {
    return { state: "connecting", text: "Connecting to the live stream…" };
  }
  if (lastEventAt === null) {
    return {
      state: "live",
      text: "Connected. Waiting for the first update from the engine.",
    };
  }
  if (lastFrameAt !== null && isConnectionDead(lastFrameAt, now)) {
    return {
      state: "stale",
      text: `No update and no heartbeat for ${secs(now - lastFrameAt)}s, so this connection may have died. It will reconnect on its own.`,
    };
  }
  const quietFor = now - lastEventAt;
  if (quietFor > QUIET_AFTER_MS) {
    const beat =
      lastFrameAt === null
        ? ""
        : ` The connection is healthy (last message from the server ${secs(now - lastFrameAt)}s ago).`;
    return {
      state: "quiet",
      text: `No new step for ${secs(quietFor)}s. The engine is quiet.${beat}`,
    };
  }
  return { state: "live", text: `Live. Last update ${secs(quietFor)}s ago.` };
}

export function LiveStatus({
  live,
  reconnects,
  unreadable,
}: {
  live: { state: LiveState; text: string };
  reconnects: number;
  unreadable: number;
}) {
  const alarming = live.state === "reconnecting" || live.state === "stale";
  return (
    <div
      data-testid="connection-banner"
      data-state={live.state}
      role={alarming ? "alert" : "status"}
      className={`flex flex-col gap-1 border px-4 py-3 text-sm transition-colors duration-(--duration-base) ${
        alarming ? "border-(--status-warning-chip-fill)" : "border-border"
      }`}
    >
      <p className="flex items-center gap-2.5">
        {/* The stream's own state as a light: breathing only while it is
            connected or connecting, still otherwise. The words carry it. */}
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 ${
            alarming
              ? "bg-(--status-warning-chip-fill)"
              : live.state === "live" || live.state === "connecting"
                ? "breathe-dot bg-(--status-running-chip-fill)"
                : "bg-(--border-strong)"
          }`}
        />
        {live.text}
      </p>
      {reconnects > 0 && (
        <p className="text-xs text-muted-foreground">
          The stream has dropped and reconnected {reconnects}{" "}
          {reconnects === 1 ? "time" : "times"}. It resumes from the last update
          it received, so nothing is skipped or repeated.
        </p>
      )}
      {unreadable > 0 && (
        <p className="text-xs text-muted-foreground">
          {unreadable} {unreadable === 1 ? "update" : "updates"} could not be
          read and {unreadable === 1 ? "is" : "are"} not shown.
        </p>
      )}
    </div>
  );
}
