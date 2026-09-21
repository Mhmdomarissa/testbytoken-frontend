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

/**
 * B0.5 B5: every enum in this contract is EXTENSIBLE. The server may add
 * members at any time; clients MUST tolerate unknown ones (render them as
 * "unrecognised", never drop the record or fail the response - Phase B
 * section 1.1). The clause is stated once here and appended to every enum's
 * description, and marked machine-readably with `x-extensible-enum`, so an
 * implementer reading any single enum in openapi.json sees it.
 */
export const EXTENSIBLE_ENUM_NOTE =
  "Extensible: new members MAY be added without a version bump. Clients " +
  "MUST tolerate unknown members - render them as unrecognised, never " +
  "drop the record or fail the response.";

export function extensibleEnum<const T extends readonly [string, ...string[]]>(
  values: T,
  description: string,
) {
  return z.enum(values).openapi({
    description: `${description} ${EXTENSIBLE_ENUM_NOTE}`,
    "x-extensible-enum": true,
  });
}

export const EnvironmentSchema = extensibleEnum(
  ["dev", "test", "staging", "production"],
  "Named environment a target belongs to.",
);

/**
 * B0.5 B5: ONE vocabulary for the state of a job (a scan or a run). Scan
 * and run statuses are subsets of it (`.extract`), and `JobEvent.status` /
 * `done.status` use the whole thing - previously the events carried bare
 * strings while the resources carried closed enums: same concept, two
 * representations, and a client had no way to know they agreed.
 */
export const JobStatusSchema = extensibleEnum(
  [
    "queued",
    "crawling",
    "parked",
    "running",
    "completed",
    "passed",
    "failed",
    "cancelled",
    "timed_out",
  ],
  "State of a job (a scan or a run). Scan statuses are queued, crawling, " +
    "parked, completed, failed; run statuses are queued, running, passed, " +
    "failed, cancelled, timed_out.",
);

/**
 * B0.5 B2: the ordering key of a job's event stream. Numeric monotonic
 * sequence, NOT an opaque string and NOT a ULID - see docs/API_CONTRACT.md
 * "Event ordering". Canonical decimal only, so the schema itself rejects
 * anything a client could mis-order.
 */
const EVENT_ID_PATTERN = /^(0|[1-9][0-9]*)$/;

/**
 * The comparison the contract specifies, in one place: an event id's
 * numeric value, or null if it is not a canonical id. Numeric comparison of
 * canonical decimal integers is a TOTAL order (no ties between distinct
 * ids, no incomparable pairs) - which is the whole point of specifying the
 * format. `null` is "not an id", never "newest".
 */
export function eventIdValue(id: string): number | null {
  if (!EVENT_ID_PATTERN.test(id)) return null;
  const n = Number(id);
  return Number.isSafeInteger(n) ? n : null;
}

export const EventIdSchema = z
  .string()
  .regex(EVENT_ID_PATTERN)
  .refine((v) => eventIdValue(v) !== null, {
    message: "event id must not exceed 2^53 - 1",
  })
  .openapi({
    type: "string",
    pattern: "^(0|[1-9][0-9]*)$",
    description:
      "Position in the job's event sequence: a non-negative integer in " +
      "canonical decimal form (no sign, no leading zeros, at most " +
      "9007199254740991), STRICTLY increasing within a job. Compare " +
      "numerically. Gaps are permitted; reordering and reuse are not. " +
      "Pass the last-seen value as `?since=` to resume - events with a " +
      "greater id are delivered.",
    example: "42",
  });

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
