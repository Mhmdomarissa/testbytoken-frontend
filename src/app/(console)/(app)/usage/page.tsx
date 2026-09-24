"use client";

import { UsageSchema } from "@/lib/contract";
import { useResource } from "@/hooks/useResource";
import { ErrorState } from "@/components/state/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";

export default function UsagePage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Workspace"
        title="Usage"
        description="Tokens and runs used by this workspace."
      />
      <UsageFigures />
    </div>
  );
}

function UsageFigures() {
  const usage = useResource("/usage", UsageSchema);

  if (usage.status === "loading") {
    return (
      <div className="flex gap-8" aria-hidden="true">
        <Skeleton className="h-16 w-32" />
        <Skeleton className="h-16 w-32" />
      </div>
    );
  }

  if (usage.status === "error") {
    return <ErrorState message={usage.message} onRetry={usage.retry} />;
  }

  return (
    <div className="flex gap-10">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Tokens used
        </p>
        <p className="mt-1 font-mono text-2xl tabular-nums">
          {usage.data.tokens_used.toFixed(1)}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Runs
        </p>
        <p className="mt-1 font-mono text-2xl tabular-nums">
          {usage.data.runs_count}
        </p>
      </div>
    </div>
  );
}
