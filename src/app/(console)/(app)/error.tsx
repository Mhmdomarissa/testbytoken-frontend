"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/state/ErrorState";

/**
 * Route-level error boundary for the whole app shell segment - catches an
 * unexpected render crash (a bug), distinct from ErrorState usages inside
 * individual pages, which handle expected fetch failures gracefully as
 * part of normal render, not a crash.
 */
export default function AppShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="This section crashed"
      message={error.message || "An unexpected error occurred."}
      onRetry={reset}
    />
  );
}
