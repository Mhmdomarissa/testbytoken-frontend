import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  CreateTargetRequestSchema,
  TargetSchema,
  UpdateTargetRequestSchema,
} from "@/lib/contract";
import { apiDelete, apiGet, apiPatch, apiPost } from "../client";
import { queryKeys } from "../keys";
import { isUnrecognised } from "../tolerant";

/**
 * A customer's registered targets change rarely - only when they
 * explicitly add/edit/remove one. 60s staleTime: cheap to hold, and any
 * mutation below invalidates immediately anyway, so this only affects
 * how long a *different* tab or an unrelated remount can go without
 * re-fetching to notice a change made elsewhere.
 */
const TARGETS_STALE_TIME = 60_000;

const SCAN_POLL_MS = 1_500;

/**
 * The list is the screen that shows scans progressing (`Target.last_scan`),
 * so while any target's last scan is still moving it re-fetches. Stops when
 * every scan is `completed`, `failed` or `parked` (parked waits on a
 * person, not on time). An UNRECOGNISED status keeps polling: a state we
 * don't understand is not one we can call finished (Phase B 1.1). GET is
 * the authority (docs/API_CONTRACT.md, events section), so polling it is
 * correct, not a fallback.
 */
const SETTLED_SCAN_STATUSES = new Set<string>([
  "completed",
  "failed",
  "parked",
]);

export function useTargets() {
  return useQuery({
    queryKey: queryKeys.targets.all(),
    queryFn: () => apiGet("/targets", z.array(TargetSchema)),
    staleTime: TARGETS_STALE_TIME,
    refetchInterval: (query) =>
      query.state.data?.some(
        (target) =>
          target.last_scan !== null &&
          (isUnrecognised(target.last_scan.status) ||
            !SETTLED_SCAN_STATUSES.has(target.last_scan.status)),
      )
        ? SCAN_POLL_MS
        : false,
  });
}

export function useTarget(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.targets.detail(id ?? ""),
    queryFn: () => apiGet(`/targets/${id}`, TargetSchema),
    enabled: id !== undefined,
    staleTime: TARGETS_STALE_TIME,
  });
}

export function useCreateTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: z.infer<typeof CreateTargetRequestSchema>) =>
      apiPost("/targets", TargetSchema, body),
    onSuccess: (target) => {
      queryClient.setQueryData(queryKeys.targets.detail(target.id), target);
      void queryClient.invalidateQueries({ queryKey: queryKeys.targets.all() });
    },
  });
}

export function useUpdateTarget(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: z.infer<typeof UpdateTargetRequestSchema>) =>
      apiPatch(`/targets/${id}`, TargetSchema, body),
    onSuccess: (target) => {
      queryClient.setQueryData(queryKeys.targets.detail(id), target);
      void queryClient.invalidateQueries({ queryKey: queryKeys.targets.all() });
    },
  });
}

export function useDeleteTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/targets/${id}`, z.void()),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.targets.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.targets.all() });
    },
  });
}
