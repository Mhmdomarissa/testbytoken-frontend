import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Auth guard. `middleware.ts` is deprecated in Next 16 in favor of this
 * `proxy.ts` convention (same behavior, renamed - see
 * node_modules/next/dist/docs/.../file-conventions/proxy.md).
 *
 * This only checks for the session cookie's presence, matching what the
 * mock actually sets (src/mocks/handlers/auth.ts) - a lightweight, fast
 * check appropriate for something that runs on every request. Real
 * validation (is this session actually still valid?) happens where it's
 * cheap to fail per-request: GET /auth/me, called from the shell layout.
 */
const SESSION_COOKIE = "session";
const PUBLIC_PATHS = ["/sign-in", "/style-guide"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!hasSession && !isPublicPath) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (hasSession && pathname === "/sign-in") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except static assets, the mock service worker file, and
    // Next's own internals.
    "/((?!_next/static|_next/image|favicon.ico|mockServiceWorker.js).*)",
  ],
};
