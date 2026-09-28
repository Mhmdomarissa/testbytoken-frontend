"use client";

import { useEffect, useState } from "react";

// Mock-backed build? Written out here, not imported: Next inlines
// process.env.NEXT_PUBLIC_* only at the use site, and only then can the
// build drop the mock-only code below (docs/DEPLOYMENT.md).
const MOCKING = process.env.NEXT_PUBLIC_API_MOCKING === "on";

/**
 * Starts the MSW browser worker when the build has mocking on
 * (NEXT_PUBLIC_API_MOCKING=on: `next dev`, via .env.development, and the
 * demo deployment) and holds rendering until it's actually ready. In a
 * build with mocking off, MOCKING is the constant `false`, so the effect's
 * body - and the dynamic import of the mock layer in it - is removed from
 * the output entirely (scripts/check-mocks-in-build.mjs proves it), and
 * children render at once.
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
 * entirely, at the cost of a brief blank frame while the worker starts -
 * in the demo's production build too (e2e/cold-start.spec.ts runs against
 * it: `npm run test:e2e:prod`).
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
  const [ready, setReady] = useState(!MOCKING);

  useEffect(() => {
    if (!MOCKING) return;
    const startPromise = (mockingReadyPromise ??= import("./browser").then(
      ({ worker }) =>
        worker.start({
          onUnhandledRequest: "bypass",
          // No "[MSW] Mocking enabled" banner in the demo's console.
          quiet: process.env.NODE_ENV === "production",
        }),
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
