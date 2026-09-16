import "./zod-openapi-setup";
import { z } from "zod";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { IdSchema } from "./common";
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

export const JobEventSchema = z
  .discriminatedUnion("type", [
    z.object({
      id: z.string().openapi({
        description:
          "Monotonically increasing within the job; pass the last-seen value as `?since=` to resume.",
      }),
      type: z.literal("status"),
      status: z.string().openapi({
        description:
          "New job-level status, e.g. a ScanStatus or RunStatus value.",
      }),
    }),
    z.object({
      id: z.string(),
      type: z.literal("progress"),
      message: z.string().nullable(),
      percent: z.number().min(0).max(100).nullable(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("step"),
      step: StepSchema,
    }),
    z.object({
      id: z.string(),
      type: z.literal("log"),
      level: z.enum(["info", "warning", "error"]),
      message: z.string(),
    }),
    z.object({
      id: z.string(),
      type: z.literal("done"),
      status: z.string(),
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
      "Server-Sent Events. Each frame is `id: <event id>\\ndata: <JobEvent JSON>\\n\\n`. " +
      "Reconnect with `?since=<last-seen id>` to resume without re-delivering " +
      "earlier events. Authentication for this endpoint is an open decision - " +
      "see docs/API_CONTRACT.md.",
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
