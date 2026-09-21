import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { CreateScanRequestSchema, ScanSchema } from "@/lib/contract";
import { apiGet, apiPost } from "../client";
import { queryKeys } from "../keys";

type Scan = z.infer<typeof ScanSchema>;

const TERMINAL_SCAN_STATUSES = new Set<Scan["status"]>(["completed", "failed"]);

/**
 * A scan is actively changing while `queued`/`crawling`/`parked` - the
 * Phase A mock's own lifecycle simulation (src/mocks/lifecycle.ts) moves
 * it through real elapsed time, and a real engine will too. Poll every
 * 1.5s while non-terminal (this is the fallback path; B7's SSE client is
 * the primary one for anything that has a live event stream - a scan's
 * `/jobs/{id}/events` counts). staleTime 0 while non-terminal for the
 * same reason as workspaces: "queued vs. crawling right now" has no
 * useful stale reading. Once `completed`/`failed`, the scan is a fixed
 * historical record - staleTime Infinity, only ever updated by
 * `useContinueScan`'s own cache write below, never by a background
 * refetch second-guessing a finished result.
 */
export function useScan(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.scans.detail(id ?? ""),
    queryFn: () => apiGet(`/scans/${id}`, ScanSchema),
    enabled: id !== undefined,
    staleTime: (query) =>
      query.state.data && TERMINAL_SCAN_STATUSES.has(query.state.data.status)
        ? Infinity
        : 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return 1_500;
      return TERMINAL_SCAN_STATUSES.has(status) || status === "parked"
        ? false
        : 1_500;
    },
  });
}

export function useCreateScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: z.infer<typeof CreateScanRequestSchema>) =>
      apiPost("/scans", ScanSchema, body),
    onSuccess: (scan) => {
      queryClient.setQueryData(queryKeys.scans.detail(scan.id), scan);
    },
  });
}

/** Resumes a `parked` scan once the customer has signed in themselves (B6). */
export function useContinueScan(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost(`/scans/${id}/continue`, ScanSchema),
    onSuccess: (scan) => {
      queryClient.setQueryData(queryKeys.scans.detail(id), scan);
    },
  });
}
