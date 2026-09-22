// @vitest-environment node
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { server } from "./server";
import { RunDetailSchema } from "@/lib/contract";
import { runLivePass, scanCheckout } from "./data";
import {
  LIVE_FAIL_TIMELINE,
  LIVE_PASS_TIMELINE,
  LIVE_STALL_TIMELINE,
  computeRunState,
  computeScanState,
  runEventLog,
  scanEventLog,
  scanOutcomeFor,
} from "./lifecycle";
import {
  applyJobEvents,
  initialJobEventsState,
} from "@/lib/api/sse/jobEventsReducer";

/**
 * "Polling GET /runs/{id}" and "subscribing to /jobs/{id}/events" are two
 * views of ONE job, and must never disagree about what has happened - the
 * client uses whichever it has and reconciles with the other. The mock
 * computes both from the same timeline, but nothing checked that the two
 * computations AGREE; the stalled run didn't (polling showed a synthetic
 * `timeout` step the event log never carried), and a cancelled run's event
 * stream went on to report `passed`.
 *
 * The property: folding a job's event log through the client's reducer
 * gives exactly the steps and terminal status the resource reports at the
 * same instant.
 */

const SAMPLE_TIMES_MS = [
  0, 100, 1_300, 2_500, 4_000, 5_600, 8_000, 15_000, 16_000, 60_000,
];

const TIMELINES = [
  ["pass", LIVE_PASS_TIMELINE],
  ["fail partway", LIVE_FAIL_TIMELINE],
  ["stall then timed_out", LIVE_STALL_TIMELINE],
] as const;

describe.each(TIMELINES)("run timeline: %s", (_name, timeline) => {
  it.each(SAMPLE_TIMES_MS)(
    "at t=%dms, the event stream and the poll agree",
    (t) => {
      const polled = computeRunState(runLivePass, timeline, t);
      const state = applyJobEvents(
        initialJobEventsState,
        runEventLog(timeline, t),
      );

      // Same steps, by identity, with identical content.
      expect(state.steps).toEqual(
        Object.fromEntries(polled.steps.map((s) => [s.id, s])),
      );

      // A `done` event exists exactly when the resource is terminal, and says the same thing.
      const terminal =
        polled.status !== "running" && polled.status !== "queued";
      if (terminal) expect(state.status).toBe(polled.status);
      else expect(state.status).toBeNull();
    },
  );
});

describe("scan timelines", () => {
  const scanAt = (targetId: string, url: string, t: number) =>
    computeScanState(
      {
        ...scanCheckout,
        target_id: targetId,
        target_url: url,
        status: "queued",
        modules: [],
      },
      t,
    );

  it.each([
    ["tgt_checkout", "https://checkout.example.com", "completed"],
    ["tgt_unreachable", "https://legacy-admin.example.com", "failed"],
    ["tgt_login", "https://login.example.com", "parked"],
  ])(
    "%s: the stream's terminal status is the scan's terminal status (%s)",
    (targetId, url, expected) => {
      const polled = scanAt(targetId, url, 10_000);
      const state = applyJobEvents(
        initialJobEventsState,
        scanEventLog(10_000, scanOutcomeFor(url, null)),
      );
      expect(polled.status).toBe(expected);
      expect(state.status).toBe(polled.status);
    },
  );
});

describe("cancellation reaches the event stream too", () => {
  const base = "http://localhost";
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    vi.useRealTimers();
  });
  afterAll(() => server.close());

  async function sseEvents(id: string) {
    const res = await fetch(`${base}/jobs/${id}/events`);
    const text = await res.text(); // finished job: the stream closes, so this resolves
    return [...text.matchAll(/^data: (.+)$/gm)].map((m) => JSON.parse(m[1]!));
  }

  it("a cancelled run's stream ends with `cancelled`, agreeing with GET /runs/{id}", async () => {
    const created = RunDetailSchema.parse(
      await (
        await fetch(`${base}/runs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: "wksp_demo",
            target_id: "tgt_checkout",
            suite_id: "suite_checkout",
          }),
        })
      ).json(),
    );
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 1_500); // two steps in
    await fetch(`${base}/runs/${created.id}/cancel`, { method: "POST" });
    vi.setSystemTime(Date.now() + 60_000); // long after the timeline would have finished

    const polled = RunDetailSchema.parse(
      await (await fetch(`${base}/runs/${created.id}`)).json(),
    );
    expect(polled.status).toBe("cancelled");

    const events = await sseEvents(created.id);
    const done = events.find((e) => e.type === "done");
    expect(done?.status).toBe("cancelled");
    // What a client builds from the stream is exactly what the poll shows.
    const streamed = applyJobEvents(initialJobEventsState, events);
    expect(
      Object.values(streamed.steps).sort((a, b) => a.index - b.index),
    ).toEqual(polled.steps);
  });

  it("an ALREADY-OPEN stream hears the cancellation and closes on `done: cancelled`", async () => {
    const created = RunDetailSchema.parse(
      await (
        await fetch(`${base}/runs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: "wksp_demo",
            target_id: "tgt_checkout",
            suite_id: "suite_checkout",
          }),
        })
      ).json(),
    );
    const controller = new AbortController();
    const res = await fetch(`${base}/jobs/${created.id}/events`, {
      signal: controller.signal,
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 1_500);
    await fetch(`${base}/runs/${created.id}/cancel`, { method: "POST" });
    // The stream must now END by itself; if the cancel never reached it,
    // this read would hang until the test times out.
    const text = await res.text();
    const events = [...text.matchAll(/^data: (.+)$/gm)].map((m) =>
      JSON.parse(m[1]!),
    );
    expect(events.at(-1)?.type).toBe("done");
    expect(events.at(-1)?.status).toBe("cancelled");
    controller.abort();
  });
});
