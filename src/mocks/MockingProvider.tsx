"use client";

import { useEffect } from "react";

/**
 * Starts the MSW browser worker in development. There is no backend yet,
 * so this is unconditional for now - once a real backend exists, gate this
 * on an env flag (e.g. NEXT_PUBLIC_API_MOCKING) rather than removing it,
 * so mocks stay available for offline/demo work.
 *
 * Known limitation: `worker.start()` is async and this runs in a client
 * component effect, so it is not guaranteed to be ready before the very
 * first render's effects fire. Next.js's instrumentation-client.ts can't
 * fix this either - the framework explicitly documents that async work
 * started there isn't awaited before hydration. Harmless today (Phase A
 * has no screens making real fetch calls yet); worth re-checking once a
 * real data-fetching layer lands in a later phase.
 *
 * Module-level guard, not a ref: React's Strict Mode double-invokes this
 * effect in development, and calling `worker.start()` a second time on an
 * already-enabled MSW network throws ("cannot configure an already
 * enabled network") - a real error a component-scoped guard wouldn't
 * catch, since Strict Mode unmounts and remounts with a fresh instance.
 */
let startedMocking = false;

export function MockingProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || startedMocking) return;
    startedMocking = true;
    void import("./browser").then(({ worker }) =>
      worker.start({ onUnhandledRequest: "bypass" }),
    );
  }, []);

  return <>{children}</>;
}
