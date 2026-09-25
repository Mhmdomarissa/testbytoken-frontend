import type { z } from "zod";
import type { OverviewSchema } from "@/lib/contract/overview";
import type { RunDetailSchema, TargetSchema } from "@/lib/contract";
import { resolveRun } from "./lifecycle";
import { resolveLoginSession } from "./login";
import { loginSessionStore, proofStore, runStore, targetStore } from "./store";
import { withLastScan } from "./handlers/targets";

type Overview = z.input<typeof OverviewSchema>;
type Run = z.infer<typeof RunDetailSchema>;
type Target = z.infer<typeof TargetSchema>;

export const RANGE_DAYS = { "7d": 7, "14d": 14, "30d": 30 } as const;
export type Range = keyof typeof RANGE_DAYS;

const KNOWN_TERMINAL = ["passed", "failed", "timed_out", "cancelled"] as const;
const TERMINAL = new Set<string>(KNOWN_TERMINAL);

/** Throws on an unknown IANA zone (the handler turns that into a 400). */
export function dayFormatter(tz: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** The `days` calendar dates ending today in `tz`, oldest first. */
export function dayRange(now: Date, days: number, tz: string): string[] {
  const [y, m, d] = dayFormatter(tz).format(now).split("-").map(Number);
  const today = Date.UTC(y!, m! - 1, d!);
  return Array.from({ length: days }, (_, i) =>
    new Date(today - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10),
  );
}

function reasonFor(run: Run): string {
  if (run.status === "timed_out")
    return "The engine went silent before the run finished.";
  const i = run.steps.findIndex((s) => s.status === "fail");
  if (i === -1) return "The run failed.";
  return `Step ${i + 1} of ${run.steps.length} failed: ${run.steps[i]!.message}`;
}

/**
 * The mock's /overview, computed from the same stores - resolved through
 * the same functions - that /runs, /targets and the proof pages read, so
 * the dashboard can't contradict the pages it links to
 * (src/mocks/overview.test.ts reconciles them).
 */
export function computeOverview(now: Date, range: Range, tz: string): Overview {
  const days = dayRange(now, RANGE_DAYS[range], tz);
  const inRange = new Set(days);
  const dayOf = (iso: string) => dayFormatter(tz).format(new Date(iso));

  const runs: Run[] = [...runStore.values()].map(resolveRun);
  const targets: Target[] = [...targetStore.values()].map(withLastScan);
  const targetName = (id: string) =>
    targets.find((t) => t.id === id)?.name ?? id;

  // Runs by day: terminal runs only, bucketed by the day they finished.
  const byDay = new Map(
    days.map((date) => [
      date,
      { date, passed: 0, failed: 0, timed_out: 0, cancelled: 0, other: 0 },
    ]),
  );
  for (const r of runs) {
    if (!r.finished_at) continue;
    if (r.status === "queued" || r.status === "running") continue;
    const bucket = byDay.get(dayOf(r.finished_at));
    if (!bucket) continue;
    if (TERMINAL.has(r.status))
      bucket[r.status as (typeof KNOWN_TERMINAL)[number]] += 1;
    else bucket.other += 1;
  }

  // Latest suite run: the most recently STARTED run that came from a suite.
  const latest = runs
    .filter((r) => r.suite_id !== null)
    .sort(
      (a, b) =>
        b.started_at.localeCompare(a.started_at) || b.id.localeCompare(a.id),
    )[0];

  // Proofs: live = shared, enabled, not expired; revoked = share disabled.
  let live = 0;
  let revoked = 0;
  for (const p of proofStore.values()) {
    if (!p.share) continue;
    if (!p.share.enabled) revoked += 1;
    else if (!p.share.expires_at || new Date(p.share.expires_at) > now)
      live += 1;
  }

  // Attention: failed / timed-out runs in range, failed scans (current),
  // sign-in sessions that expired in range. Most recent first.
  type Item = Overview["attention"]["items"][number];
  const items: Item[] = [];
  for (const r of runs) {
    if (!r.finished_at || !inRange.has(dayOf(r.finished_at))) continue;
    if (r.status !== "failed" && r.status !== "timed_out") continue;
    items.push({
      kind: r.status === "failed" ? "run_failed" : "run_timed_out",
      ref_id: r.id,
      target_id: r.target_id,
      target_name: targetName(r.target_id),
      reason: reasonFor(r),
      occurred_at: r.finished_at,
    });
  }
  for (const t of targets) {
    const scan = t.last_scan;
    if (!scan || scan.status !== "failed") continue;
    items.push({
      kind: "scan_failed",
      ref_id: scan.id,
      target_id: t.id,
      target_name: t.name,
      reason: scan.failure?.message ?? "The scan failed.",
      occurred_at: scan.updated_at,
    });
  }
  for (const id of loginSessionStore.keys()) {
    const s = resolveLoginSession(id);
    if (!s || s.status !== "expired" || !inRange.has(dayOf(s.expires_at)))
      continue;
    items.push({
      kind: "login_expired",
      ref_id: s.id,
      target_id: s.target_id,
      target_name: targetName(s.target_id),
      reason: "The sign-in session expired before it was completed.",
      occurred_at: s.expires_at,
    });
  }
  items.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  return {
    range: { from: days[0]!, to: days[days.length - 1]!, tz },
    generated_at: now.toISOString(),
    runs_by_day: [...byDay.values()],
    latest_suite_run: latest
      ? {
          run_id: latest.id,
          suite_id: latest.suite_id!,
          target_id: latest.target_id,
          target_name: targetName(latest.target_id),
          status: latest.status,
          pass_rate: latest.pass_rate,
          coverage: latest.coverage,
          steps: {
            passed: latest.steps.filter((s) => s.status === "pass").length,
            failed: latest.steps.filter((s) => s.status === "fail").length,
            skipped: latest.steps.filter((s) => s.status === "skipped").length,
            total: latest.steps.length,
          },
          finished_at: latest.finished_at,
        }
      : null,
    targets: {
      total: targets.length,
      scanned: targets.filter((t) => t.last_scan?.status === "completed")
        .length,
      needs_attention: targets.filter(
        (t) =>
          t.last_scan?.status === "failed" || t.last_scan?.status === "parked",
      ).length,
    },
    proofs: { live, revoked },
    attention: { total: items.length, items: items.slice(0, 5) },
  };
}
