import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { UnrecognisedValue } from "@/lib/api/tolerant";
import { LiveStatus, QUIET_AFTER_MS, liveState } from "./LiveStatus";
import { StepRow } from "./StepRow";
import { StepList, VIRTUALIZE_AFTER } from "./StepList";
import { isRunOver, runStatusLabel } from "./runStatus";
import type { Step } from "./reconcile";

afterEach(cleanup);

let n = 0;
function step(over: Partial<Step> = {}): Step {
  n += 1;
  return {
    id: `s${n}`,
    index: n - 1,
    plan_step_id: null,
    action: "click",
    target: `#t${n}`,
    assertion: null,
    status: "pass",
    message: "OK",
    duration_ms: 12,
    screenshot_url: null,
    ...over,
  };
}
const reset = () => {
  n = 0;
};

describe("isRunOver / runStatusLabel", () => {
  it("only the four terminal statuses are 'over'; unknown and absent never are", () => {
    for (const s of ["passed", "failed", "cancelled", "timed_out"])
      expect(isRunOver(s)).toBe(true);
    for (const s of ["queued", "running"]) expect(isRunOver(s)).toBe(false);
    expect(isRunOver(new UnrecognisedValue("passed_with_love"))).toBe(false);
    expect(isRunOver(null)).toBe(false);
    expect(isRunOver(undefined)).toBe(false);
    expect(isRunOver("constructor")).toBe(false);
  });
  it("run wording, and nothing invented for an unknown status", () => {
    expect(runStatusLabel("timed_out")).toBe("Timed out");
    expect(runStatusLabel("passed")).toBe("Passed");
    expect(runStatusLabel(new UnrecognisedValue("x"))).toBeUndefined();
    expect(runStatusLabel("constructor")).toBeUndefined();
  });
});

describe("liveState: a quiet run and a dead connection are different facts", () => {
  const base = {
    connection: "open" as const,
    finished: false,
    runOver: false,
    now: 100_000,
    lastEventAt: 99_000,
    lastFrameAt: 99_000,
  };

  it("recent update: live", () => {
    expect(liveState(base)).toMatchObject({
      state: "live",
      text: "Live. Last update 1s ago.",
    });
  });
  it("no step for a while but the connection is fresh: QUIET, and says the connection is healthy", () => {
    const r = liveState({
      ...base,
      lastEventAt: 100_000 - QUIET_AFTER_MS - 4_000,
      lastFrameAt: 97_000,
    });
    expect(r.state).toBe("quiet");
    expect(r.text).toMatch(
      /No new step for 12s\. The engine is quiet\. The connection is healthy \(last message from the server 3s ago\)/,
    );
  });
  it("no frame of any kind for over 2.5 heartbeats: the connection may be dead, and it says so", () => {
    const r = liveState({ ...base, lastEventAt: 20_000, lastFrameAt: 50_000 });
    expect(r.state).toBe("stale");
    expect(r.text).toMatch(/no heartbeat for 50s.*may have died/);
  });
  it("a dropped stream is 'reconnecting' and warns the screen may be out of date", () => {
    const r = liveState({ ...base, connection: "reconnecting" });
    expect(r.state).toBe("reconnecting");
    expect(r.text).toMatch(/out of date/);
  });
  it("connecting, and connected-but-nothing-yet, are stated", () => {
    expect(
      liveState({
        ...base,
        connection: "connecting",
        lastEventAt: null,
        lastFrameAt: null,
      }).state,
    ).toBe("connecting");
    expect(
      liveState({ ...base, lastEventAt: null, lastFrameAt: null }).text,
    ).toMatch(/Waiting for the first update/);
  });
  it("finished wins over everything, whether the stream said so or the server did", () => {
    expect(
      liveState({ ...base, finished: true, connection: "reconnecting" }).state,
    ).toBe("finished");
    expect(
      liveState({ ...base, runOver: true, connection: "closed" }).state,
    ).toBe("finished");
  });
  it("a closed stream on a run that isn't over says there is no live stream - not 'finished'", () => {
    const r = liveState({ ...base, connection: "closed" });
    expect(r.state).toBe("stream-unavailable");
    expect(r.text).toMatch(/server's record/);
  });
});

describe("LiveStatus", () => {
  it("a dropped or dying connection is an alert; everything else is a polite status", () => {
    const { rerender } = render(
      <LiveStatus
        live={{ state: "reconnecting", text: "x" }}
        reconnects={1}
        unreadable={0}
      />,
    );
    expect(screen.getByTestId("connection-banner").getAttribute("role")).toBe(
      "alert",
    );
    rerender(
      <LiveStatus
        live={{ state: "live", text: "x" }}
        reconnects={0}
        unreadable={0}
      />,
    );
    expect(screen.getByTestId("connection-banner").getAttribute("role")).toBe(
      "status",
    );
  });
  it("says how many times it dropped, and how many updates could not be read", () => {
    render(
      <LiveStatus
        live={{ state: "live", text: "x" }}
        reconnects={2}
        unreadable={3}
      />,
    );
    const text = screen.getByTestId("connection-banner").textContent!;
    expect(text).toMatch(/dropped and reconnected 2 times/);
    expect(text).toMatch(/3 updates could not be read and are not shown/);
  });
});

describe("StepRow", () => {
  it("marks ONLY a server-reported running step as current", () => {
    reset();
    render(
      <ol>
        <StepRow
          step={step({ status: "running", message: "" })}
          position={1}
          total={2}
          compact={false}
        />
        <StepRow
          step={step({ status: "pass" })}
          position={2}
          total={2}
          compact={false}
        />
      </ol>,
    );
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]!.getAttribute("aria-current")).toBe("step");
    expect(rows[0]!.textContent).toMatch(/In progress/);
    expect(rows[1]!.getAttribute("aria-current")).toBeNull();
  });

  it("an unrecognised step status is shown as unrecognised, never current, never a default", () => {
    reset();
    render(
      <ol>
        <StepRow
          step={step({ status: new UnrecognisedValue("thinking") })}
          position={1}
          total={1}
          compact={false}
        />
      </ol>,
    );
    const row = screen.getByRole("listitem");
    expect(row.getAttribute("data-status")).toBe("unrecognised");
    expect(row.getAttribute("aria-current")).toBeNull();
    expect(row.textContent).toMatch(/thinking/);
  });

  it("scraped text (target, message, assertion) is inert, and a long value can't break the layout", () => {
    reset();
    const { container } = render(
      <ol>
        <StepRow
          step={step({
            target: '<img src=x onerror="alert(1)">' + "a".repeat(400),
            message: "<script>alert(1)</script> " + "b".repeat(400),
            assertion: "<b>bold</b>",
            status: "fail",
          })}
          position={1}
          total={1}
          compact
        />
      </ol>,
    );
    expect(container.querySelector("img, script, b")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
    const li = screen.getByRole("listitem");
    expect(li.className).toMatch(/overflow-hidden/);
    expect(li.querySelector('[title^="<img"]')!.className).toMatch(/truncate/);
  });

  it("a step with no message says so instead of leaving a blank", () => {
    reset();
    render(
      <ol>
        <StepRow
          step={step({ message: "" })}
          position={1}
          total={1}
          compact={false}
        />
      </ol>,
    );
    expect(screen.getByText("(no message)")).toBeTruthy();
  });
});

describe("StepList", () => {
  it("a short run renders every row in the page, in full", () => {
    reset();
    const steps = Array.from({ length: 5 }, () => step());
    render(<StepList steps={steps} live={false} />);
    expect(screen.getByTestId("step-list").getAttribute("data-windowed")).toBe(
      "false",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });

  it("a long run mounts a bounded window, says how long it really is, and lists failures in full outside the window", () => {
    reset();
    const count = 5_000;
    const steps = Array.from({ length: count }, (_, i) =>
      i === 4_321
        ? step({
            status: "fail",
            message: "the one that matters " + "x".repeat(300),
          })
        : step(),
    );
    expect(count).toBeGreaterThan(VIRTUALIZE_AFTER);
    render(<StepList steps={steps} live={false} />);
    expect(screen.getByTestId("step-list").getAttribute("data-windowed")).toBe(
      "true",
    );
    const mounted = document.querySelectorAll(
      '[data-testid="step-list"] li',
    ).length;
    expect(mounted).toBeLessThan(30);
    expect(
      screen
        .getByTestId("step-list")
        .querySelector("li")!
        .getAttribute("aria-setsize"),
    ).toBe("5000");
    const summary = screen.getByTestId("failures-summary");
    expect(summary.textContent).toContain("Failed and warning steps (1)");
    expect(summary.textContent).toContain(
      "the one that matters " + "x".repeat(300),
    );
  });

  it("caps the failure summary and says how many more there are", () => {
    reset();
    const steps = Array.from({ length: 120 }, () => step({ status: "fail" }));
    render(<StepList steps={steps} live={false} />);
    expect(screen.getByTestId("failures-summary").textContent).toMatch(
      /Showing the first 50 of 120/,
    );
  });
});
