import { useQueries, useQuery } from "@tanstack/react-query";
import { InspectResponseSchema } from "@/lib/contract";
import { apiPost } from "../client";
import { queryKeys } from "../keys";

/**
 * `POST /inspect` is a read, not a mutation, despite the HTTP verb - it
 * returns a module's element inventory with no side effect
 * (docs/API_CONTRACT.md's request-body-as-query shape). Modelled as a
 * query, not a mutation, so it gets caching and staleTime like every
 * other read. The inventory only changes when the module is re-scanned,
 * which produces a new scan_id, and this key is scoped to
 * (scanId, moduleId) - so a stale inventory for an OLD scan_id is never
 * confused with a fresh one for a new scan. staleTime Infinity: a given
 * scan's inventory for a given module is a fixed historical fact, never
 * updated in place.
 */
export function useInspect(
  scanId: string | undefined,
  moduleId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.inspect(scanId ?? "", moduleId ?? ""),
    queryFn: () =>
      apiPost("/inspect", InspectResponseSchema, {
        scan_id: scanId,
        module_id: moduleId,
      }),
    enabled: scanId !== undefined && moduleId !== undefined,
    staleTime: Infinity,
  });
}

/**
 * The inventories of several modules at once - the inventory screen shows
 * a whole scan. Same key and query function as `useInspect`, so a module
 * opened elsewhere is already cached. Results are index-aligned with
 * `moduleIds`, each with its own loading/error state: one module failing
 * to load must not blank the others.
 */
export function useInspectModules(
  scanId: string | undefined,
  moduleIds: string[],
) {
  return useQueries({
    queries: moduleIds.map((moduleId) => ({
      queryKey: queryKeys.inspect(scanId ?? "", moduleId),
      queryFn: () =>
        apiPost("/inspect", InspectResponseSchema, {
          scan_id: scanId,
          module_id: moduleId,
        }),
      enabled: scanId !== undefined,
      staleTime: Infinity,
    })),
  });
}
