import { notFound } from "next/navigation";
import { JobEventsHarness } from "./JobEventsHarness";

/**
 * Test harness for `useJobEvents`, not a product screen: it exists
 * because the hook has no consumer until B7 and jsdom has no
 * `EventSource`, so the only honest way to exercise it is a real browser
 * (docs/PHASE_B0_5.md A2; e2e/job-events.spec.ts drives this page).
 * Exists only in mock-backed builds (dev, and the demo's production build,
 * where e2e proves MSW-served SSE works outside development); 404s in a
 * real build - it must never be reachable by a customer.
 * scripts/check-bundle-budget.mjs skips `/dev/*`.
 */
export default async function JobEventsHarnessPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  // Inlined at build time (docs/DEPLOYMENT.md).
  if (process.env.NEXT_PUBLIC_API_MOCKING !== "on") notFound();
  const { job } = await searchParams;
  return <JobEventsHarness jobId={job} />;
}
