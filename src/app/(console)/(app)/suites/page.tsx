"use client";

import { LayersIcon } from "lucide-react";
import { z } from "zod";
import { SuiteSchema } from "@/lib/contract";
import { useResource } from "@/hooks/useResource";
import { ListSkeleton } from "@/components/state/ListSkeleton";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorState } from "@/components/state/ErrorState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/layout/PageHeader";

const SuiteListSchema = z.array(SuiteSchema);

export default function SuitesPage() {
  const suites = useResource("/suites", SuiteListSchema);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Workspace"
        title="Suites"
        description="Generated test suites, one per target."
      />

      {suites.status === "loading" && <ListSkeleton rows={2} />}

      {suites.status === "error" && (
        <ErrorState message={suites.message} onRetry={suites.retry} />
      )}

      {suites.status === "success" && suites.data.length === 0 && (
        <EmptyState
          icon={LayersIcon}
          title="No suites yet"
          description="A suite is generated the first time a target is scanned."
        />
      )}

      {suites.status === "success" && suites.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Version</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suites.data.map((suite) => (
              <TableRow key={suite.id}>
                <TableCell>{suite.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  v{suite.latest_version}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
