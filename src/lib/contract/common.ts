import "./zod-openapi-setup";
import { z } from "zod";

/**
 * Shared primitives. Every resource schema in this directory builds on
 * these rather than redefining id/timestamp/error shapes inline - see
 * docs/API_CONTRACT.md for the id-prefix convention this implies.
 */

export const IdSchema = z
  .string()
  .min(1)
  .openapi({
    description:
      "Opaque resource id. Recommended (not enforced) convention: a short " +
      "type prefix plus a random suffix, e.g. `run_8f2a1c9d` - self-describing " +
      "in logs, cheap for the engine to generate.",
    example: "run_8f2a1c9d",
  });

export const TimestampSchema = z.iso.datetime().openapi({
  description: "ISO 8601 UTC timestamp.",
  example: "2026-09-16T14:32:00Z",
});

export const EnvironmentSchema = z
  .enum(["dev", "test", "staging", "production"])
  .openapi({ description: "Named environment a target belongs to." });

export const ErrorSchema = z
  .object({
    error: z.object({
      code: z.string().openapi({
        description: "Stable machine-readable error code, e.g. `not_found`.",
        example: "not_found",
      }),
      message: z.string().openapi({
        description: "Human-readable message. Safe to show to the customer.",
      }),
      details: z.unknown().optional().openapi({
        description: "Optional structured detail, error-specific.",
      }),
    }),
  })
  .openapi("Error");

export const PaginationQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .openapi({ description: "Max items to return." }),
  cursor: z.string().optional().openapi({
    description:
      "Opaque cursor from a previous response's `next_cursor`. Omit for the first page.",
  }),
});

export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    next_cursor: z.string().nullable().openapi({
      description:
        "Pass as `cursor` to fetch the next page. `null` on the last page.",
    }),
  });
}
