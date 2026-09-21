import type { z } from "zod";
import type { RunDetailSchema, ScanSchema } from "@/lib/contract";
import { runs as initialRuns, scans as initialScans } from "./data";

/**
 * Shared, mutable, in-memory stores for runs and scans - a single Map per
 * resource, not a `let store = [...x]` per handler file. Found the hard
 * way: runs.ts and events.ts each had their own private copy of "the
 * runs," so a run created via POST /runs (added to runs.ts's copy) was
 * invisible to GET /jobs/{id}/events (which read data.ts's original,
 * never-updated array) - a run's own SSE stream 404'd immediately after
 * creating it. A Map, referenced by every handler that needs it, means
 * there's exactly one place a run or scan can be added, and every reader
 * sees the same object.
 */
export const runStore = new Map<string, z.infer<typeof RunDetailSchema>>(
  initialRuns.map((r) => [r.id, r]),
);

export const scanStore = new Map<string, z.infer<typeof ScanSchema>>(
  initialScans.map((s) => [s.id, s]),
);
