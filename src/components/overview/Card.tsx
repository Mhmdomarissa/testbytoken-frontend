import type { ReactNode } from "react";
import { RotateCwIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** A dashboard card: the card surface, 14px radius, elevation, a title row. */
export function Card({
  title,
  aside,
  children,
  className,
  testId,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      aria-label={title}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-card",
        className,
      )}
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside && (
          <div className="shrink-0 text-xs text-(--ink-muted)">{aside}</div>
        )}
      </header>
      {children}
    </section>
  );
}

/**
 * A card whose data didn't arrive. Says so, with a retry - never zeros,
 * which would read as a real answer.
 */
export function CardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 text-sm">
      <p className="font-medium">Couldn&apos;t load</p>
      <p className="text-(--ink-muted)">
        The overview didn&apos;t answer, so nothing is shown here rather than a
        number that might be wrong.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCwIcon aria-hidden="true" />
        Retry
      </Button>
    </div>
  );
}

export function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <Skeleton className="h-8 w-20" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}
