// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { server } from "./server";
import { OverviewSchema } from "@/lib/contract/overview";
import {
  ProofSchema,
  RunDetailSchema,
  RunSummarySchema,
  TargetSchema,
} from "@/lib/contract";

/**
 * The dashboard can't contradict the pages it links to. Everything here is
 * read over HTTP, the way the pages read it: /overview is checked against
 * /runs, /runs/{id}, /targets and /proofs/{id} - not against the store the
 * mock computes from, which would only test the mock against itself.
 */
const base = "http://localhost";
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

async function get<S extends z.ZodType>(path: string, schema: S) {
  const res = await fetch(`${base}${path}`);
  expect(res.status, path).toBe(200);
  return schema.parse(await res.json());
}

const allRuns = () =>
  get(
    "/runs?limit=1000",
    z.object({ data: z.array(RunSummarySchema), next_cursor: z.null() }),
  ).then((r) => r.data);

describe("/overview reconciles with the run, target and proof pages", () => {
  it("runs_by_day: one entry per day, and its counts are exactly the terminal runs /runs lists in range", async () => {
    for (const range of ["7d", "14d", "30d"] as const) {
      const [overview, runs] = await Promise.all([
        get(`/overview?range=${range}&tz=UTC`, OverviewSchema),
        allRuns(),
      ]);
      const days = overview.runs_by_day.map((d) => d.date);
      expect(days).toHaveLength(Number(range.slice(0, -1)));
      expect(days[0]).toBe(overview.range.from);
      expect(days.at(-1)).toBe(overview.range.to);

      const inRange = new Set(days);
      const expected = { passed: 0, failed: 0, timed_out: 0, cancelled: 0 };
      for (const r of runs) {
        if (!r.finished_at || !inRange.has(r.finished_at.slice(0, 10)))
          continue;
        if (r.status in expected)
          expected[r.status as keyof typeof expected] += 1;
      }
      const sum = (k: keyof typeof expected) =>
        overview.runs_by_day.reduce((n, d) => n + d[k], 0);
      for (const k of Object.keys(expected) as (keyof typeof expected)[])
        expect(sum(k), `${range} ${k}`).toBe(expected[k]);
    }
  });

  it("targets: total, scanned and needs-attention match /targets", async () => {
    const [overview, targets] = await Promise.all([
      get("/overview?range=30d", OverviewSchema),
      get("/targets", z.array(TargetSchema)),
    ]);
    expect(overview.targets.total).toBe(targets.length);
    expect(overview.targets.scanned).toBe(
      targets.filter((t) => t.last_scan?.status === "completed").length,
    );
    expect(overview.targets.needs_attention).toBe(
      targets.filter(
        (t) =>
          t.last_scan?.status === "failed" || t.last_scan?.status === "parked",
      ).length,
    );
  });

  it("proofs: live and revoked match each run's proof", async () => {
    const [overview, runs] = await Promise.all([
      get("/overview?range=30d", OverviewSchema),
      allRuns(),
    ]);
    let live = 0;
    let revoked = 0;
    for (const r of runs) {
      if (!r.proof_id) continue;
      const proof = await get(`/proofs/${r.proof_id}`, ProofSchema);
      if (!proof.share) continue;
      if (!proof.share.enabled) revoked += 1;
      else if (
        !proof.share.expires_at ||
        new Date(proof.share.expires_at) > new Date()
      )
        live += 1;
    }
    expect(overview.proofs).toEqual({ live, revoked });
  });

  it("latest_suite_run is the run /runs/{id} shows - same status, pass rate, coverage and step counts", async () => {
    const [overview, runs] = await Promise.all([
      get("/overview?range=30d", OverviewSchema),
      allRuns(),
    ]);
    const latest = runs
      .filter((r) => r.suite_id !== null)
      .sort(
        (a, b) =>
          b.started_at.localeCompare(a.started_at) || b.id.localeCompare(a.id),
      )[0]!;
    const card = overview.latest_suite_run!;
    expect(card.run_id).toBe(latest.id);

    const run = await get(`/runs/${card.run_id}`, RunDetailSchema);
    expect(card.status).toBe(run.status);
    expect(card.pass_rate).toBe(run.pass_rate);
    expect(card.coverage).toEqual(run.coverage);
    expect(card.finished_at).toBe(run.finished_at);
    expect(card.steps).toEqual({
      passed: run.steps.filter((s) => s.status === "pass").length,
      failed: run.steps.filter((s) => s.status === "fail").length,
      skipped: run.steps.filter((s) => s.status === "skipped").length,
      total: run.steps.length,
    });
  });

  it("attention: at most 5 items, most recent first, total >= items", async () => {
    const overview = await get("/overview?range=30d", OverviewSchema);
    const { total, items } = overview.attention;
    expect(items.length).toBeLessThanOrEqual(5);
    expect(total).toBeGreaterThanOrEqual(items.length);
    const times = items.map((i) => i.occurred_at);
    expect(times).toEqual([...times].sort().reverse());
  });

  it("rejects an unknown range or time zone with a 400", async () => {
    expect((await fetch(`${base}/overview?range=90d`)).status).toBe(400);
    expect((await fetch(`${base}/overview?tz=Mars/Olympus`)).status).toBe(400);
  });
});

describe("every finished run's pass_rate is what its own steps say", () => {
  // The class of bug the old 75% fixture was: a pass rate no count of the
  // run's steps produces. Pass rate = passed / steps that RAN (skipped
  // steps didn't run), per the contract.
  it("holds for every terminal run in the fixtures", async () => {
    for (const summary of await allRuns()) {
      if (summary.pass_rate === null) continue;
      const run = await get(`/runs/${summary.id}`, RunDetailSchema);
      const ran = run.steps.filter((s) => s.status !== "skipped");
      const passed = ran.filter((s) => s.status === "pass").length;
      if (ran.length === 0) continue;
      expect(run.pass_rate, run.id).toBeCloseTo(passed / ran.length, 10);
    }
  });
});
