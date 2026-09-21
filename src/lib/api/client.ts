import type { z } from "zod";
import { apiErrorFromResponse, normalizeError } from "./errors";
import { API_BASE_URL } from "./config";
import { tolerant, type Tolerated } from "./tolerant";

/**
 * The one place an HTTP request to the backend gets made. Every query and
 * mutation hook under `src/lib/api/queries/` goes through this - no
 * component fetches, no inline URL strings (docs/PHASE_B.md, B1).
 */

/** No response is worth waiting on forever - see ApiError's "timeout" kind. */
const DEFAULT_TIMEOUT_MS = 15_000;

interface RequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  init: RequestInit,
  options?: RequestOptions,
): Promise<Tolerated<z.output<S>>> {
  // Every response is parsed through the TOLERANT twin of its contract
  // schema (tolerant.ts): an enum value this client doesn't know becomes
  // an UnrecognisedValue instead of failing the whole response. Applied
  // here, once, so no call site can forget to.
  const responseSchema = tolerant(schema);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  // A caller-provided signal (e.g. a mutation cancelled by unmount) aborts
  // the same request as our own timeout.
  options?.signal?.addEventListener("abort", () => controller.abort());

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      // Cookie auth (docs/API_CONTRACT.md) - required for the sibling-subdomain
      // deployment to actually send the cookie cross-origin; harmless same-origin.
      credentials: "include",
      signal: controller.signal,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });

    if (!res.ok) {
      throw await apiErrorFromResponse(res);
    }

    // 204 No Content (e.g. DELETE /targets/{id}) - nothing to parse.
    if (res.status === 204) {
      return responseSchema.parse(undefined);
    }

    const body: unknown = await res.json();
    return responseSchema.parse(body);
  } catch (err) {
    throw normalizeError(err);
  } finally {
    clearTimeout(timeout);
  }
}

export function apiGet<S extends z.ZodType>(
  path: string,
  schema: S,
  options?: RequestOptions,
): Promise<Tolerated<z.output<S>>> {
  return request(path, schema, { method: "GET" }, options);
}

export function apiPost<S extends z.ZodType>(
  path: string,
  schema: S,
  body?: unknown,
  options?: RequestOptions,
): Promise<Tolerated<z.output<S>>> {
  return request(
    path,
    schema,
    {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    options,
  );
}

export function apiPatch<S extends z.ZodType>(
  path: string,
  schema: S,
  body: unknown,
  options?: RequestOptions,
): Promise<Tolerated<z.output<S>>> {
  return request(
    path,
    schema,
    { method: "PATCH", body: JSON.stringify(body) },
    options,
  );
}

export function apiDelete<S extends z.ZodType>(
  path: string,
  schema: S,
  options?: RequestOptions,
): Promise<Tolerated<z.output<S>>> {
  return request(path, schema, { method: "DELETE" }, options);
}
