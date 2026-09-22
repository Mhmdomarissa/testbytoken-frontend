import { http } from "msw";
import {
  ProofSchema,
  PublicProofSchema,
  ShareSchema,
  CreateShareRequestSchema,
} from "@/lib/contract";
import { json, errorResponse, rehostMediaUrls } from "../respond";
import { resolveRun } from "../lifecycle";
import { proofForPlanRun, proofForRun, resolvePlan } from "../planning";
import { proofStore, runStore, targetStore } from "../store";
import { signScreenshotUrl } from "./screenshots";

/**
 * A finished PLAN run's proof does not exist until someone asks for it; then
 * it is built once from the run and its immutable plan and kept - frozen -
 * so a second read (or a later change to anything) can't alter it. Runs
 * that aren't finished, or didn't come from an approved plan, have none.
 */
function findProof(id: string) {
  const existing = proofStore.get(id);
  if (existing || !id.startsWith("proof_run_")) return existing;
  const stored = runStore.get(id.slice("proof_".length));
  if (!stored) return undefined;
  const run = resolveRun(stored);
  if (run.proof_id !== id) return undefined;
  const target = targetStore.get(run.target_id);
  if (!target) return undefined;
  const plan_id = run.plan_id;
  const proof = plan_id
    ? (() => {
        const plan = resolvePlan(plan_id);
        return plan && plan.status === "approved"
          ? proofForPlanRun(run, plan, target)
          : undefined;
      })()
    : proofForRun(run, target);
  if (!proof) return undefined;
  proofStore.set(proof.id, proof);
  return proof;
}

/**
 * The live proof behind a share token, or undefined if the token is
 * unknown, disabled, or expired - the one check that decides whether
 * `/p/{token}`, its OG image, and every proof-scoped screenshot URL it
 * handed out are servable. Exported so opengraph-image.tsx (server-only,
 * no HTTP path back into this mock - see its own file comment) can ask
 * the exact same question the HTTP handler below does, not a
 * hand-rolled copy of it.
 */
export function findProofByShareToken(token: string) {
  return [...proofStore.values()].find(
    (p) =>
      p.share?.token === token &&
      p.share?.enabled &&
      (p.share.expires_at === null ||
        new Date(p.share.expires_at).getTime() > Date.now()),
  );
}

export const proofHandlers = [
  http.get("*/proofs/:id", async ({ params, request }) => {
    const proof = findProof(params.id as string);
    if (!proof) return errorResponse(404, "not_found", "Proof not found.");
    const origin = new URL(request.url).origin;
    // share.url is fully derived from (origin, token) - rebuilt here
    // rather than trusted from storage, so a fixture's placeholder value
    // (see data.ts's DEMO_SHARE_TOKEN) or a stale origin can never leak
    // through to the owner's own view.
    const withCurrentShareUrl = proof.share
      ? {
          ...proof,
          share: { ...proof.share, url: `${origin}/p/${proof.share.token}` },
        }
      : proof;
    // Session-scoped (this endpoint): authorized by the cookie, same as any
    // other API call - no signature needed on the screenshot URLs
    // themselves (docs/API_CONTRACT.md).
    return json(ProofSchema, rehostMediaUrls(withCurrentShareUrl, origin));
  }),

  http.get("*/p/:token", async ({ params, request }) => {
    const origin = new URL(request.url).origin;
    const proof = findProofByShareToken(params.token as string);
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
    const token = proof.share!.token;
    const snapshot = {
      ...proof.snapshot,
      // Proof-scoped screenshots are SIGNED against this proof's own share
      // token (docs/API_CONTRACT.md): a URL captured from this page stops
      // working the instant sharing is revoked, because the signature
      // stops validating - see handlers/screenshots.ts. Session-scoped
      // GET /proofs/{id} above never signs; the cookie is the auth there.
      steps: proof.snapshot.steps.map((step) =>
        step.screenshot_url
          ? {
              ...step,
              screenshot_url: signScreenshotUrl(step.screenshot_url, token),
            }
          : step,
      ),
    };
    return json(
      PublicProofSchema,
      rehostMediaUrls(
        {
          id: proof.id,
          hash: proof.hash,
          created_at: proof.created_at,
          snapshot,
        },
        origin,
      ),
    );
  }),

  http.post("*/proofs/:id/share", async ({ params, request }) => {
    const current = proofStore.get(params.id as string);
    if (!current) return errorResponse(404, "not_found", "Proof not found.");
    const body = CreateShareRequestSchema.parse(await request.json());
    const token = `share_${Math.random().toString(36).slice(2, 10)}`;
    const origin = new URL(request.url).origin;
    const share = {
      token,
      url: `${origin}/p/${token}`,
      enabled: body.enabled,
      expires_at: body.expires_in_seconds
        ? new Date(Date.now() + body.expires_in_seconds * 1000).toISOString()
        : null,
    };
    proofStore.set(current.id, { ...current, share });
    return json(ShareSchema, share);
  }),
];
