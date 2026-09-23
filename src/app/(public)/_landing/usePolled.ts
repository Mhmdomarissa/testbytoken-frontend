"use client";

import { useEffect, useState } from "react";
import type { z } from "zod";
import { apiGet } from "@/lib/api/client";
import type { Tolerated } from "@/lib/api/tolerant";

/**
 * GET a resource and keep re-reading it while `isMoving` says it may still
 * change - the landing page's stand-in for the console's `usePlan` and
 * `useRun` (src/lib/api/queries/), with the same intervals. A separate
 * hook because those are built on TanStack Query, which this route group
 * must not ship (src/app/route-boundary.test.ts). Unrecognised statuses
 * count as moving at the call sites: a state we don't understand isn't one
 * we can call settled. A failed read is surfaced as `error`, not retried.
 * Changing `refetchKey` forces an immediate read (the
 * run page does this when the event stream says `done` or reconnects).
 */
export function usePolled<S extends z.ZodType>(
  path: string | undefined,
  schema: S,
  isMoving: (value: Tolerated<z.output<S>>) => boolean,
  intervalMs: number,
  refetchKey?: unknown,
) {
  type Value = Tolerated<z.output<S>>;
  const [value, setValue] = useState<Value | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [tick, setTick] = useState(0);

  const [trackedPath, setTrackedPath] = useState(path);
  if (path !== trackedPath) {
    setTrackedPath(path);
    setValue(null);
    setError(null);
    setFetchedAt(0);
  }

  useEffect(() => {
    if (path === undefined) return;
    const controller = new AbortController();
    apiGet(path, schema, { signal: controller.signal })
      .then((v) => {
        setValue(v);
        setError(null);
        setFetchedAt(Date.now());
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(e);
      });
    return () => controller.abort();
  }, [path, schema, refetchKey, tick]);

  // Only a value we've actually read can say it's still moving. A failed
  // first read is reported, not retried in a loop.
  const moving = value !== null && isMoving(value);
  useEffect(() => {
    if (path === undefined || !moving) return;
    const t = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(t);
  }, [path, moving, intervalMs]);

  return { value, error, fetchedAt };
}
