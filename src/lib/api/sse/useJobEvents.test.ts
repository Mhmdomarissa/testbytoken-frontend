import { describe, expect, it } from "vitest";
import { heartbeatFrame, sseFrame } from "@/mocks/handlers/events";
import { parseJobEventFrame } from "./parseFrame";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/contract";
import {
  DEAD_AFTER_HEARTBEAT_INTERVALS,
  isConnectionDead,
} from "./useJobEvents";

/** B0.5 B3: the dead-vs-quiet decision is pure, so it needs no browser. */
describe("isConnectionDead", () => {
  const t0 = 1_000_000;

  it("a connection that heartbeated recently is alive however quiet the job is", () => {
    expect(isConnectionDead(t0, t0 + 14_000)).toBe(false);
    expect(isConnectionDead(t0, t0 + HEARTBEAT_INTERVAL_MS * 2)).toBe(false); // one missed beat is not death
  });

  it("no frame of any kind for 2.5 intervals is a dead connection", () => {
    const limit = DEAD_AFTER_HEARTBEAT_INTERVALS * HEARTBEAT_INTERVAL_MS;
    expect(limit).toBe(37_500);
    expect(isConnectionDead(t0, t0 + limit)).toBe(false); // exactly at the limit: not yet
    expect(isConnectionDead(t0, t0 + limit + 1)).toBe(true);
  });

  it("respects an interval other than the default", () => {
    expect(isConnectionDead(t0, t0 + 30_000, 5_000)).toBe(true);
  });
});

describe("the heartbeat on the wire (B0.5 B3)", () => {
  it("has NO id line - it must never advance Last-Event-ID / ?since=", () => {
    const frame = heartbeatFrame();
    expect(frame).not.toMatch(/^id:/m);
    expect(frame).toMatch(/^data: /m);
    expect(frame.endsWith("\n\n")).toBe(true);
  });

  it("a sequenced event, by contrast, does carry its id", () => {
    expect(sseFrame({ id: "7", type: "status", status: "running" })).toMatch(
      /^id: 7$/m,
    );
  });

  it("parses as a heartbeat, is not counted as unreadable, and states the interval", () => {
    const data = heartbeatFrame()
      .split("\n")
      .find((l) => l.startsWith("data: "))!
      .slice(6);
    const parsed = parseJobEventFrame(data);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.event.type).toBe("heartbeat");
      if (parsed.event.type === "heartbeat")
        expect(parsed.event.interval_ms).toBe(HEARTBEAT_INTERVAL_MS);
    }
  });
});
