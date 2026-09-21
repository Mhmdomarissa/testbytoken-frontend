import { z } from "zod";
import { ErrorSchema } from "@/lib/contract";

/**
 * Every failure this app can hit talking to the backend, normalised to one
 * shape so a component can render "something went wrong" once and handle
 * every cause, while still being able to branch on `kind` when it matters
 * (a 404 vs. a dropped connection vs. our own contract drifting).
 *
 * B1 (docs/PHASE_B.md): "Network failure, 4xx, 5xx, schema-parse failure
 * and timeout all arrive at the UI as the same shape, distinguishable by
 * kind."
 */
export type ApiErrorKind = "network" | "http" | "parse" | "timeout";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status code - only present for `kind: "http"`. */
  readonly status?: number;
  /** Server's machine-readable error code (ErrorSchema.error.code) - only for `kind: "http"`. */
  readonly code?: string;

  constructor(
    kind: ApiErrorKind,
    message: string,
    extra?: { status?: number; code?: string; cause?: unknown },
  ) {
    // The original error/ZodError, kept on the standard Error#cause for
    // logging - never rendered to a user.
    super(message, { cause: extra?.cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = extra?.status;
    this.code = extra?.code;
  }
}

/**
 * A message safe to show a customer as-is for every kind. `http` errors
 * carry the server's own message (docs/API_CONTRACT.md: "message is safe
 * to show to the customer as-is") - everything else is a generic,
 * non-leaky fallback so we never surface a raw fetch/Zod error string.
 */
const FALLBACK_MESSAGES: Record<ApiErrorKind, string> = {
  network: "Couldn't reach the server. Check your connection and try again.",
  http: "The server reported a problem.",
  parse: "Got a response we didn't expect. Please try again.",
  timeout: "That took too long. Please try again.",
};

/**
 * Turns whatever a failed request threw into an ApiError. Called from one
 * place (client.ts) so every call site gets the same classification -
 * no component re-derives "was this a timeout or a 500?" from scratch.
 *
 * A schema-parse failure (our contract drifting from what the backend
 * actually sent) is logged loudly in development - this is exactly the
 * bug class the Phase A contract-drift check exists to catch before
 * merge, but a real backend can still drift from it at runtime - and
 * handled as an ordinary, quiet ApiError in production so one malformed
 * field doesn't crash the app for a real customer.
 */
export function normalizeError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (err instanceof z.ZodError) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "[api] Response failed schema validation - the contract has drifted from what the server actually sent:",
        err.issues,
      );
    }
    return new ApiError("parse", FALLBACK_MESSAGES.parse, { cause: err });
  }

  if (err instanceof DOMException && err.name === "AbortError") {
    return new ApiError("timeout", FALLBACK_MESSAGES.timeout, { cause: err });
  }

  // `fetch` itself rejects with a TypeError for DNS/connection failures,
  // CORS rejection, offline, etc. - there is no response to inspect.
  if (err instanceof TypeError) {
    return new ApiError("network", FALLBACK_MESSAGES.network, { cause: err });
  }

  return new ApiError(
    "network",
    err instanceof Error
      ? FALLBACK_MESSAGES.network
      : FALLBACK_MESSAGES.network,
    { cause: err },
  );
}

/**
 * Builds the `http` ApiError for a non-2xx response, parsing the server's
 * ErrorSchema body when present so `code` and `message` are real. Falls
 * back to a status-only message if the body isn't the shape we expect -
 * a malformed error body shouldn't itself crash the error path.
 */
export async function apiErrorFromResponse(res: Response): Promise<ApiError> {
  const status = res.status;
  const rawBody: unknown = await res.json().catch(() => null);
  const parsed = ErrorSchema.safeParse(rawBody);

  if (parsed.success) {
    return new ApiError("http", parsed.data.error.message, {
      status,
      code: parsed.data.error.code,
      cause: rawBody,
    });
  }

  return new ApiError("http", `Request failed (${status}).`, {
    status,
    cause: rawBody,
  });
}
