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

/**
 * The mock's API paths (`/runs`, `/targets`, ...) are ALSO the app's page
 * routes. Without this, a client-side navigation to /runs makes Next fetch
 * `/runs?_rsc=...` for the route's payload, the mock answers it with JSON,
 * Next decides the response is invalid and falls back to a FULL page load -
 * which throws away every in-memory mock record (a target you just
 * registered, a run you just started). Requests the framework or the
 * browser makes to render a page are not API calls: let them through. A
 * real backend lives on another origin and never has this collision.
 */
export function isPageRequest(request: Request): boolean {
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
];
