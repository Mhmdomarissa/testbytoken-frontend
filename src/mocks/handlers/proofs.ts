import { http } from "msw";
import {
  ProofSchema,
  PublicProofSchema,
  ShareSchema,
  CreateShareRequestSchema,
} from "@/lib/contract";
import { json, errorResponse, rehostMediaUrls } from "../respond";
import { proofs } from "../data";
import { resolveRun } from "../lifecycle";
import { proofForPlanRun, proofForRun, resolvePlan } from "../planning";
import { runStore, targetStore } from "../store";

let store = [...proofs];

/**
 * A finished PLAN run's proof does not exist until someone asks for it; then
 * it is built once from the run and its immutable plan and kept - frozen -
 * so a second read (or a later change to anything) can't alter it. Runs
 * that aren't finished, or didn't come from an approved plan, have none.
 */
function findProof(id: string) {
  const existing = store.find((p) => p.id === id);
  if (existing || !id.startsWith("proof_run_")) return existing;
  const stored = runStore.get(id.slice("proof_".length));
  if (!stored) return undefined;
  const run = resolveRun(stored);
  if (run.proof_id !== id) return undefined;
  const target = targetStore.get(run.target_id);
  if (!target) return undefined;
  let proof: ReturnType<typeof proofForRun> | undefined;
  if (run.plan_id) {
    const plan = resolvePlan(run.plan_id);
    if (!plan || plan.status !== "approved") return undefined;
    proof = proofForPlanRun(run, plan, target);
  } else {
    proof = proofForRun(run, target);
  }
  store = [...store, proof];
  return proof;
}

export const proofHandlers = [
  http.get("*/proofs/:id", async ({ params, request }) => {
    const proof = findProof(params.id as string);
    if (!proof) return errorResponse(404, "not_found", "Proof not found.");
    const origin = new URL(request.url).origin;
    return json(ProofSchema, rehostMediaUrls(proof, origin));
  }),

  http.get("*/p/:token", async ({ params, request }) => {
    const origin = new URL(request.url).origin;
    const proof = store.find(
      (p) =>
        p.share?.token === params.token &&
        p.share?.enabled &&
        (p.share.expires_at === null ||
          new Date(p.share.expires_at).getTime() > Date.now()),
    );
    if (!proof)
      return errorResponse(
        404,
        "not_found",
        "Token invalid, expired, or sharing disabled.",
      );
    // B0.5 B10: the public shape is picked field by field, NOT spread from
    // the owner's Proof - so a field added to Proof later can't leak onto
    // this page by default. No run id, no share token, nothing that
    // resolves to authenticated data: the snapshot and nothing else.
    return json(
      PublicProofSchema,
      rehostMediaUrls(
        {
          id: proof.id,
          hash: proof.hash,
          created_at: proof.created_at,
          snapshot: proof.snapshot,
        },
        origin,
      ),
    );
  }),

  http.post("*/proofs/:id/share", async ({ params, request }) => {
    const index = store.findIndex((p) => p.id === params.id);
    if (index === -1)
      return errorResponse(404, "not_found", "Proof not found.");
    const body = CreateShareRequestSchema.parse(await request.json());
    const token = `share_${Math.random().toString(36).slice(2, 10)}`;
    const share = {
      token,
      url: `https://testbytoken.example/p/${token}`,
      enabled: body.enabled,
      expires_at: body.expires_in_seconds
        ? new Date(Date.now() + body.expires_in_seconds * 1000).toISOString()
        : null,
    };
    const current = store[index]!;
    store = [
      ...store.slice(0, index),
      { ...current, share },
      ...store.slice(index + 1),
    ];
    return json(ShareSchema, share);
  }),
];
