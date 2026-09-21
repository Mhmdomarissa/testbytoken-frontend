/**
 * Not yet set: when a real backend exists at a sibling subdomain
 * (docs/API_CONTRACT.md's SSE deployment requirement applies to every
 * request, not just SSE, since cookie auth is shared), point this at
 * that origin. Empty string keeps every request same-origin, which is
 * what both local dev and MSW (same-origin interception) need today.
 * Shared by client.ts (fetch) and sse/useJobEvents.ts (EventSource) so
 * there is exactly one place this ever gets set.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
