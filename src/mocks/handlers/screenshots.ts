import { http, HttpResponse } from "msw";
import { proofStore } from "../store";

/**
 * Backs every rehosted `Step.screenshot_url` (see respond.ts's
 * `rehostMediaUrls` and data.ts's SCREENSHOT_ORIGIN comment). One tiny,
 * deterministic placeholder image regardless of path - what matters for
 * the reference mock is that a real request round-trips to a real image
 * response, not what the picture shows.
 */
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">
<rect width="320" height="200" fill="#0d2244"/>
<text x="50%" y="50%" fill="#f8f4ee" font-family="monospace" font-size="14" text-anchor="middle" dominant-baseline="middle">mock screenshot</text>
</svg>`;

/**
 * A deterministic, one-way stand-in for a real HMAC - same shape a real
 * backend's signing would have (a value DERIVED from the secret, not the
 * secret itself), good enough for a mock. Reused from the same pattern as
 * planning.ts's proof hash.
 */
function shortHash(input: string): string {
  return [...input]
    .reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
    .toString(16)
    .padStart(8, "0");
}

/**
 * Proof-scoped screenshots are SIGNED against the proof's own share token
 * (docs/API_CONTRACT.md), so a URL a public visitor holds stops working the
 * moment sharing is revoked - not just the `/p/{token}` page around it.
 *
 * The signature is a hash DERIVED from the token, never the token itself:
 * `revision.test.ts` already asserts (correctly, from B0.5 B10) that a
 * public response must never contain the share token verbatim anywhere -
 * this is what "signed against" the token has to mean, not "carries" it.
 * Verification recomputes the same hash against every currently valid
 * share; an old/revoked token is no longer in that set, so its signature
 * stops matching the instant sharing is revoked, with nothing to revoke
 * on the signature itself.
 *
 * `?sig=` is appended only by `handlers/proofs.ts`'s `/p/:token` handler;
 * the session-scoped `/proofs/:id` one never signs (the cookie is the
 * auth there).
 */
export function signScreenshotUrl(url: string, shareToken: string): string {
  const u = new URL(url);
  u.searchParams.set("sig", shortHash(`${u.pathname}|${shareToken}`));
  return u.toString();
}

function isValidSignature(path: string, sig: string): boolean {
  return [...proofStore.values()].some(
    (p) =>
      p.share?.enabled &&
      (p.share.expires_at === null ||
        new Date(p.share.expires_at).getTime() > Date.now()) &&
      shortHash(`${path}|${p.share.token}`) === sig,
  );
}

function placeholder({ request }: { request: Request }) {
  const url = new URL(request.url);
  const sig = url.searchParams.get("sig");
  // No signature at all: the session-scoped path (GET /proofs/{id}) -
  // always servable, cookie auth is assumed at that layer. A signature IS
  // present: this request came from a public proof page, and it only
  // serves while SOME currently enabled, unexpired share reproduces it.
  if (sig !== null && !isValidSignature(url.pathname, sig)) {
    return errorResponse();
  }
  return new HttpResponse(PLACEHOLDER_SVG, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
    },
  });
}

function errorResponse() {
  return new HttpResponse(null, { status: 404 });
}

export const screenshotHandlers = [
  // Two explicit shapes (both exist in the fixtures: `/screenshots/0.png`
  // and `/screenshots/run_fail_1/2.png`) rather than a trailing wildcard -
  // a chained `*/screenshots/*` pattern proved unreliable to match via
  // real <img> element requests in a real browser (intermittent 404s
  // against MSW's own path matcher, not reproducible through fetch()
  // alone - found by actually loading the image in Playwright, not by
  // reasoning about it).
  http.get("*/screenshots/:file", placeholder),
  http.get("*/screenshots/:run/:file", placeholder),
];
