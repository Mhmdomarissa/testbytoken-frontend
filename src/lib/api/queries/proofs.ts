import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import {
  CreateShareRequestSchema,
  ProofSchema,
  ShareSchema,
} from "@/lib/contract";
import { apiGet, apiPost } from "../client";
import { queryKeys } from "../keys";

/**
 * A proof is a finished, tamper-evident artefact (docs/API_CONTRACT.md) -
 * once created it does not change, so staleTime Infinity is not a
 * performance shortcut here, it's the correct model: there is no
 * "refetch and see if the hash changed" for something that's supposed to
 * be immutable. The one thing that *can* change on it is `share`
 * (created/rotated below), which writes the response straight into this
 * same cache entry instead of triggering a refetch of the whole proof.
 */
export function useProof(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.proofs.detail(id ?? ""),
    queryFn: () => apiGet(`/proofs/${id}`, ProofSchema),
    enabled: id !== undefined,
    staleTime: Infinity,
  });
}

/**
 * The public, unauthenticated view (`GET /p/{token}`, B9's proof page).
 * Separate hook, separate cache key, and deliberately does NOT go through
 * the same client credentials path implicitly assumed elsewhere - see
 * client.ts: `credentials: "include"` is harmless here (no cookie exists
 * for an anonymous visitor to send), but this endpoint must keep working
 * with none.
 */
export function usePublicProof(token: string | undefined) {
  return useQuery({
    queryKey: queryKeys.proofs.public(token ?? ""),
    queryFn: () => apiGet(`/p/${token}`, ProofSchema),
    enabled: token !== undefined,
    staleTime: Infinity,
  });
}

export function useCreateShare(proofId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: z.infer<typeof CreateShareRequestSchema>) =>
      apiPost(`/proofs/${proofId}/share`, ShareSchema, body),
    onSuccess: (share) => {
      queryClient.setQueryData(
        queryKeys.proofs.detail(proofId),
        (proof: z.infer<typeof ProofSchema> | undefined) =>
          proof === undefined ? proof : { ...proof, share },
      );
    },
  });
}
