import { HttpResponse, type JsonBodyType } from "msw";
import type { z } from "zod";
import { REPORT_ORIGIN, SCREENSHOT_ORIGIN } from "./data";

/**
 * Parses every mock response through its own Zod schema before sending it.
 * If a fixture ever drifts from the contract, this fails loudly in dev
 * instead of silently shipping a response the real backend could never
 * produce - the whole point of the mock being a reference implementation.
 */
export function json<T extends z.ZodTypeAny>(
  schema: T,
  data: z.input<T>,
  init?: ResponseInit,
) {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(
      "[mocks] fixture does not match its own schema:",
      result.error.issues,
    );
    return HttpResponse.json(
      {
        error: { code: "mock_fixture_invalid", message: "See server console." },
      },
      { status: 500 },
    );
  }
  return HttpResponse.json(result.data as JsonBodyType, init);
}

export function errorResponse(status: number, code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status });
}

/**
 * Lets the shell's error states be demonstrated on demand (A7's "every
 * route renders ... an error state on demand") without pretending real
 * backend instability - `?simulate_error=true` on any GET list endpoint
 * that calls this first returns a real 500.
 */
export function checkSimulatedError(request: Request) {
  const forced = new URL(request.url).searchParams.get("simulate_error");
  if (forced === "true") {
    return errorResponse(
      500,
      "simulated_error",
      "Simulated failure - requested via ?simulate_error=true.",
    );
  }
  return null;
}

/**
 * Rewrites every occurrence of the mock's fake report/screenshot origins
 * onto the REQUEST's own origin, wherever they appear in a response body
 * (report_url, every step's screenshot_url, nested inside a Proof
 * snapshot...). See data.ts's REPORT_ORIGIN/SCREENSHOT_ORIGIN comment for
 * why this exists: those origins don't resolve in a real browser, and a
 * same-origin URL is what actually loads through MSW's service worker for
 * an <img> or a sandboxed <iframe>. A plain string search-and-replace over
 * the object tree - simpler and harder to miss a field than threading an
 * origin through every fixture and every layer that builds one.
 */
export function rehostMediaUrls<T>(value: T, origin: string): T {
  if (typeof value === "string") {
    return value
      .replace(REPORT_ORIGIN, origin)
      .replace(SCREENSHOT_ORIGIN, origin) as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => rehostMediaUrls(v, origin)) as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, rehostMediaUrls(v, origin)]),
    ) as T;
  }
  return value;
}
