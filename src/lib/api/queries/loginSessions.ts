import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import {
  CreateLoginSessionRequestSchema,
  LoginSessionSchema,
} from "@/lib/contract";
import { apiGet, apiPost } from "../client";
import { queryKeys } from "../keys";
import { isUnrecognised } from "../tolerant";

const POLL_MS = 2_000;
const RESTING = new Set<string>([
  "completed",
  "expired",
  "failed",
  "cancelled",
]);

/**
 * Readiness, completion and expiry are reported by POLLING this resource -
 * a login session is not a job with steps and has no event stream
 * (docs/API_CONTRACT.md). Polls until it rests in `completed`, `expired`,
 * `failed` or `cancelled`; a status this client doesn't recognise is not
 * resting (Phase B 1.1). A resting session is never refetched.
 *
 * `view_url` carries a short-lived single-use ticket, so it is NEVER
 * persisted: this cache is in memory only (no persister is configured, and
 * nothing here writes to web storage), and a fresh one is what each poll
 * returns. Callers must check `dataUpdatedAt` before offering it.
 */
export function useLoginSession(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.loginSessions.detail(id ?? ""),
    queryFn: () => apiGet(`/login-sessions/${id}`, LoginSessionSchema),
    enabled: id !== undefined,
    staleTime: (query) =>
      query.state.data &&
      !isUnrecognised(query.state.data.status) &&
      RESTING.has(query.state.data.status)
        ? Infinity
        : 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return POLL_MS;
      return isUnrecognised(status) || !RESTING.has(status) ? POLL_MS : false;
    },
    // A hidden tab must not keep minting tickets; it refetches on focus.
    refetchIntervalInBackground: false,
  });
}

/** Takes two ids and nothing else: there is no credential to send. */
export function useCreateLoginSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: z.infer<typeof CreateLoginSessionRequestSchema>) =>
      apiPost("/login-sessions", LoginSessionSchema, body),
    onSuccess: (session) => {
      queryClient.setQueryData(
        queryKeys.loginSessions.detail(session.id),
        session,
      );
    },
  });
}

/** The customer's statement "I'm done" - no body. The engine checks a session exists. */
export function useCompleteLoginSession(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost(`/login-sessions/${id}/complete`, LoginSessionSchema),
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.loginSessions.detail(id), session);
    },
  });
}

export function useCancelLoginSession(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost(`/login-sessions/${id}/cancel`, LoginSessionSchema),
    onSuccess: (session) => {
      queryClient.setQueryData(queryKeys.loginSessions.detail(id), session);
    },
  });
}
