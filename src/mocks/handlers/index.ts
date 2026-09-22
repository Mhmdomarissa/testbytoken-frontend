import { http, passthrough } from "msw";
import { authHandlers } from "./auth";
import { workspaceHandlers } from "./workspaces";
import { scanHandlers } from "./scans";
import { inspectHandlers } from "./inspect";
import { runHandlers } from "./runs";
import { eventHandlers } from "./events";
import { suiteHandlers } from "./suites";
import { targetHandlers } from "./targets";
import { planHandlers } from "./plans";
import { loginSessionHandlers } from "./loginSessions";
import { proofHandlers } from "./proofs";
import { usageHandlers } from "./usage";
import { screenshotHandlers } from "./screenshots";

/**
 * The mock's API paths (`/runs`, `/targets`, ...) are ALSO the app's page
 * routes. Without this, a client-side navigation to /runs makes Next fetch
 * `/runs?_rsc=...` for the route's payload, the mock answers it with JSON,
 * Next decides the response is invalid and falls back to a FULL page load -
 * which throws away every in-memory mock record (a target you just
 * registered, a run you just started). Requests the framework or the
 * browser makes to render a page are not API calls: let them through. A
 * real backend lives on another origin and never has this collision.
 *
 * Sub-resource paths that can NEVER be a Next.js page - no `page.tsx`
 * exists or ever will at these shapes - are excluded first, regardless of
 * the Accept-header heuristic below. Found the hard way: a sandboxed
 * <iframe src="/runs/{id}/report"> sends `Accept: text/html` (browsers
 * treat a nested browsing context's navigation like a document request,
 * same as a top-level page load), which the heuristic below cannot tell
 * apart from a real page visit - so it passed the iframe's request
 * through to Next, which 404'd it (there is no such page), instead of
 * letting the mock's own `/runs/:id/report` handler answer it. Screenshots
 * (`/screenshots/*`) never collided in practice (an <img> sends an
 * `image/*` Accept, not `text/html`) but are excluded too since a same
 * reasoning failure there would be just as wrong.
 */
const NEVER_A_PAGE = [/\/runs\/[^/]+\/report$/, /\/screenshots\//];

export function isPageRequest(request: Request): boolean {
  const path = new URL(request.url).pathname;
  if (NEVER_A_PAGE.some((re) => re.test(path))) return false;
  return (
    request.headers.has("rsc") ||
    request.headers.has("next-router-prefetch") ||
    new URL(request.url).searchParams.has("_rsc") ||
    (request.headers.get("accept") ?? "").includes("text/html")
  );
}

const pageRequestPassthrough = http.all("*", ({ request }) =>
  isPageRequest(request) ? passthrough() : undefined,
);

export const handlers = [
  pageRequestPassthrough,
  ...authHandlers,
  ...workspaceHandlers,
  ...scanHandlers,
  ...inspectHandlers,
  ...runHandlers,
  ...eventHandlers,
  ...suiteHandlers,
  ...targetHandlers,
  ...planHandlers,
  ...loginSessionHandlers,
  ...proofHandlers,
  ...usageHandlers,
  ...screenshotHandlers,
];
