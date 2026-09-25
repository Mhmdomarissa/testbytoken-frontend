/** On only when the build sets NEXT_PUBLIC_API_MOCKING=on (docs/PHASE_DEPLOY.md, D1). */
export const DEMO_MODE = process.env.NEXT_PUBLIC_API_MOCKING === "on";

/**
 * The deploy brief's D2 banner - the "Demo - simulated data" marker from
 * docs/DEV_ONLY_IN_PRODUCTION.md. One component, in the root layout, so it
 * is on every screen: the console, sign-in, the landing and the public
 * proof pages. A server component with no client JavaScript; sticky, not
 * dismissible. Built in UI v2 V1 so the layout already makes room for it
 * (`--demo-banner-h`); it stays off until the deploy work adds the flag.
 */
export function DemoBanner() {
  if (!DEMO_MODE) return null;
  return (
    <div
      role="note"
      aria-label="Demonstration"
      className="sticky top-0 z-50 flex h-(--demo-banner-h) shrink-0 items-center justify-center gap-2 border-b border-border bg-(--status-warning-tint) px-4 text-xs text-foreground sm:text-sm"
    >
      {/* A plain SVG, not a lucide-react icon: lucide ships as client code,
          and importing it here (the root layout) put its runtime on every
          route - about 2.5 KB, measured - banner on or off. */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-4 shrink-0 text-(--status-warning-fg)"
      >
        <path d="M10 2v7.31L4.5 19a2 2 0 0 0 1.74 3h11.52A2 2 0 0 0 19.5 19L14 9.31V2" />
        <path d="M8.5 2h7M7 16h10" />
      </svg>
      <p className="truncate">
        <strong className="font-semibold">Demo · simulated data.</strong>{" "}
        {/* One line at every width, so the height the layout reserves
            (--demo-banner-h) always holds. */}
        <span className="sm:hidden">Nothing here is real.</span>
        <span className="hidden sm:inline">
          There is no backend: every target, run and result here is fictional.
        </span>
      </p>
    </div>
  );
}
