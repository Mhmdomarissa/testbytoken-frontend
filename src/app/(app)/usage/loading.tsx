import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex gap-8" aria-hidden="true">
      <Skeleton className="h-16 w-32" />
      <Skeleton className="h-16 w-32" />
    </div>
  );
}
