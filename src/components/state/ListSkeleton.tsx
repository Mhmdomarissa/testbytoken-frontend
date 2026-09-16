import { Skeleton } from "@/components/ui/skeleton";

/**
 * Matches the shape of a simple row-based list/table - never a full-page
 * spinner (CLAUDE.md/PHASE_A.md).
 */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-border py-3"
        >
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="ml-auto h-5 w-16" />
        </div>
      ))}
    </div>
  );
}
