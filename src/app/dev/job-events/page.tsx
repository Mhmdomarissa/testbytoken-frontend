import { notFound } from "next/navigation";
import { JobEventsHarness } from "./JobEventsHarness";

/**
 * Test harness for `useJobEvents`, not a product screen: it exists
 * because the hook has no consumer until B7 and jsdom has no
 * `EventSource`, so the only honest way to exercise it is a real browser
 * (docs/PHASE_B0_5.md A2; e2e/job-events.spec.ts drives this page).
 * 404s in production - it must never be reachable by a customer.
 * scripts/check-bundle-budget.mjs skips `/dev/*` for the same reason.
 */
export default async function JobEventsHarnessPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { job } = await searchParams;
  return <JobEventsHarness jobId={job} />;
}
