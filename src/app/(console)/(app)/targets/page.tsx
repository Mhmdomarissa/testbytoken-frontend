"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { GlobeIcon, PlusIcon } from "lucide-react";
import type { z } from "zod";
import type { TargetSchema } from "@/lib/contract";
import { useTargets } from "@/lib/api/queries/targets";
import { useCreateScan } from "@/lib/api/queries/scans";
import { ApiError } from "@/lib/api/errors";
import { enumLabel, isUnrecognised, type Tolerated } from "@/lib/api/tolerant";
import { DEMO_WORKSPACE_ID } from "@/lib/workspace";
import { ListSkeleton } from "@/components/state/ListSkeleton";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorState } from "@/components/state/ErrorState";
import { LastScan } from "@/components/targets/LastScan";
import { ScanFailurePanel } from "@/components/targets/ScanFailurePanel";
import { TargetFormDialog } from "@/components/targets/TargetFormDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Target = Tolerated<z.infer<typeof TargetSchema>>;

/** A scan still moving (or in a state we can't read): don't start another on top of it. */
function isScanActive(target: Target): boolean {
  const scan = target.last_scan;
  if (scan === null) return false;
  return (
    isUnrecognised(scan.status) ||
    scan.status === "queued" ||
    scan.status === "crawling"
  );
}

export default function TargetsPage() {
  const targets = useTargets();
  const [registering, setRegistering] = useState(false);
  const [editing, setEditing] = useState<Target | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Applications registered for testing.
        </p>
        {targets.data && targets.data.length > 0 && (
          <Button size="sm" onClick={() => setRegistering(true)}>
            <PlusIcon />
            Add a target
          </Button>
        )}
      </div>

      {targets.isPending && <ListSkeleton rows={3} />}

      {targets.isError && (
        <ErrorState
          message={
            targets.error instanceof ApiError
              ? targets.error.message
              : "Something went wrong."
          }
          onRetry={() => void targets.refetch()}
        />
      )}

      {targets.data && targets.data.length === 0 && (
        <EmptyState
          icon={GlobeIcon}
          title="No targets yet"
          description="Register the application you want tested, then scan it so we can learn its structure."
          action={
            <Button size="sm" onClick={() => setRegistering(true)}>
              <PlusIcon />
              Add a target
            </Button>
          }
        />
      )}

      {targets.data && targets.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Environment</TableHead>
              <TableHead>Last scan</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.data.map((target) => (
              <TargetRows
                key={target.id}
                target={target}
                onChangeAddress={() => setEditing(target)}
              />
            ))}
          </TableBody>
        </Table>
      )}

      <TargetFormDialog open={registering} onOpenChange={setRegistering} />
      {editing && (
        <TargetFormDialog
          target={editing}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function TargetRows({
  target,
  onChangeAddress,
}: {
  target: Target;
  onChangeAddress: () => void;
}) {
  const createScan = useCreateScan();
  const active = isScanActive(target);
  const failure = target.last_scan?.failure ?? null;

  function scan() {
    createScan.mutate({
      workspace_id: DEMO_WORKSPACE_ID,
      target_id: target.id,
    });
  }

  return (
    <Fragment>
      <TableRow data-testid={`target-${target.id}`}>
        <TableCell className="font-medium">{target.name}</TableCell>
        <TableCell className="font-mono text-xs">{target.base_url}</TableCell>
        <TableCell>
          <Badge variant="outline">{enumLabel(target.environment)}</Badge>
        </TableCell>
        <TableCell>
          <LastScan scan={target.last_scan} />
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            {target.last_scan !== null &&
              !isUnrecognised(target.last_scan.status) &&
              target.last_scan.status === "completed" && (
                <Link
                  href={`/targets/${target.id}/inventory`}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Inventory
                </Link>
              )}
            {target.last_scan !== null &&
              !isUnrecognised(target.last_scan.status) &&
              target.last_scan.status === "completed" && (
                <Link
                  href={`/targets/${target.id}/compose`}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Compose test
                </Link>
              )}
            <Button
              size="sm"
              variant={target.last_scan === null ? "default" : "outline"}
              onClick={scan}
              disabled={active || createScan.isPending}
            >
              Scan
            </Button>
          </div>
          {createScan.isError && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {createScan.error instanceof ApiError
                ? createScan.error.message
                : "Couldn't start the scan."}
            </p>
          )}
        </TableCell>
      </TableRow>
      {failure && (
        <TableRow>
          <TableCell colSpan={5} className="whitespace-normal">
            <ScanFailurePanel
              failure={failure}
              onScanAgain={scan}
              onChangeAddress={onChangeAddress}
              scanning={active || createScan.isPending}
            />
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}
