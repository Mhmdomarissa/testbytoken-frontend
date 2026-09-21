import type { z } from "zod";
import { apiErrorFromResponse, normalizeError } from "./errors";
import { API_BASE_URL } from "./config";

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

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit,
  options?: RequestOptions,
): Promise<T> {
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
      return schema.parse(undefined);
    }

    const body: unknown = await res.json();
    return schema.parse(body);
  } catch (err) {
    throw normalizeError(err);
  } finally {
    clearTimeout(timeout);
  }
}

export function apiGet<T>(
  path: string,
  schema: z.ZodType<T>,
  options?: RequestOptions,
): Promise<T> {
  return request(path, schema, { method: "GET" }, options);
}

export function apiPost<T>(
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
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

export function apiPatch<T>(
  path: string,
  schema: z.ZodType<T>,
  body: unknown,
  options?: RequestOptions,
): Promise<T> {
  return request(
    path,
    schema,
    { method: "PATCH", body: JSON.stringify(body) },
    options,
  );
}

export function apiDelete<T>(
  path: string,
  schema: z.ZodType<T>,
  options?: RequestOptions,
): Promise<T> {
  return request(path, schema, { method: "DELETE" }, options);
}
