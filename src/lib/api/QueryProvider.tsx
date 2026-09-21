"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "./errors";

/**
 * Retry only what retrying can actually fix: a dropped connection or a
 * slow response might succeed next time; a 404 or a bad request won't,
 * and a schema-parse failure means our contract has drifted from what the
 * server sent - retrying the same request gets the same wrong shape back.
 * Capped at 2 retries with TanStack's default exponential backoff.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (!(error instanceof ApiError)) return false;
  if (error.kind === "network" || error.kind === "timeout") return true;
  if (
    error.kind === "http" &&
    error.status !== undefined &&
    error.status >= 500
  ) {
    return true;
  }
  return false;
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry },
      mutations: { retry: false }, // a mutation retried blind can double-fire a side effect
    },
  });
}

/**
 * One QueryClient per component-tree instance (React's useState lazy
 * initializer), not a module-level singleton - the safe pattern for the
 * App Router, where a module-level client would leak state across
 * requests/renders in ways that only show up under load. Placed inside
 * MockingProvider in layout.tsx so no query can fire before MSW is ready.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
