import type { z } from "zod";
import type { JobEventSchema, StepSchema } from "@/lib/contract";
import { eventIdValue } from "@/lib/contract";
import type { Tolerated, UnrecognisedValue } from "../tolerant";

// Tolerated<...>: a status this client doesn't know is an
// UnrecognisedValue in the state, not a dropped event (docs/PHASE_B0_5.md
// A1) - the reducer's logic never looks at a status value, so it needs no
// special-casing, only honest types.
export type JobEvent = Tolerated<z.infer<typeof JobEventSchema>>;
export type Step = Tolerated<z.infer<typeof StepSchema>>;

/**
 * The state a job's (scan or run) live event stream accumulates into.
 * Deliberately a plain, serialisable object with no hidden module state -
 * `applyJobEvent` is a pure `(state, event) => state` reducer, so the
 * hostile-sequence tests below can drive it directly with no transport,
 * no timers, and no mocking.
 *
 * docs/PHASE_B.md, B1: "Events are applied to a reducer keyed by step id
 * so that duplicates are idempotent and late arrivals don't overwrite
 * newer state." ("step id" here is `Step.index` - the contract's
 * JobEventSchema has no separate step-id field, just the step's own
 * `index`, which is what a "step" event's target actually is.)
 */
export interface JobEventsState {
  /** Every step seen so far, keyed by its index - not an array, so an
   *  out-of-order arrival doesn't need to know how many steps precede it. */
  steps: Record<string, Step>;
  /** Latest applied job-level status (from a "status" or "done" event), or null before either arrives. */
  status: string | UnrecognisedValue | null;
  progress: { message: string | null; percent: number | null } | null;
  /** Every "log" event applied so far, in the order they were applied (not necessarily arrival order under reordering - see applyJobEvent). */
  logs: {
    id: string;
    level: "info" | "warning" | "error" | UnrecognisedValue;
    message: string;
  }[];
  /** Highest event id ever observed, including from duplicates/late arrivals that didn't otherwise change state - what a reconnect's `?since=` should resume from. */
  lastEventId: string | null;

  // --- bookkeeping, not UI-facing, but kept in state to stay a pure function ---
  /** Every event id ever applied, for exact-duplicate detection regardless of type. */
  appliedIds: ReadonlySet<string>;
  /** Last-applied event id per step index, so a late/out-of-order step update can be told apart from a newer one. */
  stepEventIds: Readonly<Record<string, string>>;
  statusEventId: string | null;
  progressEventId: string | null;
}

export const initialJobEventsState: JobEventsState = {
  steps: {},
  status: null,
  progress: null,
  logs: [],
  lastEventId: null,
  appliedIds: new Set(),
  stepEventIds: {},
  statusEventId: null,
  progressEventId: null,
};

/**
 * Event ids are a numeric monotonic sequence in canonical decimal form
 * (B0.5 B2; docs/API_CONTRACT.md "Event ordering"), so comparison is
 * numeric and total. An id that is not canonical is not an id: it never
 * reaches here from the wire (EventIdSchema rejects the frame, and the
 * hook counts it as unreadable), and if a caller hands one in anyway the
 * event is IGNORED - never treated as newest, which is the fail-open the
 * old comparison had.
 */
function isNewer(candidateId: string, currentId: string | null): boolean {
  const candidate = eventIdValue(candidateId);
  if (candidate === null) return false;
  if (currentId === null) return true;
  const current = eventIdValue(currentId);
  return current === null || candidate > current;
}

export function applyJobEvent(
  state: JobEventsState,
  event: JobEvent,
): JobEventsState {
  // Heartbeats are liveness, not history: no id, not part of the event
  // sequence, no effect on job state. (The hook records their arrival.)
  if (event.type === "heartbeat") return state;
  if (eventIdValue(event.id) === null) return state;

  const lastEventId = isNewer(event.id, state.lastEventId)
    ? event.id
    : state.lastEventId;

  // Exact duplicate: the transport redelivered an event we've already
  // processed (at-least-once delivery after a reconnect, most commonly).
  // A no-op beyond possibly bumping lastEventId, which already happened.
  if (state.appliedIds.has(event.id)) {
    return lastEventId === state.lastEventId
      ? state
      : { ...state, lastEventId };
  }
  const appliedIds = new Set(state.appliedIds);
  appliedIds.add(event.id);
  const base = { ...state, appliedIds, lastEventId };

  switch (event.type) {
    case "step": {
      const stepId = event.step.id;
      if (!isNewer(event.id, state.stepEventIds[stepId] ?? null)) {
        // Shuffled/out-of-order: an older update for a step we've already
        // moved past. Never let it overwrite the newer state we have.
        return base;
      }
      return {
        ...base,
        steps: { ...state.steps, [stepId]: event.step },
        stepEventIds: { ...state.stepEventIds, [stepId]: event.id },
      };
    }

    case "status":
    case "done": {
      if (!isNewer(event.id, state.statusEventId)) return base;
      return { ...base, status: event.status, statusEventId: event.id };
    }

    case "progress": {
      if (!isNewer(event.id, state.progressEventId)) return base;
      return {
        ...base,
        progress: { message: event.message, percent: event.percent },
        progressEventId: event.id,
      };
    }

    case "log":
      // Each log line is its own fact, not a value that supersedes a
      // previous one - append, guarded only by the exact-duplicate check
      // above (already handled before this switch).
      return {
        ...base,
        logs: [
          ...state.logs,
          { id: event.id, level: event.level, message: event.message },
        ],
      };
  }
}

/** Applies a whole sequence in arrival order - the shape a transport actually delivers events in. */
export function applyJobEvents(
  state: JobEventsState,
  events: JobEvent[],
): JobEventsState {
  return events.reduce(applyJobEvent, state);
}
