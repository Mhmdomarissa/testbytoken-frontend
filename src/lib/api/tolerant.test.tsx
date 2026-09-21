import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import * as contract from "@/lib/contract";
import {
  JobEventSchema,
  RunDetailSchema,
  RunSummarySchema,
  paginated,
} from "@/lib/contract";
import { StatusBadge } from "@/components/status/StatusBadge";
import { toBadgeStatus } from "@/components/status/badgeStatus";
import {
  UnrecognisedValue,
  enumLabel,
  isUnrecognised,
  resetUnrecognisedReports,
  tolerant,
} from "./tolerant";
import { parseJobEventFrame } from "./sse/parseFrame";
import { applyJobEvents, initialJobEventsState } from "./sse/jobEventsReducer";

/**
 * docs/PHASE_B0_5.md A1: "an unknown value at each of the four sites,
 * asserting it renders visibly and nothing is dropped." The four sites:
 * step status, run status, job-event status, done.status.
 */

const step = {
  index: 0,
  action: "click",
  target: "#a",
  assertion: null,
  status: "pass",
  message: "ok",
  duration_ms: 1,
  screenshot_url: null,
};
const run = {
  id: "run_1",
  workspace_id: "w",
  target_id: "t",
  suite_id: "s",
  status: "passed",
  pass_rate: 1,
  coverage: { generated: 3, candidate: 24 },
  token_cost: 1,
  proof_id: null,
  started_at: "2026-09-16T14:32:00Z",
  finished_at: null,
};

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  resetUnrecognisedReports();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

function chipText(status: Parameters<typeof StatusBadge>[0]["status"]) {
  const { container } = render(<StatusBadge status={status} />);
  return container;
}

describe("site 1: step status", () => {
  it("a step with an unknown status is kept, with the raw value, and renders visibly", () => {
    const frame = parseJobEventFrame(
      JSON.stringify({
        id: "1",
        type: "step",
        step: { ...step, status: "banana" },
      }),
    );
    expect(frame.ok).toBe(true);
    if (!frame.ok) return;

    // Nothing dropped: the step is in reducer state.
    const state = applyJobEvents(initialJobEventsState, [frame.event]);
    const kept = state.steps[0];
    expect(kept).toBeDefined();
    expect(isUnrecognised(kept?.status)).toBe(true);
    expect(kept?.message).toBe("ok"); // the rest of the step survives intact

    // Renders visibly, as unrecognised, with the raw value.
    const el = chipText(toBadgeStatus(kept!.status));
    expect(el.querySelector("[data-unrecognised-status]")).not.toBeNull();
    expect(el.textContent).toContain("banana");
  });
});

describe("site 2: run status", () => {
  it("one unknown run status does not fail the response - the run loads, and the rest of the list with it", () => {
    const list = tolerant(paginated(RunSummarySchema)).parse({
      data: [run, { ...run, id: "run_2", status: "paused_by_engine" }],
      next_cursor: null,
    });
    expect(list.data).toHaveLength(2); // nothing dropped
    expect(list.data[0]?.status).toBe("passed");
    const odd = list.data[1]?.status;
    expect(isUnrecognised(odd)).toBe(true);
    const el = chipText(toBadgeStatus(odd!));
    expect(el.textContent).toContain("paused_by_engine");
  });

  it("the strict contract schema still rejects it - tolerance is client-side only", () => {
    expect(
      RunDetailSchema.safeParse({
        ...run,
        status: "paused_by_engine",
        steps: [],
      }).success,
    ).toBe(false);
  });

  it("the run's coverage survives alongside an unrecognised status (Phase B §1.2)", () => {
    const parsed = tolerant(RunDetailSchema).parse({
      ...run,
      status: "??",
      steps: [],
    });
    expect(parsed.coverage).toEqual({ generated: 3, candidate: 24 });
  });
});

describe("site 3: job-event status", () => {
  it("a status event with an unfamiliar value is applied, not dropped, and renders visibly", () => {
    const frame = parseJobEventFrame(
      JSON.stringify({ id: "1", type: "status", status: "banana" }),
    );
    expect(frame.ok).toBe(true);
    if (!frame.ok) return;
    const state = applyJobEvents(initialJobEventsState, [frame.event]);
    expect(state.status).not.toBeNull();
    const el = chipText(toBadgeStatus(state.status!));
    expect(el.querySelector("[data-unrecognised-status]")).not.toBeNull();
    expect(el.textContent).toContain("banana");
  });
});

describe("site 4: done.status", () => {
  it("a done event with an unfamiliar value is applied, not dropped, and renders visibly", () => {
    const frame = parseJobEventFrame(
      JSON.stringify({ id: "9", type: "done", status: "exploded" }),
    );
    expect(frame.ok).toBe(true);
    if (!frame.ok) return;
    const state = applyJobEvents(initialJobEventsState, [frame.event]);
    expect(state.status).toBe("exploded");
    expect(state.lastEventId).toBe("9");
    const el = chipText(toBadgeStatus(state.status!));
    expect(el.textContent).toContain("exploded");
  });
});

describe("what is still refused, and never silently", () => {
  it("invalid JSON and unknown event types are returned as unreadable, with a reason", () => {
    expect(parseJobEventFrame("not json")).toMatchObject({
      ok: false,
      reason: "invalid_json",
    });
    expect(
      parseJobEventFrame(JSON.stringify({ id: "1", type: "teleport" })),
    ).toMatchObject({ ok: false, reason: "invalid_shape" });
    expect(
      parseJobEventFrame(JSON.stringify({ type: "status", status: "x" })),
    ).toMatchObject({
      ok: false,
    }); // missing id
  });

  it("an unknown enum inside an otherwise-valid discriminated frame does not break discrimination", () => {
    const ok = parseJobEventFrame(
      JSON.stringify({ id: "3", type: "log", level: "debug", message: "hi" }),
    );
    expect(ok.ok).toBe(true);
    if (ok.ok && ok.event.type === "log") {
      expect(isUnrecognised(ok.event.level)).toBe(true);
    }
  });
});

describe("the badge never throws, and never impersonates a real state", () => {
  it("renders an unrecognised chip for a status that bypassed the types entirely", () => {
    const el = chipText("banana" as never);
    expect(el.querySelector("[data-unrecognised-status]")).not.toBeNull();
  });

  it("maps server-controlled strings safely - prototype keys are unrecognised, not functions", () => {
    for (const hostile of [
      "constructor",
      "__proto__",
      "toString",
      "hasOwnProperty",
    ]) {
      expect(toBadgeStatus(hostile)).toBeInstanceOf(UnrecognisedValue);
    }
  });

  it("an unrecognised chip is not styled as any real status (no chip fill)", () => {
    const el = chipText(new UnrecognisedValue("x"));
    const span = el.querySelector("span");
    expect(span?.style.backgroundColor).toBe("");
  });

  it("escapes and truncates hostile raw values", () => {
    const hostile = `<img src=x onerror=alert(1)>${"A".repeat(500)}`;
    const el = chipText(new UnrecognisedValue(hostile));
    expect(el.querySelector("img")).toBeNull();
    expect(el.textContent!.length).toBeLessThan(80);
    expect(el.textContent).toContain("<img src=x");
    expect(enumLabel(new UnrecognisedValue(hostile)).length).toBeLessThan(80);
  });

  it("does not let server JSON forge the sentinel", () => {
    const parsed = tolerant(RunDetailSchema).parse({
      ...run,
      status: { raw: "x", unrecognised: true },
      steps: [],
    });
    expect(parsed.status).toBeInstanceOf(UnrecognisedValue); // wrapped as a *value it didn't understand*, never trusted as ours
  });
});

describe("loud in development, graceful in production", () => {
  it("logs an unrecognised value once per path+value in development", () => {
    const schema = tolerant(RunDetailSchema);
    schema.parse({ ...run, status: "banana", steps: [] });
    schema.parse({ ...run, status: "banana", steps: [] });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain("banana");
  });

  it("stays quiet in production, but still renders", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const parsed = tolerant(RunDetailSchema).parse({
        ...run,
        status: "prod-odd",
        steps: [],
      });
      expect(errorSpy).not.toHaveBeenCalled();
      expect(isUnrecognised(parsed.status)).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("tolerant() covers the whole contract", () => {
  it("every exported contract schema can be derived (an unsupported kind fails loudly here, not silently strict in prod)", () => {
    const schemas = Object.entries(contract).filter(
      ([name, v]) =>
        name.endsWith("Schema") &&
        typeof v === "object" &&
        v !== null &&
        "_zod" in v,
    );
    expect(schemas.length).toBeGreaterThan(10);
    for (const [name, schema] of schemas) {
      expect(() => tolerant(schema as never), name).not.toThrow();
    }
  });

  it("leaves a known payload completely unchanged", () => {
    const parsed = tolerant(RunDetailSchema).parse({ ...run, steps: [step] });
    expect(parsed).toEqual({ ...run, steps: [step] });
  });

  it("still rejects genuinely malformed structure - it tolerates vocabulary, not brokenness", () => {
    expect(
      tolerant(RunDetailSchema).safeParse({
        ...run,
        pass_rate: "high",
        steps: [],
      }).success,
    ).toBe(false);
    expect(
      tolerant(JobEventSchema).safeParse({ id: 5, type: "status", status: "x" })
        .success,
    ).toBe(false);
  });
});
