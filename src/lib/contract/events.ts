import "./zod-openapi-setup";
import { z } from "zod";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  EventIdSchema,
  IdSchema,
  JobStatusSchema,
  TimestampSchema,
  extensibleEnum,
} from "./common";
import { StepSchema } from "./runs";

/**
 * Every long-running operation (scan, run) is a "job" that emits events
 * over SSE, resumable from a last-seen event id via `?since=`.
 *
 * OpenAPI has no first-class representation of an SSE stream - this
 * registers the endpoint with `text/event-stream` and documents the wire
 * framing in the description; JobEventSchema is the payload carried in
 * each frame's `data:` line, kept as a real component so it's still
 * generated, typed, and validated like everything else.
 */

/**
 * Heartbeat interval, fixed by this contract (B0.5 B3). A constant, not a
 * negotiation: 15 seconds. `heartbeat.interval_ms` repeats it on the wire so
 * a frame is self-describing, and so a future change is visible to clients.
 */
export const HEARTBEAT_INTERVAL_MS = 15_000;

export const JobEventSchema = z
  .discriminatedUnion("type", [
    z.object({
      id: EventIdSchema,
      type: z.literal("status"),
      status: JobStatusSchema.openapi({
        description:
          "New job-level status (B0.5 B5: the same JobStatus vocabulary as " +
          "the Scan and Run resources, no longer a bare string).",
      }),
    }),
    z.object({
      id: EventIdSchema,
      type: z.literal("progress"),
      message: z.string().nullable(),
      percent: z.number().min(0).max(100).nullable(),
    }),
    z.object({
      id: EventIdSchema,
      type: z.literal("step"),
      step: StepSchema,
    }),
    z.object({
      id: EventIdSchema,
      type: z.literal("log"),
      level: extensibleEnum(["info", "warning", "error"], "Log severity."),
      message: z.string(),
    }),
    z.object({
      id: EventIdSchema,
      type: z.literal("done"),
      status: JobStatusSchema.openapi({
        description:
          "Terminal job status. The server closes the stream after this " +
          "frame; a client MUST NOT reconnect to a job it has received " +
          "`done` for.",
      }),
    }),
    z.object({
      type: z.literal("heartbeat"),
      at: TimestampSchema,
      interval_ms: z
        .number()
        .int()
        .min(1)
        .openapi({
          description: `Always ${HEARTBEAT_INTERVAL_MS} in this version of the contract.`,
        }),
    }),
  ])
  .openapi("JobEvent");

export const EventsQuerySchema = z.object({
  since: z.string().optional().openapi({
    description: "Last-seen event id. Resume the stream after this event.",
  }),
});

const JobIdParam = z.object({ id: IdSchema });

export function registerEventPaths(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/jobs/{id}/events",
    tags: ["events"],
    summary: "Subscribe to a job's events (SSE)",
    description:
      "Server-Sent Events. Each frame is `id: <event id>\\ndata: <JobEvent JSON>\\n\\n`, " +
      "except `heartbeat`, which has no `id:` line (it is not part of the job's " +
      "event sequence and never advances `Last-Event-ID` / `?since=`). " +
      "HEARTBEAT (B0.5 B3, required): the server MUST send a `heartbeat` " +
      "frame every 15 seconds for as long as the stream is open, whether or " +
      "not the job is doing anything. A client that has received no frame " +
      "of any kind for 2.5x the interval (37.5s) can therefore conclude the " +
      "connection is dead, not merely that the job is quiet - the two are " +
      "distinguishable facts. " +
      "EVENT ORDERING (B0.5 B2, required): frame ids are the numeric " +
      "`EventId` sequence; deliver in increasing order, never reuse. " +
      "Reconnect with `?since=<last-seen id>` to resume without re-delivering " +
      "earlier events. Authenticated by cookie (EventSource sends it " +
      "automatically, same-origin) - DEPLOYMENT REQUIREMENT: the API must be " +
      "served from a sibling subdomain of the app (e.g. app.<domain> / " +
      "api.<domain>), cookie scoped to the parent domain, so this is same-site " +
      "and EventSource needs no special handling. Never a token in the query " +
      "string - see docs/API_CONTRACT.md.",
    security: [{ cookieAuth: [] }],
    request: { params: JobIdParam, query: EventsQuerySchema },
    responses: {
      200: {
        description: "An open SSE stream of JobEvent frames.",
        content: { "text/event-stream": { schema: JobEventSchema } },
      },
    },
  });
}
