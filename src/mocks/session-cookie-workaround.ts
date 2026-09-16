/**
 * Service Workers cannot set cookies via a `Set-Cookie` response header -
 * this is a browser/spec restriction (the Fetch/Service Worker spec
 * excludes forbidden response-header behavior for synthetic responses),
 * not an MSW bug. `src/mocks/handlers/auth.ts` sets `Set-Cookie` on its
 * `/auth/verify` and `/auth/logout` responses, which works perfectly in
 * MSW's Node server (used by tests) but is silently dropped by the real
 * browser when MSW intercepts via its Service Worker - confirmed by
 * driving the actual sign-in flow in a browser and finding the cookie
 * never landed (`document.cookie` stayed empty, and the auth guard kept
 * redirecting back to sign-in).
 *
 * This is a mock-environment-only workaround: the sign-in/sign-out pages
 * call these after a successful mock response, standing in for what the
 * response's `Set-Cookie` header would do against a real backend (where
 * this problem does not exist - a real HTTP response's `Set-Cookie`
 * header is honored normally). Nothing here should survive once a real
 * backend exists; the mock handlers' own `Set-Cookie` headers are already
 * correct and should stay as the reference implementation.
 */
const SESSION_COOKIE_NAME = "session";
const SESSION_COOKIE_VALUE = "demo_user";

export function setMockSessionCookie() {
  document.cookie = `${SESSION_COOKIE_NAME}=${SESSION_COOKIE_VALUE}; Path=/; SameSite=Lax`;
}

export function clearMockSessionCookie() {
  document.cookie = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0`;
}
