import { describe, expect, it } from "vitest";
import { UnrecognisedValue } from "@/lib/api/tolerant";
import {
  reconcileRun,
  windowFor,
  type ReconcileInput,
  type Step,
} from "./reconcile";

let n = 0;
function step(
  id: string,
  index: number,
  status: Step["status"],
  over: Partial<Step> = {},
): Step {
  n += 1;
  return {
    id,
    index,
    plan_step_id: null,
    action: "click",
    target: `#t${n}`,
    assertion: null,
    status,
    message: status === "running" ? "" : "OK",
    duration_ms: 1,
    screenshot_url: null,
    ...over,
  };
}
const base: ReconcileInput = {
  streamSteps: [],
  streamStatus: null,
  streamFinished: false,
  serverSteps: null,
  serverStatus: null,
  serverTerminal: false,
  serverFetchedAfterFinish: false,
};
const ids = (r: { steps: Step[] }) => r.steps.map((s) => `${s.id}:${s.status}`);

describe("reconcileRun: GET is authoritative, the stream is delivery", () => {
  it("before the server has answered, shows the stream and says so", () => {
    const r = reconcileRun({
      ...base,
      streamSteps: [step("b", 1, "running"), step("a", 0, "pass")],
      streamStatus: "running",
    });
    expect(ids(r)).toEqual(["a:pass", "b:running"]);
    expect(r.authority).toBe("stream");
    expect(r.status).toBe("running");
  });

  it("live: a step only the server has is added (a gap the stream missed)", () => {
    const r = reconcileRun({
      ...base,
      streamSteps: [step("b", 1, "pass")],
      serverSteps: [step("a", 0, "pass"), step("b", 1, "pass")],
    });
    expect(ids(r)).toEqual(["a:pass", "b:pass"]);
  });

  it("live: a `running` step is provisional - if the server already has it finished, the finished one is shown", () => {
    const r = reconcileRun({
      ...base,
      streamSteps: [step("a", 0, "running")],
      serverSteps: [step("a", 0, "pass")],
    });
    expect(ids(r)).toEqual(["a:pass"]);
  });

  it("live: a stale SERVER `running` does not undo a finished step the stream already delivered", () => {
    const r = reconcileRun({
      ...base,
      streamSteps: [step("a", 0, "pass")],
      serverSteps: [step("a", 0, "running")],
    });
    expect(ids(r)).toEqual(["a:pass"]);
  });

  it("live: two DIFFERENT finished states - the server wins", () => {
    const r = reconcileRun({
      ...base,
      streamSteps: [step("a", 0, "pass")],
      serverSteps: [step("a", 0, "fail")],
    });
    expect(ids(r)).toEqual(["a:fail"]);
  });

  it("live: the stream's status is shown until the server has spoken last", () => {
    const r = reconcileRun({
      ...base,
      streamStatus: "running",
      serverStatus: "queued",
      serverSteps: [],
    });
    expect(r.status).toBe("running");
  });

  it("after `done` and a later fetch, the SERVER's record is what is shown - and every difference is listed", () => {
    const r = reconcileRun({
      ...base,
      streamSteps: [step("a", 0, "pass"), step("ghost", 1, "pass")],
      streamStatus: "passed",
      streamFinished: true,
      serverSteps: [step("a", 0, "fail")],
      serverStatus: "failed",
      serverTerminal: true,
      serverFetchedAfterFinish: true,
    });
    expect(ids(r)).toEqual(["a:fail"]);
    expect(r.status).toBe("failed");
    expect(r.authority).toBe("server");
    expect(r.notes).toHaveLength(3);
    expect(r.notes.join("\n")).toMatch(
      /Step 1: the live stream reported "pass", the server records "fail"/,
    );
    expect(r.notes.join("\n")).toMatch(
      /Step 2 was reported by the live stream but is not in the server's record/,
    );
    expect(r.notes.join("\n")).toMatch(
      /ended with "passed", the server records "failed"/,
    );
  });

  it("when stream and server agree there are no notes - agreement is silent, disagreement never is", () => {
    const steps = [step("a", 0, "pass")];
    const r = reconcileRun({
      ...base,
      streamSteps: steps,
      streamStatus: "passed",
      streamFinished: true,
      serverSteps: steps,
      serverStatus: "passed",
      serverTerminal: true,
      serverFetchedAfterFinish: true,
    });
    expect(r.notes).toEqual([]);
  });

  it("a server that says the run is over wins even if the stream is behind (no note: the stream is late, not wrong)", () => {
    const r = reconcileRun({
      ...base,
      streamSteps: [step("a", 0, "running")],
      streamStatus: "running",
      serverSteps: [step("a", 0, "pass")],
      serverStatus: "passed",
      serverTerminal: true,
    });
    expect(ids(r)).toEqual(["a:pass"]);
    expect(r.status).toBe("passed");
    expect(r.notes).toEqual([]);
  });

  it("does not settle on the server just because the stream finished: a fetch from BEFORE `done` may be stale", () => {
    const r = reconcileRun({
      ...base,
      streamSteps: [step("a", 0, "pass"), step("b", 1, "pass")],
      streamStatus: "passed",
      streamFinished: true,
      serverSteps: [step("a", 0, "pass")],
      serverStatus: "running",
      serverTerminal: false,
      serverFetchedAfterFinish: false,
    });
    expect(ids(r)).toEqual(["a:pass", "b:pass"]);
    expect(r.authority).toBe("stream");
  });

  it("unrecognised statuses pass through untouched and are compared by their raw value", () => {
    const odd = new UnrecognisedValue("teleporting");
    const r = reconcileRun({
      ...base,
      streamSteps: [step("a", 0, odd)],
      serverSteps: [step("a", 0, new UnrecognisedValue("teleporting"))],
      streamStatus: odd,
      serverStatus: odd,
    });
    expect(r.steps[0]!.status).toBe(odd);
    expect(r.status).toBe(odd);
  });
});

describe("windowFor", () => {
  const w = (over: Partial<Parameters<typeof windowFor>[0]>) =>
    windowFor({
      scrollTop: 0,
      viewportHeight: 300,
      rowHeight: 60,
      count: 100,
      overscan: 2,
      ...over,
    });

  it("renders the visible rows plus overscan, clamped to the list", () => {
    expect(w({})).toEqual({ start: 0, end: 7 });
    expect(w({ scrollTop: 600 })).toEqual({ start: 8, end: 17 });
    expect(w({ scrollTop: 99_999 })).toEqual({ start: 93, end: 100 });
  });
  it("renders a bounded number of rows however long the list is", () => {
    const { start, end } = w({ count: 100_000, scrollTop: 3_000_000 });
    expect(end - start).toBeLessThanOrEqual(10);
  });
  it("an empty list and a negative scroll are safe", () => {
    expect(w({ count: 0 })).toEqual({ start: 0, end: 0 });
    expect(w({ scrollTop: -50 })).toEqual({ start: 0, end: 7 });
  });
});
