"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";
import { useFocusRegionOnChange } from "@/hooks/useFocusRegionOnChange";

/**
 * The public route group's own main landmark, structurally guaranteeing
 * the same thing ShellMain.tsx guarantees for the console: focus moves
 * here on every client-side route change, including this component's own
 * first mount (reached by the same same-tab share link SharePanel.tsx
 * uses, not only a cold load - Phase B B10).
 *
 * A SEPARATE component from ShellMain, not a shared one, even though the
 * logic is identical: `components/shell/*` is off-limits to (public) code
 * (route-boundary.test.ts's PUBLIC_TIER) - the two-line duplication here
 * is cheaper than reworking that boundary for it. The actual shared logic
 * (useFocusRegionOnChange) already isn't duplicated.
 *
 * This is the ONLY <main> for this route group - a page under it (today,
 * only ProofView.tsx) renders its own content in a plain wrapper, not
 * another <main>, and handles its OWN in-place state-swap focus (e.g.
 * loading -> ready) on that wrapper separately; nesting two <main>
 * landmarks would be its own a11y bug.
 */
export function PublicMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useFocusRegionOnChange<HTMLElement>(pathname);

  return (
    <main ref={ref} tabIndex={-1}>
      {/* A route change crossfades the screen out and the next one in
          (the "route" view-transition class, globals.css) - two real
          screens, nothing anticipated. "update" only: nothing animates
          on first paint. The browser snapshots, React commits, and the
          focus effect above still lands on this <main> - see
          e2e/view-transitions.spec.ts. */}
      <ViewTransition default="none" update="route">
        {children}
      </ViewTransition>
    </main>
  );
}
