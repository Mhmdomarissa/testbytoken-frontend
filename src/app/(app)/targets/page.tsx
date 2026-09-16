"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GlobeIcon, PlusIcon } from "lucide-react";
import { z } from "zod";
import { TargetSchema } from "@/lib/contract";
import { useResource } from "@/hooks/useResource";
import { ListSkeleton } from "@/components/state/ListSkeleton";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorState } from "@/components/state/ErrorState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TargetListSchema = z.array(TargetSchema);

export default function TargetsPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={2} />}>
      <TargetsList />
    </Suspense>
  );
}

function TargetsList() {
  const searchParams = useSearchParams();
  const url = `/targets${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const targets = useResource(url, TargetListSchema);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Applications registered for testing.
        </p>
        {/* Proves the error state on demand - see src/mocks/respond.ts. */}
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/targets?simulate_error=true" />}
          nativeButton={false}
        >
          Simulate error
        </Button>
      </div>

      {targets.status === "loading" && <ListSkeleton rows={2} />}

      {targets.status === "error" && (
        <ErrorState message={targets.message} onRetry={targets.retry} />
      )}

      {targets.status === "success" && targets.data.length === 0 && (
        <EmptyState
          icon={GlobeIcon}
          title="No targets yet"
          description="Register the application you want tested."
          action={
            <Button size="sm">
              <PlusIcon />
              Add a target
            </Button>
          }
        />
      )}

      {targets.status === "success" && targets.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Environment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.data.map((target) => (
              <TableRow key={target.id}>
                <TableCell>{target.name}</TableCell>
                <TableCell className="font-mono text-xs">
                  {target.base_url}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{target.environment}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
