import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { z } from "zod";
import { nextDelayMs, usePolledResource } from "./usePolledResource";

const Schema = z.object({ status: z.string() });

let visibility: DocumentVisibilityState = "visible";
function setVisibility(v: DocumentVisibilityState) {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
}

const ok = () =>
  new Response(JSON.stringify({ status: "ready" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
const down = () =>
  new Response(JSON.stringify({ error: { message: "Engine down" } }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  fetchMock = vi.fn(async () => ok());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  // Unmount every hook, or earlier tests' pollers hear the next test's
  // visibility events and fetch too.
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function mount() {
  const hook = renderHook(() => usePolledResource("/workspaces/w", Schema));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return hook;
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("usePolledResource", () => {
  it("asks once on mount, then every 30 s while the tab is visible", async () => {
    const { result } = await mount();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("success");
    await advance(29_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("stops while the tab is hidden, and asks immediately when it is visible again", async () => {
    await mount();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => setVisibility("hidden"));
    await advance(10 * 60_000); // ten hidden minutes
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => setVisibility("visible"));
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(2); // immediately
    await advance(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(3); // then back on schedule
  });

  it("never asks while it mounts hidden, until the tab is shown", async () => {
    visibility = "hidden";
    await mount();
    await advance(5 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    await act(async () => setVisibility("visible"));
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("after a failure: says so (keeping when it last heard), and backs off 60 s, 120 s, 120 s", async () => {
    const { result } = await mount();
    const heardAt = result.current.lastSuccessAt;
    expect(heardAt).not.toBeNull();

    fetchMock.mockImplementation(async () => down());
    await advance(30_000); // 2nd request fails
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("error");
    expect(result.current.lastSuccessAt).toBe(heardAt);

    await advance(59_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(1); // +60 s
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await advance(120_000); // +120 s
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await advance(120_000); // capped at 120 s
    expect(fetchMock).toHaveBeenCalledTimes(5);

    // Recovery resets the interval to 30 s.
    fetchMock.mockImplementation(async () => ok());
    await advance(120_000);
    expect(result.current.status).toBe("success");
    await advance(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it("stops entirely on unmount", async () => {
    const { unmount } = await mount();
    unmount();
    await advance(10 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("nextDelayMs", () => {
  const opts = { intervalMs: 30_000, maxBackoffMs: 120_000 };
  it.each([
    [0, 30_000],
    [1, 60_000],
    [2, 120_000],
    [3, 120_000],
    [9, 120_000],
  ])("%i consecutive failures -> %i ms", (failures, ms) => {
    expect(nextDelayMs(failures, opts)).toBe(ms);
  });
});
