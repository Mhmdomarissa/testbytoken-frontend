import "./zod-openapi-setup";
import { z } from "zod";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  ErrorSchema,
  extensibleEnum,
  IdSchema,
  TimestampSchema,
} from "./common";
import { CoverageSchema, RunStatusSchema } from "./runs";

/**
 * UI v2 V2: the console overview. ADDITIVE and REQUIRED. Every field is a
 * count or a lookup of data the backend already stores (runs, targets,
 * scans, proofs, login sessions) - no new tracking.
 *
 * It exists so the dashboard never aggregates a paginated list: every
 * number on it is one the server computed over the whole workspace.
 */

const DateSchema = z.iso.date().openapi({
  description: "A calendar date (YYYY-MM-DD) in the response's `range.tz`.",
  example: "2026-09-25",
});

const CountSchema = z.number().int().min(0);

export const OverviewRangeSchema = extensibleEnum(
  ["7d", "14d", "30d"],
  "How many days back, including today.",
);

const RunsByDaySchema = z
  .object({
    date: DateSchema,
    passed: CountSchema,
    failed: CountSchema,
    timed_out: CountSchema,
    cancelled: CountSchema,
    other: CountSchema.openapi({
      description:
        "Terminal runs whose status is none of the four above (e.g. a status added after this client). Never dropped; the UI shows them as unrecognised.",
    }),
  })
  .openapi("OverviewRunsByDay");

export const OverviewLatestSuiteRunSchema = z
  .object({
    run_id: IdSchema,
    suite_id: IdSchema,
    target_id: IdSchema,
    target_name: z.string(),
    status: RunStatusSchema,
    pass_rate: z.number().min(0).max(1).nullable().openapi({
      description:
        "Same rule as `Run.pass_rate`: null unless `status` is terminal, and a client MUST NOT render it for a status it does not recognise as terminal.",
    }),
    coverage: CoverageSchema.openapi({
      description:
        "The run's own coverage, the same object as `Run.coverage` - so the pass rate and its coverage render together through the same component everywhere.",
    }),
    steps: z
      .object({
        passed: CountSchema,
        failed: CountSchema,
        skipped: CountSchema,
        total: CountSchema.openapi({
          description:
            "Every step of the run. May exceed passed + failed + skipped (warnings, steps still running); the UI shows the difference as other.",
        }),
      })
      .openapi("OverviewStepCounts"),
    finished_at: TimestampSchema.nullable(),
  })
  .openapi("OverviewLatestSuiteRun");

export const OverviewAttentionKindSchema = extensibleEnum(
  ["run_failed", "run_timed_out", "scan_failed", "login_expired"],
  "What needs attention. `run_failed` / `run_timed_out`: a run that ended so, in range (`ref_id` is the run). `scan_failed`: a target whose latest scan failed (`ref_id` is the scan). `login_expired`: a sign-in session that expired before it completed, in range (`ref_id` is the session).",
);

export const OverviewSchema = z
  .object({
    range: z.object({
      from: DateSchema,
      to: DateSchema,
      tz: z.string().openapi({
        description: "The IANA zone days are bucketed in.",
        example: "Europe/Istanbul",
      }),
    }),
    generated_at: TimestampSchema,
    runs_by_day: z.array(RunsByDaySchema).openapi({
      description:
        "Terminal runs only - queued and running are not counted - bucketed by the day each FINISHED, in `range.tz`. Exactly one entry per day from `range.from` to `range.to`, zero days included, oldest first.",
    }),
    latest_suite_run: OverviewLatestSuiteRunSchema.nullable().openapi({
      description:
        "The most recently STARTED suite run (any status), or null if there has never been one.",
    }),
    targets: z.object({
      total: CountSchema,
      scanned: CountSchema.openapi({
        description: "Targets whose latest scan completed.",
      }),
      needs_attention: CountSchema.openapi({
        description:
          "Targets whose latest scan failed or is waiting for a sign-in.",
      }),
    }),
    proofs: z.object({
      live: CountSchema.openapi({
        description: "Proofs shared, enabled and not expired.",
      }),
      revoked: CountSchema.openapi({
        description: "Proofs whose share was revoked (disabled).",
      }),
    }),
    attention: z.object({
      total: CountSchema,
      items: z
        .array(
          z
            .object({
              kind: OverviewAttentionKindSchema,
              ref_id: IdSchema,
              target_id: IdSchema,
              target_name: z.string(),
              reason: z.string().openapi({
                description:
                  "Server-provided one-line reason. Untrusted - it can carry text from the tested site; render as text.",
              }),
              occurred_at: TimestampSchema,
            })
            .openapi("OverviewAttentionItem"),
        )
        .max(5)
        .openapi({ description: "Most recent first, at most 5." }),
    }),
  })
  .openapi("Overview");

export function registerOverviewPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/overview",
    tags: ["overview"],
    summary: "The console dashboard's numbers, computed server-side",
    description:
      "REQUIRED (UI v2 V2), additive. Every field is a count or a lookup of stored data. The dashboard renders only this - it never aggregates a paginated list.",
    security: [{ cookieAuth: [] }],
    request: {
      query: z.object({
        range: OverviewRangeSchema.default("7d"),
        tz: z
          .string()
          .default("UTC")
          .openapi({ description: "IANA zone for day buckets. Default UTC." }),
      }),
    },
    responses: {
      200: {
        description: "The overview.",
        content: { "application/json": { schema: OverviewSchema } },
      },
      400: {
        description: "Unknown `range` or `tz`.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });
}
