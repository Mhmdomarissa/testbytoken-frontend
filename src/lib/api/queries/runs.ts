import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import {
  CreateRunRequestSchema,
  RunDetailSchema,
  RunSummarySchema,
  paginated,
} from "@/lib/contract";
import { apiGet, apiPost } from "../client";
import { queryKeys } from "../keys";
import { isUnrecognised, type Tolerated } from "../tolerant";

type RunDetail = Tolerated<z.infer<typeof RunDetailSchema>>;
type RunListParams = {
  target_id?: string;
  suite_id?: string;
  status?: string;
  limit?: number;
  cursor?: string;
};

const RunListResponseSchema = paginated(RunSummarySchema);

const NON_TERMINAL_RUN_STATUSES = new Set<string>(["queued", "running"]);

/**
 * A status this client doesn't recognise is treated as NOT finished: we
 * can't claim a run is done when we don't know what its state means, and
 * "keep polling" is the only answer that can't freeze the UI on a stale
 * reading (Phase B \u00a71.1 - never present a state the server didn't send
 * as if it were settled).
 */
function isStillMoving(status: RunDetail["status"]): boolean {
  return isUnrecognised(status) || NON_TERMINAL_RUN_STATUSES.has(status);
}

function toSearchParams(params: RunListParams): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) usp.set(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

/**
 * A run list changes whenever a run starts, finishes, or is cancelled -
 * not stable the way targets/suites are, but also not worth polling a
 * whole list every couple seconds just because one run in it is live
 * (that's what useRun's own polling/SSE is for). 15s staleTime: short
 * enough that leaving a list open doesn't go stale for long, long enough
 * that switching between screens doesn't refetch on every navigation.
 * Every mutation below (create, cancel) invalidates this explicitly
 * rather than waiting out the 15s.
 */
export function useRuns(params: RunListParams = {}) {
  return useQuery({
    queryKey: queryKeys.runs.list(params as Record<string, string | undefined>),
    queryFn: () =>
      apiGet(`/runs${toSearchParams(params)}`, RunListResponseSchema),
    staleTime: 15_000,
  });
}

/**
 * A run in progress is the most volatile thing in this app. This polling
 * is the fallback/complement to B7's SSE client, not a replacement for
 * it - a screen with an open event stream doesn't need this interval to
 * do any work (the events themselves keep the cache fresh via
 * setQueryData), but any screen that just wants "the current state of
 * run X" without standing up its own EventSource (a run card in a list,
 * for instance) still needs to see it change. staleTime 0 while
 * queued/running (there is no such thing as a "stale but good enough"
 * reading of a run that might have just finished); Infinity once
 * terminal - a finished run's steps and verdict do not change.
 */
export function useRun(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.runs.detail(id ?? ""),
    queryFn: () => apiGet(`/runs/${id}`, RunDetailSchema),
    enabled: id !== undefined,
    staleTime: (query) =>
      query.state.data && !isStillMoving(query.state.data.status)
        ? Infinity
        : 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && isStillMoving(status) ? 3_000 : false;
    },
  });
}

export function useCreateRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: z.infer<typeof CreateRunRequestSchema>) =>
      apiPost("/runs", RunDetailSchema, body),
    onSuccess: (run) => {
      queryClient.setQueryData(queryKeys.runs.detail(run.id), run);
      void queryClient.invalidateQueries({ queryKey: ["runs", "list"] });
    },
  });
}

export function useCancelRun(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost(`/runs/${id}/cancel`, RunDetailSchema),
    onSuccess: (run) => {
      queryClient.setQueryData(queryKeys.runs.detail(id), run);
      void queryClient.invalidateQueries({ queryKey: ["runs", "list"] });
    },
  });
}
