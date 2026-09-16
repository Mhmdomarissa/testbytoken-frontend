import "./zod-openapi-setup";
import { z } from "zod";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { ErrorSchema, IdSchema, TimestampSchema } from "./common";

/**
 * A suite is the generated test suite for a target - the output of a scan
 * plus inspect passes, turned into runnable scenarios. It's versioned:
 * re-scanning a target produces a new version rather than mutating history
 * a customer might be mid-run against.
 */

export const SuiteSchema = z
  .object({
    id: IdSchema,
    target_id: IdSchema,
    name: z.string(),
    latest_version: z.number().int().min(1),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
  })
  .openapi("Suite");

export const SuiteVersionSchema = z
  .object({
    id: IdSchema,
    suite_id: IdSchema,
    version: z.number().int().min(1),
    source_scan_id: IdSchema.openapi({
      description: "The scan whose crawl produced this version.",
    }),
    scenario_count: z.number().int().min(0),
    created_at: TimestampSchema,
  })
  .openapi("SuiteVersion");

const SuiteIdParam = z.object({ id: IdSchema });

export function registerSuitePaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/suites",
    tags: ["suites"],
    summary: "List suites",
    description:
      "Unpaginated - suites are one-per-target, not expected to grow unbounded like runs.",
    security: [{ cookieAuth: [] }],
    responses: {
      200: {
        description: "All suites.",
        content: { "application/json": { schema: z.array(SuiteSchema) } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/suites/{id}",
    tags: ["suites"],
    summary: "Get a suite",
    security: [{ cookieAuth: [] }],
    request: { params: SuiteIdParam },
    responses: {
      200: {
        description: "The suite.",
        content: { "application/json": { schema: SuiteSchema } },
      },
      404: {
        description: "Not found.",
        content: { "application/json": { schema: ErrorSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/suites/{id}/versions",
    tags: ["suites"],
    summary: "List a suite's versions, newest first",
    security: [{ cookieAuth: [] }],
    request: { params: SuiteIdParam },
    responses: {
      200: {
        description: "Version history.",
        content: {
          "application/json": { schema: z.array(SuiteVersionSchema) },
        },
      },
    },
  });
}
