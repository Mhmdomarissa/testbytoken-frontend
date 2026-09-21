"use client";

import { useEffect, useRef, useState } from "react";
import { UnrecognisedValue } from "@/lib/api/tolerant";
import { StepRow, ROW_HEIGHT } from "./StepRow";
import { windowFor, type Step } from "./reconcile";

/** Above this many steps the list is windowed; below it every row is a normal, fully-wrapping row. */
export const VIRTUALIZE_AFTER = 40;
const VIEWPORT_HEIGHT = 560;
const OVERSCAN = 4;
const MAX_LISTED_FAILURES = 50;

const isBad = (s: Step) =>
  !(s.status instanceof UnrecognisedValue) &&
  (s.status === "fail" || s.status === "warning");

/**
 * The run's steps in order. Short runs render every row in the page. A long
 * run is windowed (fixed-height rows, only what is on screen mounted) so
 * watching a 5,000-step run doesn't degrade - and because windowing hides
 * text behind a scroll and a clamp, FAILED and WARNING steps are also
 * listed in full above it, so the result that matters is never only
 * readable by hovering or scrolling.
 *
 * While the run is live and the reader is at the bottom, the list follows
 * the newest step; scrolling up stops following (never fights the reader).
 */
export function StepList({ steps, live }: { steps: Step[]; live: boolean }) {
  const windowed = steps.length > VIRTUALIZE_AFTER;

  if (!windowed) {
    return (
      <ol
        aria-label="Steps"
        data-testid="step-list"
        data-windowed="false"
        className="flex flex-col border-t border-border"
      >
        {steps.map((step, i) => (
          <StepRow
            key={step.id}
            step={step}
            position={i + 1}
            total={steps.length}
            compact={false}
          />
        ))}
      </ol>
    );
  }
  return <WindowedList steps={steps} live={live} />;
}

function WindowedList({ steps, live }: { steps: Step[]; live: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const following = useRef(true);
  const bad = steps.filter(isBad);

  useEffect(() => {
    const el = ref.current;
    if (el && live && following.current) el.scrollTop = el.scrollHeight;
  }, [steps.length, live]);

  const { start, end } = windowFor({
    scrollTop,
    viewportHeight: VIEWPORT_HEIGHT,
    rowHeight: ROW_HEIGHT,
    count: steps.length,
    overscan: OVERSCAN,
  });

  return (
    <div className="flex flex-col gap-4">
      {bad.length > 0 && (
        <section
          aria-label="Failed and warning steps"
          data-testid="failures-summary"
          className="flex flex-col gap-1"
        >
          <h2 className="font-heading text-lg font-light">
            Failed and warning steps ({bad.length})
          </h2>
          <ol className="flex flex-col border-t border-border">
            {bad.slice(0, MAX_LISTED_FAILURES).map((step) => (
              <StepRow
                key={step.id}
                step={step}
                position={step.index + 1}
                total={steps.length}
                compact={false}
              />
            ))}
          </ol>
          {bad.length > MAX_LISTED_FAILURES && (
            <p className="text-sm text-muted-foreground">
              Showing the first {MAX_LISTED_FAILURES} of {bad.length}. The rest
              are in the full list below.
            </p>
          )}
        </section>
      )}

      <div>
        <p className="mb-1 text-sm text-muted-foreground">
          All {steps.length} steps. Long lists show only the rows on screen;
          scroll to see the rest.
        </p>
        <div
          ref={ref}
          role="region"
          aria-label={`All ${steps.length} steps, scrollable`}
          tabIndex={0}
          data-testid="step-list"
          data-windowed="true"
          style={{ height: VIEWPORT_HEIGHT }}
          className="overflow-y-auto border border-border focus-visible:outline-2 focus-visible:outline-ring"
          onScroll={(e) => {
            const el = e.currentTarget;
            setScrollTop(el.scrollTop);
            following.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < ROW_HEIGHT;
          }}
        >
          <ol
            aria-label="Steps"
            style={{ height: steps.length * ROW_HEIGHT, position: "relative" }}
          >
            {steps.slice(start, end).map((step, i) => (
              <StepRow
                key={step.id}
                step={step}
                position={start + i + 1}
                total={steps.length}
                compact
                style={{
                  position: "absolute",
                  top: (start + i) * ROW_HEIGHT,
                  left: 0,
                  right: 0,
                }}
              />
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
