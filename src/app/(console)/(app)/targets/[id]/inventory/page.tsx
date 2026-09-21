"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ScanSearchIcon, TriangleAlertIcon } from "lucide-react";
import { useScan } from "@/lib/api/queries/scans";
import { useTarget } from "@/lib/api/queries/targets";
import { useInspectModules } from "@/lib/api/queries/inspect";
import { ApiError } from "@/lib/api/errors";
import { isUnrecognised } from "@/lib/api/tolerant";
import { scanStatusLabel } from "@/components/targets/LastScan";
import { StatusBadge } from "@/components/status/StatusBadge";
import { toBadgeStatus } from "@/components/status/badgeStatus";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorState } from "@/components/state/ErrorState";
import { ListSkeleton } from "@/components/state/ListSkeleton";
import {
  ModuleSection,
  type ModuleInventory,
} from "@/components/inventory/ModuleSection";
import { countLocatable, type Element } from "@/components/inventory/inventory";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong.";
}

export default function InventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const target = useTarget(id);

  if (target.isPending) return <ListSkeleton rows={4} />;
  if (target.isError) {
    const missing =
      target.error instanceof ApiError && target.error.status === 404;
    return missing ? (
      <EmptyState
        icon={ScanSearchIcon}
        title="Target not found"
        description="It may have been removed."
        action={<BackToTargets />}
      />
    ) : (
      <ErrorState
        message={message(target.error)}
        onRetry={() => void target.refetch()}
      />
    );
  }

  const lastScan = target.data.last_scan;
  if (lastScan === null) {
    return (
      <NoInventory
        name={target.data.name}
        title="This target hasn't been scanned"
        description="The inventory is what a scan finds. Scan the target first."
      />
    );
  }
  if (isUnrecognised(lastScan.status) || lastScan.status !== "completed") {
    return (
      <NoInventory
        name={target.data.name}
        title="There is no finished scan to show yet"
        description="The inventory appears once a scan completes. Its current state:"
        status={
          <StatusBadge
            status={toBadgeStatus(lastScan.status)}
            label={scanStatusLabel(lastScan.status)}
          />
        }
      />
    );
  }
  return (
    <Inventory
      targetId={target.data.id}
      targetName={target.data.name}
      baseUrl={target.data.base_url}
      scanId={lastScan.id}
    />
  );
}

function BackToTargets() {
  return (
    <Link
      href="/targets"
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      <ArrowLeftIcon />
      Back to targets
    </Link>
  );
}

function NoInventory({
  name,
  title,
  description,
  status,
}: {
  name: string;
  title: string;
  description: string;
  status?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Header name={name} />
      <EmptyState
        icon={ScanSearchIcon}
        title={title}
        description={description}
        action={
          <div className="flex flex-col items-center gap-3">
            {status}
            <BackToTargets />
          </div>
        }
      />
    </div>
  );
}

function Header({ name, subtitle }: { name: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Link
        href="/targets"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3" aria-hidden="true" />
        Targets
      </Link>
      <h1 className="truncate font-heading text-2xl font-light" title={name}>
        {name} - element inventory
      </h1>
      {subtitle && (
        <p className="truncate text-sm text-muted-foreground" title={subtitle}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Inventory({
  targetName,
  baseUrl,
  scanId,
}: {
  targetId: string;
  targetName: string;
  baseUrl: string;
  scanId: string;
}) {
  const scan = useScan(scanId);
  const modules = scan.data?.modules ?? [];
  const inventories = useInspectModules(
    scanId,
    modules.map((m) => m.id),
  );
  const [query, setQuery] = useState("");
  const [onlyNotUnique, setOnlyNotUnique] = useState(false);

  if (scan.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Header name={targetName} subtitle={baseUrl} />
        <ListSkeleton rows={5} />
      </div>
    );
  }
  if (scan.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Header name={targetName} subtitle={baseUrl} />
        <ErrorState
          message={message(scan.error)}
          onRetry={() => void scan.refetch()}
        />
      </div>
    );
  }

  const sections = modules.map(
    (
      module,
      i,
    ): { module: (typeof modules)[number]; inventory: ModuleInventory } => {
      const q = inventories[i];
      if (!q || q.isPending)
        return { module, inventory: { status: "loading" } };
      if (q.isError) {
        return {
          module,
          inventory: {
            status: "error",
            message: message(q.error),
            retry: () => void q.refetch(),
          },
        };
      }
      return {
        module,
        inventory: { status: "ready", elements: q.data.elements },
      };
    },
  );

  const loaded: Element[][] = sections.flatMap((s) =>
    s.inventory.status === "ready" ? [s.inventory.elements] : [],
  );
  const all = loaded.flat();
  const { total, unique, notUnique } = countLocatable(all);
  const complete = loaded.length === modules.length;
  const filters = { query, onlyNotUnique };

  return (
    <div className="flex flex-col gap-6">
      <Header name={targetName} subtitle={baseUrl} />

      {modules.length === 0 ? (
        <EmptyState
          icon={ScanSearchIcon}
          title="The scan found nothing to test"
          description="It completed, but discovered no pages or elements. That usually means the site needs a sign-in, renders everything after user interaction, or blocks automated browsers. Scan again once that's addressed."
          action={<BackToTargets />}
        />
      ) : (
        <>
          <div
            data-testid="inventory-summary"
            className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm"
          >
            <span>
              <strong className="font-medium">{total}</strong> elements
              {complete
                ? ""
                : ` (so far - ${loaded.length} of ${modules.length} modules loaded)`}
            </span>
            <span>
              <strong className="font-medium">{unique}</strong> uniquely
              locatable
            </span>
            <span>
              <strong className="font-medium">{notUnique}</strong> not uniquely
              locatable
            </span>
          </div>

          {notUnique > 0 && (
            <Alert data-testid="not-unique-callout">
              <TriangleAlertIcon />
              <AlertTitle>
                {notUnique} of {total} elements can&apos;t be uniquely located
              </AlertTitle>
              <AlertDescription>
                <p>
                  The engine found more than one match for each of these, so a
                  test built on one may be unreliable - or not get generated at
                  all. They are listed first on every page.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  aria-pressed={onlyNotUnique}
                  onClick={() => setOnlyNotUnique((v) => !v)}
                >
                  {onlyNotUnique ? "Show all elements" : "Show only these"}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {complete && total > 0 && notUnique === 0 && (
            <p className="text-sm text-muted-foreground">
              Every listed element is uniquely locatable.
            </p>
          )}

          <div className="flex max-w-md flex-col gap-1">
            <label htmlFor="inventory-search" className="text-sm font-medium">
              Search elements
            </label>
            <Input
              id="inventory-search"
              type="search"
              placeholder="Label, role, locator or page"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </div>

          {sections.map(({ module, inventory }) => (
            <ModuleSection
              key={module.id}
              module={module}
              inventory={inventory}
              filters={filters}
            />
          ))}
        </>
      )}
    </div>
  );
}
