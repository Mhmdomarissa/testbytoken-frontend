import { http, HttpResponse } from "msw";
import type { z } from "zod";
import { JobEventSchema } from "@/lib/contract";
import { runs, runStreaming } from "../data";

type JobEvent = z.infer<typeof JobEventSchema>;

function sseFrame(event: JobEvent): string {
  return `id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** Static replay log for a finished (or currently-known) run's steps. */
function eventLogFor(run: (typeof runs)[number]): JobEvent[] {
  const events: JobEvent[] = run.steps.map((s, i) => ({
    id: String(i),
    type: "step",
    step: s,
  }));
  if (run.finished_at) {
    events.push({
      id: String(events.length),
      type: "done",
      status: run.status,
    });
  }
  return events;
}

const encoder = new TextEncoder();

export const eventHandlers = [
  http.get("*/jobs/:id/events", async ({ params, request }) => {
    const run = runs.find((r) => r.id === params.id);
    if (!run) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Job not found." } },
        { status: 404 },
      );
    }

    const since = Number(
      new URL(request.url).searchParams.get("since") ?? "-1",
    );
    const log = eventLogFor(run);
    const backlog = log.filter((e) => Number(e.id) > since);

    const isLive = run.id === runStreaming.id;
    let timer: ReturnType<typeof setInterval> | undefined;

    const stream = new ReadableStream({
      cancel() {
        // Fires when the reader is cancelled directly - distinct from
        // request.signal's "abort" below, which only covers the
        // underlying HTTP request being aborted (the real-EventSource
        // case). Without this, a direct reader.cancel() leaks the timer.
        clearInterval(timer);
      },
      start(controller) {
        for (const event of backlog) {
          controller.enqueue(encoder.encode(sseFrame(event)));
        }

        if (!isLive) {
          // Finished job: the backlog is the whole story. Closing here is a
          // known simplification for a mock server - a real EventSource
          // will attempt to reconnect on close, get an empty backlog
          // (since is already caught up), and close again. Harmless, if
          // slightly noisy, until the real client explicitly stops
          // watching a job whose last event was `done`.
          controller.close();
          return;
        }

        // The one "still running" job: keep emitting synthetic step
        // events so the SSE path has something live to exercise in dev.
        let index = log.length;
        timer = setInterval(() => {
          index += 1;
          const event: JobEvent = {
            id: String(index),
            type: "step",
            step: {
              index,
              action: index % 2 === 0 ? "click" : "assert_visible",
              target: `#step-${index}`,
              assertion: null,
              status: "pass",
              message: "OK",
              duration_ms: 380,
              screenshot_url: null,
            },
          };
          controller.enqueue(encoder.encode(sseFrame(event)));

          if (index >= log.length + 5) {
            const done: JobEvent = {
              id: String(index + 1),
              type: "done",
              status: "passed",
            };
            controller.enqueue(encoder.encode(sseFrame(done)));
            clearInterval(timer);
            controller.close();
          }
        }, 1500);

        request.signal.addEventListener("abort", () => clearInterval(timer));
      },
    });

    return new HttpResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }),
];
