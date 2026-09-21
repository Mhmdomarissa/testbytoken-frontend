import { http, HttpResponse } from "msw";
import type { z } from "zod";
import { JobEventSchema, RunDetailSchema } from "@/lib/contract";
import { runStore, scanStore } from "../store";
import {
  LIVE_RUN_TIMELINES,
  LIVE_SCAN_IDS,
  elapsedMsFor,
  runEventLog,
  pendingRunEvents,
  scanEventLog,
  pendingScanEvents,
} from "../lifecycle";

type JobEvent = z.infer<typeof JobEventSchema>;

function sseFrame(event: JobEvent): string {
  return `id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** Static replay log for a run with no lifecycle (already finished). */
function staticRunEventLog(run: z.infer<typeof RunDetailSchema>): JobEvent[] {
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

/**
 * Jobs whose FIRST connection is deliberately killed mid-stream (a real
 * network error, not a clean close), so a client's reconnect-with-resume
 * can be exercised against something real. Later connections behave
 * normally. Module state: resets on a full page reload, which is what a
 * fresh browser test wants.
 */
const DROP_FIRST_CONNECTION_JOB_IDS = new Set(["run_live_drop_1"]);
const DROP_AFTER_MS = 2_000;
const alreadyDropped = new Set<string>();

/**
 * One handler for every job kind (scan or run) - both are "jobs" per the
 * contract (docs/API_CONTRACT.md), and both now have the same shape of
 * answer: a backlog of what's already happened, resumable via `?since=`,
 * plus - for anything not yet resolved - real-time delivery of what's
 * still to come, computed from the same timeline src/mocks/lifecycle.ts
 * uses for polling. A client polling GET /runs/{id} and one subscribed
 * here see the exact same progression, because both read the same clock.
 */
export const eventHandlers = [
  http.get("*/jobs/:id/events", async ({ params, request }) => {
    const jobId = params.id as string;
    const run = runStore.get(jobId);
    const scan = scanStore.get(jobId);

    if (!run && !scan) {
      return HttpResponse.json(
        { error: { code: "not_found", message: "Job not found." } },
        { status: 404 },
      );
    }

    const since = Number(
      new URL(request.url).searchParams.get("since") ?? "-1",
    );

    let backlog: JobEvent[];
    let pending: { delayMs: number; event: JobEvent }[];

    if (run && LIVE_RUN_TIMELINES.has(run.id)) {
      const timeline = LIVE_RUN_TIMELINES.get(run.id)!;
      const elapsed = elapsedMsFor(run.id);
      backlog = runEventLog(timeline, elapsed);
      pending = pendingRunEvents(timeline, elapsed);
    } else if (run) {
      backlog = staticRunEventLog(run);
      pending = [];
    } else {
      const elapsed = elapsedMsFor(jobId);
      backlog = scanEventLog(elapsed);
      pending = LIVE_SCAN_IDS.has(jobId) ? pendingScanEvents(elapsed) : [];
    }

    backlog = backlog.filter((e) => Number(e.id) > since);

    // Declared before the ReadableStream below, not after: `start()` runs
    // synchronously inside the ReadableStream constructor (per the streams
    // spec), so a `const` declared after the constructor call would still
    // be in its temporal dead zone when `start()` tries to use it.
    const timers: ReturnType<typeof setTimeout>[] = [];

    const stream = new ReadableStream({
      cancel() {
        for (const t of timers) clearTimeout(t);
      },
      start(controller) {
        for (const event of backlog) {
          controller.enqueue(encoder.encode(sseFrame(event)));
        }

        if (pending.length === 0) {
          // Nothing left to happen (already resolved, or a static
          // finished job). Known simplification: a real EventSource will
          // attempt to reconnect on close, get an empty backlog (since is
          // already caught up), and close again - harmless, if slightly
          // noisy, until the client explicitly stops watching a job whose
          // last event was `done`.
          controller.close();
          return;
        }

        const dropThisConnection =
          DROP_FIRST_CONNECTION_JOB_IDS.has(jobId) &&
          !alreadyDropped.has(jobId);
        if (dropThisConnection) alreadyDropped.add(jobId);

        for (const { delayMs, event } of pending) {
          // A dropped connection never delivers what would have arrived
          // after the drop - the client has to get it via ?since=.
          if (dropThisConnection && delayMs >= DROP_AFTER_MS) continue;
          const t = setTimeout(() => {
            controller.enqueue(encoder.encode(sseFrame(event)));
            if (event.type === "done") controller.close();
          }, delayMs);
          timers.push(t);
        }

        if (dropThisConnection) {
          timers.push(
            setTimeout(() => {
              controller.error(new Error("simulated connection drop"));
            }, DROP_AFTER_MS),
          );
        }

        request.signal.addEventListener("abort", () => {
          for (const t of timers) clearTimeout(t);
        });
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
