import { describe, expect, it } from "vitest";
import {
  applyJobEvent,
  applyJobEvents,
  initialJobEventsState,
  type JobEvent,
  type Step,
} from "./jobEventsReducer";

/**
 * docs/PHASE_B.md, B1: "Write unit tests for the reducer against a
 * deliberately hostile event sequence - shuffled, duplicated, gapped."
 *
 * The core property under test throughout: for a given SET of events, the
 * final state must be the same no matter what order they actually arrive
 * in, how many times any of them is redelivered, or which of them are
 * temporarily missing - because a real transport (reconnects, at-least-once
 * delivery, network reordering) can produce any of that, and the UI must
 * never show something wrong because of *when* bytes happened to arrive.
 */

function step(index: number, overrides: Partial<Step> = {}): Step {
  return {
    id: `stp_${index}`,
    plan_step_id: null,
    index,
    action: "click",
    target: `#step-${index}`,
    assertion: null,
    status: "pass",
    message: "OK",
    duration_ms: 100,
    screenshot_url: null,
    ...overrides,
  };
}

// A realistic mixed-type sequence: status -> two passing steps -> progress
// -> a log line -> a failing step -> a REVISED step 1 (same index, higher
// id - e.g. the engine retried it) -> done. Chosen to exercise every
// event type and, with ev6, prove "newer wins" is about event id, not
// first-write-wins.
const ev0: JobEvent = { id: "0", type: "status", status: "running" };
const ev1: JobEvent = { id: "1", type: "step", step: step(0) };
const ev2: JobEvent = {
  id: "2",
  type: "progress",
  message: "navigating",
  percent: 10,
};
const ev3: JobEvent = { id: "3", type: "step", step: step(1) };
const ev4: JobEvent = {
  id: "4",
  type: "log",
  level: "info",
  message: "cookie banner dismissed",
};
const ev5: JobEvent = {
  id: "5",
  type: "step",
  step: step(2, { status: "fail", message: "assertion failed" }),
};
const ev6: JobEvent = {
  id: "6",
  type: "step",
  step: step(1, { message: "retried and passed on second attempt" }),
};
const ev7: JobEvent = { id: "7", type: "done", status: "failed" };

const ALL_EVENTS = [ev0, ev1, ev2, ev3, ev4, ev5, ev6, ev7];

function expectConvergedState(state: ReturnType<typeof applyJobEvents>) {
  expect(state.status).toBe("failed");
  expect(state.progress).toEqual({ message: "navigating", percent: 10 });
  expect(state.logs).toHaveLength(1);
  expect(state.logs[0]?.message).toBe("cookie banner dismissed");
  expect(state.lastEventId).toBe("7");
  expect(Object.keys(state.steps)).toHaveLength(3);
  expect(state.steps.stp_0?.status).toBe("pass");
  // The REVISION (ev6, higher id) must win over the original (ev3) for
  // the same step index - this is "newer wins", not "last write wins" by
  // arrival order, which the shuffled tests below specifically stress.
  expect(state.steps.stp_1?.message).toBe(
    "retried and passed on second attempt",
  );
  expect(state.steps.stp_2?.status).toBe("fail");
  expect(state.steps.stp_2?.message).toBe("assertion failed");
}

describe("applyJobEvents: clean, in-order delivery", () => {
  it("converges to the expected final state", () => {
    expectConvergedState(applyJobEvents(initialJobEventsState, ALL_EVENTS));
  });
});

describe("applyJobEvents: shuffled (out-of-order) delivery", () => {
  it("converges to the identical final state regardless of arrival order", () => {
    // A handful of concrete shufflings, not a random one - deterministic,
    // reviewable, and re-runs identically in CI.
    const shufflings = [
      [ev7, ev0, ev6, ev1, ev5, ev2, ev4, ev3],
      [ev3, ev6, ev1, ev0, ev7, ev5, ev2, ev4],
      [ev6, ev5, ev4, ev3, ev2, ev1, ev0, ev7],
      [...ALL_EVENTS].reverse(),
    ];

    for (const shuffled of shufflings) {
      const state = applyJobEvents(initialJobEventsState, shuffled);
      expectConvergedState(state);
    }
  });

  it("never lets an older step revision overwrite a newer one, whichever arrives first", () => {
    // ev6 (id 6) before ev3 (id 3) for the SAME step index - if the
    // reducer were naively "last write wins by arrival", this order would
    // wrongly leave step 1 at ev3's content.
    const state = applyJobEvents(initialJobEventsState, [ev6, ev3]);
    expect(state.steps.stp_1?.message).toBe(
      "retried and passed on second attempt",
    );
  });

  it("never lets a stale progress event regress a newer one (the mutation that used to survive)", () => {
    // Progress is the one event type whose late arrival is silently
    // wrong rather than obviously wrong: a bar jumping BACKWARDS from
    // 80% to 10% looks like a plausible restart. Removing the ordering
    // guard from the reducer left every earlier test green.
    const newer: JobEvent = {
      id: "5",
      type: "progress",
      message: "almost there",
      percent: 80,
    };
    const older: JobEvent = {
      id: "2",
      type: "progress",
      message: "starting",
      percent: 10,
    };
    const state = applyJobEvents(initialJobEventsState, [newer, older]);
    expect(state.progress).toEqual({ message: "almost there", percent: 80 });
    // ...and in the other order it still ends at the newer one.
    expect(
      applyJobEvents(initialJobEventsState, [older, newer]).progress,
    ).toEqual({ message: "almost there", percent: 80 });
  });

  it("never lets a stale status/done overwrite a newer one", () => {
    const olderStatus: JobEvent = {
      id: "2",
      type: "status",
      status: "running",
    };
    const state = applyJobEvents(initialJobEventsState, [ev7, olderStatus]);
    expect(state.status).toBe("failed");
  });
});

describe("applyJobEvents: duplicated delivery", () => {
  it("is idempotent - applying the full sequence twice matches applying it once", () => {
    const once = applyJobEvents(initialJobEventsState, ALL_EVENTS);
    const twice = applyJobEvents(initialJobEventsState, [
      ...ALL_EVENTS,
      ...ALL_EVENTS,
    ]);
    expect(twice.steps).toEqual(once.steps);
    expect(twice.status).toBe(once.status);
    expect(twice.progress).toEqual(once.progress);
    expect(twice.lastEventId).toBe(once.lastEventId);
    // The one place a naive reducer would visibly duplicate: a log line
    // appended twice instead of deduped by event id.
    expect(twice.logs).toHaveLength(1);
  });

  it("interleaved duplicates (not just a repeated tail) still converge correctly", () => {
    const interleaved = [
      ev0,
      ev1,
      ev1,
      ev2,
      ev3,
      ev2,
      ev4,
      ev4,
      ev5,
      ev6,
      ev6,
      ev7,
      ev7,
    ];
    expectConvergedState(applyJobEvents(initialJobEventsState, interleaved));
  });

  it("a duplicate of an event that was itself superseded does not resurrect it", () => {
    // ev3 (step 1, original) redelivered AFTER ev6 (step 1, revision)
    // already won - a duplicate of the loser must still lose.
    const state = applyJobEvents(initialJobEventsState, [ev3, ev6, ev3]);
    expect(state.steps.stp_1?.message).toBe(
      "retried and passed on second attempt",
    );
  });
});

describe("applyJobEvents: gapped delivery (missing events, then backfilled)", () => {
  it("reflects only what has arrived, correctly, while events are missing", () => {
    // ev3 and ev5 missing (e.g. dropped, or not yet delivered by a resumed connection).
    const partial = applyJobEvents(initialJobEventsState, [
      ev0,
      ev1,
      ev2,
      ev4,
      ev6,
      ev7,
    ]);
    expect(Object.keys(partial.steps)).toHaveLength(2); // 0 and 1 only
    expect(partial.steps.stp_2).toBeUndefined();
    // lastEventId reflects the highest id actually SEEN, not the highest
    // that logically exists - this is exactly what a reconnect's
    // `?since=` must resume from, and it must not claim to have seen id
    // "5" when it never arrived.
    expect(partial.lastEventId).toBe("7");
  });

  it("backfilling the gap later (as a reconnect's replay would) converges to the same full state", () => {
    const afterGap = applyJobEvents(initialJobEventsState, [
      ev0,
      ev1,
      ev2,
      ev4,
      ev6,
      ev7,
    ]);
    // The missing events arrive out of their original position, as a
    // `?since=`-driven backfill naturally would (delivered after
    // everything the client already had).
    const backfilled = applyJobEvents(afterGap, [ev3, ev5]);
    expectConvergedState(backfilled);
  });
});

describe("applyJobEvent: single-event behaviour", () => {
  it("returns the same state reference when an event changes nothing (memoisation-friendly)", () => {
    const state = applyJobEvent(initialJobEventsState, ev7);
    const again = applyJobEvent(state, ev7);
    expect(again).toBe(state);
  });
});

describe("B0.5 B1: state is keyed on step id, not position", () => {
  it("two distinct steps that share an index are two steps, not one merged step", () => {
    // A re-indexed run (a plan edit, an inserted retry) can put two
    // different steps at the same `index`. Keyed on index they would
    // silently merge - one of them vanishing from the UI.
    const a: JobEvent = {
      id: "1",
      type: "step",
      step: { ...step(0), id: "stp_a", message: "step A" },
    };
    const b: JobEvent = {
      id: "2",
      type: "step",
      step: { ...step(0), id: "stp_b", message: "step B" },
    };
    const state = applyJobEvents(initialJobEventsState, [a, b]);
    expect(Object.keys(state.steps).sort()).toEqual(["stp_a", "stp_b"]);
    expect(state.steps.stp_a?.message).toBe("step A");
    expect(state.steps.stp_b?.message).toBe("step B");
  });

  it("the same step id at a different index is one step, updated - identity survives re-indexing", () => {
    const first: JobEvent = {
      id: "1",
      type: "step",
      step: { ...step(2), id: "stp_x" },
    };
    const reindexed: JobEvent = {
      id: "5",
      type: "step",
      step: { ...step(0), id: "stp_x", message: "moved" },
    };
    const state = applyJobEvents(initialJobEventsState, [reindexed, first]);
    expect(Object.keys(state.steps)).toEqual(["stp_x"]);
    expect(state.steps.stp_x?.index).toBe(0);
    expect(state.steps.stp_x?.message).toBe("moved");
  });
});

describe("B0.5 B2: event id ordering is numeric and total, and never fails open", () => {
  it("compares numerically, not lexicographically - id 10 is newer than id 9", () => {
    const nine: JobEvent = { id: "9", type: "status", status: "queued" };
    const ten: JobEvent = { id: "10", type: "status", status: "running" };
    expect(applyJobEvents(initialJobEventsState, [ten, nine]).status).toBe(
      "running",
    );
    expect(applyJobEvents(initialJobEventsState, [nine, ten]).lastEventId).toBe(
      "10",
    );
  });

  it.each([
    "",
    "abc",
    "01",
    "-1",
    "1.5",
    "1e3",
    "9007199254740993",
    "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  ])(
    "an id that is not canonical (%j) is ignored - never treated as newest",
    (badId) => {
      const good: JobEvent = { id: "3", type: "status", status: "running" };
      const bad: JobEvent = { id: badId, type: "status", status: "failed" };
      const state = applyJobEvents(initialJobEventsState, [good, bad]);
      expect(state.status).toBe("running");
      expect(state.lastEventId).toBe("3");
    },
  );
});

describe("B0.5 B3: heartbeats are liveness, not history", () => {
  it("a heartbeat changes nothing - and cannot advance the resume point", () => {
    const beat: JobEvent = {
      type: "heartbeat",
      at: "2026-09-21T12:00:00Z",
      interval_ms: 15_000,
    };
    const before = applyJobEvents(initialJobEventsState, [ev0, ev1]);
    const after = applyJobEvent(before, beat);
    expect(after).toBe(before); // same reference: literally nothing happened
    expect(after.lastEventId).toBe("1");
  });
});
