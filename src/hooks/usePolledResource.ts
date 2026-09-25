"use client";

import { useEffect, useState } from "react";
import type { z } from "zod";
import { tolerant, type Tolerated } from "@/lib/api/tolerant";

export type PolledState<T> =
  | { status: "loading"; lastSuccessAt: null }
  | { status: "success"; data: T; lastSuccessAt: number }
  | { status: "error"; message: string; lastSuccessAt: number | null };

/** How long to wait before the next request, given consecutive failures. */
export function nextDelayMs(
  failures: number,
  { intervalMs, maxBackoffMs }: { intervalMs: number; maxBackoffMs: number },
): number {
  if (failures === 0) return intervalMs;
  return Math.min(intervalMs * 2 ** failures, maxBackoffMs);
}

/**
 * useResource's fetch + tolerant Zod parse, repeated on a schedule - for
 * the one place the console needs to know the engine is STILL there (the
 * sidebar's engine card). Behaviour, not presentation:
 *
 * - every `intervalMs` (30 s) while the tab is visible;
 * - paused while the tab is hidden - no timer, the in-flight request
 *   aborted - and an immediate request the moment it is visible again;
 * - after a failure, back off: 30 s -> 60 s -> 120 s, capped;
 * - the state is always the LATEST completed request. A failure is shown
 *   as a failure (with when we last succeeded), never as the last good
 *   answer - so a stale "ready" can't stay on screen.
 *
 * `lastSuccessAt` is this client's clock when the response arrived - not a
 * server field; the card says so.
 */
export function usePolledResource<S extends z.ZodType>(
  url: string,
  schema: S,
  {
    intervalMs = 30_000,
    maxBackoffMs = 120_000,
  }: { intervalMs?: number; maxBackoffMs?: number } = {},
): PolledState<Tolerated<z.output<S>>> {
  type T = Tolerated<z.output<S>>;
  const [state, setState] = useState<PolledState<T>>({
    status: "loading",
    lastSuccessAt: null,
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let failures = 0;
    let lastSuccessAt: number | null = null;
    let stopped = false;

    async function tick() {
      clearTimeout(timer);
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
      try {
        const res = await fetch(url, { signal });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            body?.error?.message ?? `Request failed (${res.status}).`,
          );
        }
        const data = tolerant(schema).parse(await res.json());
        if (signal.aborted || stopped) return;
        failures = 0;
        lastSuccessAt = Date.now();
        setState({ status: "success", data, lastSuccessAt });
      } catch (err) {
        if (signal.aborted || stopped) return;
        failures += 1;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Something went wrong.",
          lastSuccessAt,
        });
      }
      if (!stopped && document.visibilityState === "visible") {
        timer = setTimeout(
          () => void tick(),
          nextDelayMs(failures, { intervalMs, maxBackoffMs }),
        );
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void tick(); // immediately, then back on the schedule
      } else {
        clearTimeout(timer);
        controller?.abort();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    if (document.visibilityState === "visible") void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [url, schema, intervalMs, maxBackoffMs]);

  return state;
}
