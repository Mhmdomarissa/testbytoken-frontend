import { http } from "msw";
import {
  ProofSchema,
  PublicProofSchema,
  ShareSchema,
  CreateShareRequestSchema,
} from "@/lib/contract";
import { json, errorResponse } from "../respond";
import { proofs } from "../data";

let store = [...proofs];

export const proofHandlers = [
  http.get("*/proofs/:id", async ({ params }) => {
    const proof = store.find((p) => p.id === params.id);
    if (!proof) return errorResponse(404, "not_found", "Proof not found.");
    return json(ProofSchema, proof);
  }),

  http.get("*/p/:token", async ({ params }) => {
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
    return json(PublicProofSchema, {
      id: proof.id,
      hash: proof.hash,
      created_at: proof.created_at,
      snapshot: proof.snapshot,
    });
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
