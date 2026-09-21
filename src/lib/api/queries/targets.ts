import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  CreateTargetRequestSchema,
  TargetSchema,
  UpdateTargetRequestSchema,
} from "@/lib/contract";
import { apiDelete, apiGet, apiPatch, apiPost } from "../client";
import { queryKeys } from "../keys";

/**
 * A customer's registered targets change rarely - only when they
 * explicitly add/edit/remove one. 60s staleTime: cheap to hold, and any
 * mutation below invalidates immediately anyway, so this only affects
 * how long a *different* tab or an unrelated remount can go without
 * re-fetching to notice a change made elsewhere.
 */
const TARGETS_STALE_TIME = 60_000;

export function useTargets() {
  return useQuery({
    queryKey: queryKeys.targets.all(),
    queryFn: () => apiGet("/targets", z.array(TargetSchema)),
    staleTime: TARGETS_STALE_TIME,
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
