import type { z } from "zod";
import type { StepSchema } from "@/lib/contract";
import { UnrecognisedValue, type Tolerated } from "@/lib/api/tolerant";

export type Step = Tolerated<z.infer<typeof StepSchema>>;
type Status = string | UnrecognisedValue;

const raw = (s: Status) => (s instanceof UnrecognisedValue ? s.raw : s);

export interface ReconcileInput {
  /** Steps the reducer built from the event stream (any order). */
  streamSteps: Step[];
  streamStatus: Status | null;
  /** The stream delivered `done`. */
  streamFinished: boolean;
  /** `GET /runs/{id}`, or null until it has answered. */
  serverSteps: Step[] | null;
  serverStatus: Status | null;
  /** The server says the run is over (a status we recognise as terminal). */
  serverTerminal: boolean;
  /** The GET we hold was fetched at or after the stream's `done`. */
  serverFetchedAfterFinish: boolean;
}

export interface Reconciled {
  steps: Step[];
  status: Status | null;
  /** Whose word the screen is showing: the live stream's, or the server's. */
  authority: "stream" | "server";
  /** Every place the two disagreed and the server won - stated on screen, never silent. */
  notes: string[];
}

const byIndex = (a: Step, b: Step) => a.index - b.index;

/**
 * docs/API_CONTRACT.md, "Which source is authoritative": `GET /runs/{id}`
 * is the source of truth and the event stream is a delivery mechanism for
 * changes to it. If they ever disagree the fetch wins, and a client
 * reconciles against it when a stream reconnects or delivers `done`.
 *
 * So, while the run is live, the stream is what we show (it is fresher than
 * a poll) - with two rules that stop it ever misleading:
 *   - A `running` step is provisional: if the server already has that step
 *     finished, show the finished one (the stream is behind, not wrong).
 *   - Two DIFFERENT finished states for one step is a real disagreement:
 *     the server's wins, and it is reported.
 * Once the server has spoken after the stream ended (or says the run is
 * over), the screen shows the server's steps and status, full stop. A step
 * only the stream reported, or a state that differs, is dropped in favour
 * of the server's and listed in `notes`.
 *
 * Nothing here computes a verdict or a status: every value returned was
 * sent by the stream or the server.
 */
export function reconcileRun(input: ReconcileInput): Reconciled {
  const {
    streamSteps,
    streamStatus,
    streamFinished,
    serverSteps,
    serverStatus,
    serverTerminal,
    serverFetchedAfterFinish,
  } = input;

  if (serverSteps === null) {
    return {
      steps: [...streamSteps].sort(byIndex),
      status: streamStatus,
      authority: "stream",
      notes: [],
    };
  }

  const server = new Map(serverSteps.map((s) => [s.id, s]));
  const stream = new Map(streamSteps.map((s) => [s.id, s]));
  const settled =
    (streamFinished && serverFetchedAfterFinish) || serverTerminal;

  if (settled) {
    const notes: string[] = [];
    if (streamFinished && serverFetchedAfterFinish) {
      for (const s of streamSteps) {
        const theirs = server.get(s.id);
        if (!theirs) {
          notes.push(
            `Step ${s.index + 1} was reported by the live stream but is not in the server's record; showing the server's.`,
          );
        } else if (raw(theirs.status) !== raw(s.status)) {
          notes.push(
            `Step ${s.index + 1}: the live stream reported "${raw(s.status)}", the server records "${raw(theirs.status)}"; showing the server's.`,
          );
        }
      }
      if (
        streamStatus !== null &&
        serverStatus !== null &&
        raw(streamStatus) !== raw(serverStatus)
      ) {
        notes.push(
          `The live stream ended with "${raw(streamStatus)}", the server records "${raw(serverStatus)}"; showing the server's.`,
        );
      }
    }
    return {
      steps: [...serverSteps].sort(byIndex),
      status: serverStatus,
      authority: "server",
      notes,
    };
  }

  // Live: the stream leads, the server fills gaps and corrects.
  const ids = new Set([...server.keys(), ...stream.keys()]);
  const merged: Step[] = [];
  for (const id of ids) {
    const s = stream.get(id);
    const theirs = server.get(id);
    if (!s) merged.push(theirs!);
    else if (!theirs) merged.push(s);
    else if (raw(s.status) === raw(theirs.status)) merged.push(s);
    else if (raw(s.status) === "running") merged.push(theirs);
    else if (raw(theirs.status) === "running") merged.push(s);
    else merged.push(theirs);
  }
  return {
    steps: merged.sort(byIndex),
    status: streamStatus ?? serverStatus,
    authority: "stream",
    notes: [],
  };
}

/**
 * Fixed-row windowing for a long step list: which rows to render for a
 * scroll position. Pure, so it is tested without a browser.
 */
export function windowFor(input: {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  count: number;
  overscan: number;
}): { start: number; end: number } {
  const { scrollTop, viewportHeight, rowHeight, count, overscan } = input;
  if (count <= 0 || rowHeight <= 0) return { start: 0, end: 0 };
  // A scroll position past the end (a list that just got shorter) is clamped
  // to the last screenful rather than trusted.
  const maxTop = Math.max(0, count * rowHeight - viewportHeight);
  const top = Math.min(Math.max(0, scrollTop), maxTop);
  const first = Math.floor(top / rowHeight);
  const last = Math.ceil((top + viewportHeight) / rowHeight);
  return {
    start: Math.max(0, first - overscan),
    end: Math.min(count, last + overscan),
  };
}
