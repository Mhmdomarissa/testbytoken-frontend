import Link from "next/link";
import type { Route } from "next";
import { ArrowRightIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

/**
 * The console home: the four-step path through the product, each step
 * opening the page where that work happens. Deliberately static - no
 * counts, no recent runs, no status. Anything live here would need its
 * own queries, which is a behaviour change, not a visual one.
 *
 * Link names avoid the word "targets": e2e specs find the sidebar's
 * "Targets" link by a non-exact name from this page, and a second match
 * would make that lookup ambiguous.
 */
const steps: {
  title: string;
  body: string;
  href: Route;
  cta: string;
}[] = [
  {
    title: "Register a target",
    body: "Add the site you want tested and scan it. We only ever load the site; we never ask for its password.",
    href: "/targets",
    cta: "Add a site",
  },
  {
    title: "Compose a test",
    body: "Pick a scanned target and describe the check in plain English. You review the plan; nothing runs until you approve it.",
    href: "/targets",
    cta: "Choose a site",
  },
  {
    title: "Watch it run",
    body: "A real browser performs each approved step. Results appear only when the engine reports them.",
    href: "/runs",
    cta: "Open the run history",
  },
  {
    title: "Share the proof",
    body: "A finished run becomes a proof: the verdict, coverage, every step with its screenshot, and a hash of the record. Share it with a public link.",
    href: "/runs",
    cta: "Find a finished run",
  },
];

export default function OverviewPage() {
  return (
    <div className="flex max-w-6xl flex-col gap-10 py-2">
      <PageHeader
        eyebrow="Your workspace"
        title="Welcome to Test by Token"
        description="From a URL to a proof you can hand to anyone, in four steps. Each one opens the page where that work happens."
      />

      <ol className="grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, i) => (
          <li key={step.title} className="flex bg-background">
            <Link
              href={step.href}
              className="group flex flex-1 flex-col border-b-2 border-transparent px-6 py-7 transition-colors duration-(--duration-fast) hover:border-primary hover:bg-card focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <span
                aria-hidden="true"
                className="mb-4 block h-[3px] w-7 bg-primary"
              />
              <span className="mb-3 text-sm font-extrabold tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mb-2.5 font-heading text-2xl leading-tight font-light">
                {step.title}
              </h3>
              <p className="mb-6 text-xs leading-relaxed text-muted-foreground">
                {step.body}
              </p>
              <span className="mt-auto inline-flex items-center gap-2 text-[0.6875rem] font-semibold tracking-[0.15em] uppercase">
                {step.cta}
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-3.5 text-primary"
                />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
