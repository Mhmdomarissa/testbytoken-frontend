"use client";

import { useEffect, useState } from "react";

/**
 * Starts the MSW browser worker in development and holds rendering until
 * it's actually ready. There is no backend yet, so this is unconditional
 * for now - once a real backend exists, gate this on an env flag (e.g.
 * NEXT_PUBLIC_API_MOCKING) rather than removing it, so mocks stay
 * available for offline/demo work.
 *
 * This used to fire-and-forget `worker.start()` from an effect and render
 * children immediately. That raced any component that fetches on mount
 * (e.g. the sidebar's engine status card): on a fresh load, the first fetch could reach
 * the real network before the service worker had registered, get a real
 * 404 from the Next dev server, and - since useResource only fetches once
 * per mount, not on an interval - stay wrong until the user manually hit
 * retry. Confirmed by driving the actual shell in a browser and watching
 * the workspace pill get stuck on "Engine unreachable" after a hard
 * reload. Blocking on the real start() promise here removes the race
 * entirely, at the cost of a brief blank frame in dev only.
 *
 * Module-level promise, not per-component state: React's Strict Mode
 * double-invokes this effect in development, and calling `worker.start()`
 * a second time on an already-enabled MSW network throws ("cannot
 * configure an already enabled network"). Sharing one promise across
 * mounts means the second (Strict-Mode-remounted) instance awaits the
 * same startup instead of starting a second one.
 */
let mockingReadyPromise: Promise<unknown> | undefined;

export function MockingProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(process.env.NODE_ENV !== "development");

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const startPromise = (mockingReadyPromise ??= import("./browser").then(
      ({ worker }) => worker.start({ onUnhandledRequest: "bypass" }),
    ));
    let cancelled = false;
    void startPromise.then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;

  return <>{children}</>;
}
