"use client";

import { useState } from "react";
import { useJobEvents } from "@/lib/api/sse/useJobEvents";
import { isUnrecognised } from "@/lib/api/tolerant";

/** Plain, unstyled readout of everything the hook exposes - the assertions in e2e/job-events.spec.ts read these. */
export function JobEventsHarness({ jobId }: { jobId: string | undefined }) {
  const events = useJobEvents(jobId);

  // Every distinct connection status ever shown, in order - a dropped
  // connection that flickers "reconnecting" for 40ms is still a state the
  // user was shown, and the test needs to see that it happened. Adjusting
  // state during render (React's documented pattern), not in an effect.
  const [seen, setSeen] = useState<string[]>([]);
  if (seen[seen.length - 1] !== events.connectionStatus) {
    setSeen([...seen, events.connectionStatus]);
  }

  const steps = Object.values(events.steps).sort((a, b) => a.index - b.index);

  return (
    <main className="p-6 font-mono text-sm">
      <h1>useJobEvents harness (dev only)</h1>
      <p>
        job: <span data-testid="job">{jobId ?? "(none)"}</span>
      </p>
      <p>
        connection:{" "}
        <span data-testid="connection">{events.connectionStatus}</span>
      </p>
      <p>
        connection history: <span data-testid="history">{seen.join(",")}</span>
      </p>
      <p>
        reconnects:{" "}
        <span data-testid="reconnects">{events.reconnectCount}</span>
      </p>
      <p>
        job status:{" "}
        <span data-testid="status">
          {events.status === null
            ? "(none)"
            : isUnrecognised(events.status)
              ? `unrecognised:${events.status.raw}`
              : events.status}
        </span>
      </p>
      <p>
        last event id:{" "}
        <span data-testid="last-event-id">
          {events.lastEventId ?? "(none)"}
        </span>
      </p>
      <p>
        unreadable frames:{" "}
        <span data-testid="unreadable">{events.unreadableFrameCount}</span>
      </p>
      <ol data-testid="steps">
        {steps.map((step) => (
          <li key={step.index} data-testid={`step-${step.index}`}>
            {step.index}:
            {isUnrecognised(step.status) ? "unrecognised" : step.status}
          </li>
        ))}
      </ol>
    </main>
  );
}
