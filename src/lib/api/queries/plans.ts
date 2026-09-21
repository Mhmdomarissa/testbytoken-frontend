import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import {
  ApprovePlanRequestSchema,
  CreatePlanRequestSchema,
  PlanSchema,
} from "@/lib/contract";
import { apiGet, apiPost } from "../client";
import { queryKeys } from "../keys";
import { isUnrecognised } from "../tolerant";

const PLAN_POLL_MS = 1_000;
const RESTING_STATUSES = new Set<string>(["approved", "discarded", "failed"]);

/**
 * A plan is `generating` for real wall-clock time, then it is fixed: its
 * steps NEVER change after that (docs/API_CONTRACT.md, B7), and the one
 * write that can follow - approval - arrives as this cache's own
 * mutation result. So: poll while `generating` (or a status we don't
 * understand - it isn't one we can call settled), and once approved,
 * discarded or failed never refetch. A `proposed` plan is refetched on
 * focus like any read, since another tab could have approved it.
 */
export function usePlan(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.plans.detail(id ?? ""),
    queryFn: () => apiGet(`/plans/${id}`, PlanSchema),
    enabled: id !== undefined,
    staleTime: (query) =>
      query.state.data &&
      !isUnrecognised(query.state.data.status) &&
      RESTING_STATUSES.has(query.state.data.status)
        ? Infinity
        : 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return PLAN_POLL_MS;
      return isUnrecognised(status) || status === "generating"
        ? PLAN_POLL_MS
        : false;
    },
  });
}

/** Asks the planner for a proposal. Executes NOTHING - the contract's whole point. */
export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: z.infer<typeof CreatePlanRequestSchema>) =>
      apiPost("/plans", PlanSchema, body),
    onSuccess: (plan) => {
      queryClient.setQueryData(queryKeys.plans.detail(plan.id), plan);
    },
  });
}

/** The single write that turns a proposal into something a run may execute. */
export function useApprovePlan(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: z.infer<typeof ApprovePlanRequestSchema>) =>
      apiPost(`/plans/${id}/approve`, PlanSchema, body),
    onSuccess: (plan) => {
      queryClient.setQueryData(queryKeys.plans.detail(id), plan);
    },
  });
}

export function useDiscardPlan(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost(`/plans/${id}/discard`, PlanSchema),
    onSuccess: (plan) => {
      queryClient.setQueryData(queryKeys.plans.detail(id), plan);
    },
  });
}
