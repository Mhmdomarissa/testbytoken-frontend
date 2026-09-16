import { HttpResponse, type JsonBodyType } from "msw";
import type { z } from "zod";

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
