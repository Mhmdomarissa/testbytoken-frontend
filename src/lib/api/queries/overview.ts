import { useQuery } from "@tanstack/react-query";
// Not in the @/lib/contract barrel: its module-level schemas can't be
// tree-shaken, so a barrel export would ship them on every route.
import { OverviewSchema } from "@/lib/contract/overview";
import { apiGet } from "../client";
import { queryKeys } from "../keys";

export type OverviewRange = "7d" | "14d" | "30d";

export interface OverviewParams {
  range: OverviewRange;
  /** The viewer's IANA zone, so "a day" means their day. */
  tz: string;
  /** Dev-only pass-throughs the mock understands, like /runs' simulate_error. */
  simulate_error?: string;
  simulate?: string;
}

function toSearch(params: OverviewParams): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  return `?${q.toString()}`;
}

/**
 * The dashboard's numbers - every one computed server-side over the whole
 * workspace (docs/API_CONTRACT.md, /overview). The dashboard renders only
 * this and never adds up a paginated list itself.
 */
export function useOverview(params: OverviewParams) {
  return useQuery({
    queryKey: queryKeys.overview(
      params as unknown as Record<string, string | undefined>,
    ),
    queryFn: () => apiGet(`/overview${toSearch(params)}`, OverviewSchema),
    staleTime: 30_000,
  });
}
