import type { z } from "zod";
import type {
  LoginSessionSchema,
  TargetSchema,
  PlanSchema,
  RunDetailSchema,
  ScanSchema,
} from "@/lib/contract";
import {
  runs as initialRuns,
  scans as initialScans,
  targets as initialTargets,
} from "./data";

/**
 * Shared, mutable, in-memory stores - a single Map per resource, not a
 * `let store = [...x]` per handler file. Found the hard way: runs.ts and
 * events.ts each had their own private copy of "the runs," so a run created
 * via POST /runs (added to runs.ts's copy) was invisible to
 * GET /jobs/{id}/events (which read data.ts's original, never-updated
 * array) - a run's own SSE stream 404'd immediately after creating it. A
 * Map, referenced by every handler that needs it, means there's exactly one
 * place a run or scan can be added, and every reader sees the same object.
 */
export const runStore = new Map<string, z.infer<typeof RunDetailSchema>>(
  initialRuns.map((r) => [r.id, r]),
);

export const scanStore = new Map<string, z.infer<typeof ScanSchema>>(
  initialScans.map((s) => [s.id, s]),
);

/** Targets as registered. `last_scan` on these is NOT authoritative - handlers/targets.ts overlays the real most-recent scan at read time. */
export const targetStore = new Map<string, z.infer<typeof TargetSchema>>(
  initialTargets.map((t) => [t.id, t]),
);

/** Plans as generated; `createdAtMs` drives the time-based `generating` -> `proposed` transition (planning.ts). */
export const planStore = new Map<
  string,
  { plan: z.infer<typeof PlanSchema>; createdAtMs: number }
>();

/** Login sessions as created; `createdAtMs` drives provisioning -> ready -> in_progress (login.ts). */
export const loginSessionStore = new Map<
  string,
  {
    session: z.infer<typeof LoginSessionSchema>;
    createdAtMs: number;
    completedAtMs: number | null;
    cancelled: boolean;
    completionResult: "completed" | "no_session_detected" | null;
  }
>();

/**
 * What this mock account's tier permits (`GET /auth/me`'s `capabilities`).
 * Read-only by default - the strict case, so the "write step blocked, with
 * why" path is what a screen sees first. Tests and dev tooling flip it.
 */
export const mockAccount = { writeActions: false };
