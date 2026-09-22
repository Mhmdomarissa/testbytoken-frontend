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
 * A proof is FROZEN at creation (docs/API_CONTRACT.md, B10) - its snapshot
 * never changes. `share` is the one field that can, via the mutation below,
 * and that mutation writes the fresh value into this same cache entry - so
 * staleTime Infinity is correct, not a cache bug waiting to happen: nothing
 * else about this record can go stale.
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
 * Creates or updates the proof's public share (`enabled: true`) or revokes
 * it (`enabled: false`). Nice-to-have per the contract, but still the one
 * write this resource has - everything else about a Proof is immutable.
 * The response is just the `Share`; merged into the cached `Proof` rather
 * than treated as the whole record.
 */
export function useSetShare(proofId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: z.infer<typeof CreateShareRequestSchema>) =>
      apiPost(`/proofs/${proofId}/share`, ShareSchema, body),
    onSuccess: (share) => {
      queryClient.setQueryData(
        queryKeys.proofs.detail(proofId),
        (prev: z.infer<typeof ProofSchema> | undefined) =>
          prev && { ...prev, share },
      );
    },
  });
}
