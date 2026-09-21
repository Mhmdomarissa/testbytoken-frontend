import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { SuiteSchema, SuiteVersionSchema } from "@/lib/contract";
import { apiGet } from "../client";
import { queryKeys } from "../keys";

/**
 * A suite only changes when its target is re-scanned (a new version, per
 * docs/API_CONTRACT.md - re-scanning never mutates history a customer
 * might be mid-run against). 60s staleTime, same reasoning as targets:
 * cheap to hold, and there is currently no mutation in this app that
 * creates a suite version to invalidate against (see B1's contract-gap
 * note - "compose" has no endpoint yet).
 */
const SUITES_STALE_TIME = 60_000;

export function useSuites() {
  return useQuery({
    queryKey: queryKeys.suites.all(),
    queryFn: () => apiGet("/suites", z.array(SuiteSchema)),
    staleTime: SUITES_STALE_TIME,
  });
}

export function useSuite(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.suites.detail(id ?? ""),
    queryFn: () => apiGet(`/suites/${id}`, SuiteSchema),
    enabled: id !== undefined,
    staleTime: SUITES_STALE_TIME,
  });
}

/** Version history only grows by re-scanning - Infinity plus manual invalidation once that mutation exists. */
export function useSuiteVersions(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.suites.versions(id ?? ""),
    queryFn: () =>
      apiGet(`/suites/${id}/versions`, z.array(SuiteVersionSchema)),
    enabled: id !== undefined,
    staleTime: Infinity,
  });
}
