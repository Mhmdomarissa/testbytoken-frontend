"use client";

import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import { tolerant, type Tolerated } from "@/lib/api/tolerant";

export type ResourceState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };

/**
 * Client-side fetch + Zod parse, with a retry the ErrorState primitive can
 * call. Deliberately client-side, not a Server Component fetch: CLAUDE.md's
 * architecture rule is that the browser talks to the backend directly, with
 * no Next proxy/BFF - fetching backend resources from a Server Component
 * would itself be exactly that.
 */
export function useResource<S extends z.ZodType>(
  url: string,
  schema: S,
): ResourceState<Tolerated<z.output<S>>> & { retry: () => void } {
  type T = Tolerated<z.output<S>>;
  const [state, setState] = useState<ResourceState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((a) => a + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            body?.error?.message ?? `Request failed (${res.status}).`,
          );
        }
        const data = tolerant(schema).parse(await res.json());
        if (!cancelled) setState({ status: "success", data });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              err instanceof Error ? err.message : "Something went wrong.",
          });
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `attempt` exists only to force a re-run on retry()
  }, [url, attempt]);

  return { ...state, retry };
}
