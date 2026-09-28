"use client";

import { Suspense, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Dashboard } from "@/components/overview/Dashboard";
import { RecentRuns } from "@/components/overview/RecentRuns";
import { RangeSwitch } from "@/components/overview/RangeSwitch";
import { useOverview, type OverviewRange } from "@/lib/api/queries/overview";

const RANGES: OverviewRange[] = ["7d", "14d", "30d"];
/**
 * 30 days by default: the demo's finished-run fixtures are dated early in
 * the month, so a 7-day window opens empty. The switch and the URL change it.
 */
const DEFAULT_RANGE: OverviewRange = "30d";

/** The viewer's IANA zone - only knowable in the browser; UTC until then. */
const noop = () => () => {};
function useTimeZone(): string {
  return useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    () => "UTC",
  );
}

export default function OverviewPage() {
  return (
    <Suspense>
      <Overview />
    </Suspense>
  );
}

/**
 * The console overview (UI v2 V2): what happened in this workspace, every
 * number the server's own (GET /overview). Nothing here adds up a
 * paginated list; the recent-runs table is the latest page of /runs,
 * labelled as such.
 */
function Overview() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tz = useTimeZone();

  const asked = search.get("range") as OverviewRange | null;
  const range = asked && RANGES.includes(asked) ? asked : DEFAULT_RANGE;

  const overview = useOverview({
    range,
    tz,
    // Dev-only pass-throughs the mock understands, like /runs.
    simulate_error: search.get("simulate_error") ?? undefined,
    simulate: search.get("simulate") ?? undefined,
  });

  function setRange(next: OverviewRange) {
    const params = new URLSearchParams(search.toString());
    params.set("range", next);
    router.replace(`${pathname}?${params.toString()}` as Route, {
      scroll: false,
    });
  }

  const zone = overview.data?.range.tz ?? tz;
  const tzCaption =
    zone === "UTC" ? "Days in UTC" : `Days in ${zone} (your time zone)`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Your workspace"
        title="Overview"
        description="What happened in this workspace. Every number here is the server's own."
        actions={<RangeSwitch value={range} onChange={setRange} />}
      />
      <Dashboard overview={overview} tzCaption={tzCaption} />
      <RecentRuns />
    </div>
  );
}
