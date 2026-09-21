"use client";

import { TriangleAlertIcon } from "lucide-react";
import { ErrorState } from "@/components/state/ErrorState";
import { ListSkeleton } from "@/components/state/ListSkeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ElementTable } from "./ElementTable";
import {
  applyFilters,
  countLocatable,
  groupByPage,
  inventoryDisagreement,
  type Element,
  type Filters,
} from "./inventory";

export type ModuleInventory =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "ready"; elements: Element[] };

/** A module's header, whatever its inventory is doing. `name` and page titles are scraped text. */
export function ModuleSection({
  module,
  inventory,
  filters,
}: {
  module: {
    id: string;
    name: string;
    element_count: number;
    elements_uniquely_locatable_count: number;
    pages: { id: string; url: string; title: string }[];
  };
  inventory: ModuleInventory;
  filters: Filters;
}) {
  const titles = new Map(module.pages.map((p) => [p.url, p.title]));
  const filtering = filters.query.trim() !== "" || filters.onlyNotUnique;

  return (
    <section
      aria-labelledby={`module-${module.id}`}
      data-testid={`module-${module.id}`}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <h2
          id={`module-${module.id}`}
          className="truncate font-heading text-xl font-light"
          title={module.name}
        >
          {module.name}
        </h2>
        <p className="text-sm text-muted-foreground">
          Scan reports {module.element_count} elements,{" "}
          {module.elements_uniquely_locatable_count} uniquely locatable.
        </p>
      </div>

      {inventory.status === "loading" && <ListSkeleton rows={3} />}

      {inventory.status === "error" && (
        <ErrorState
          title="Couldn't load this module's inventory"
          message={inventory.message}
          onRetry={inventory.retry}
        />
      )}

      {inventory.status === "ready" && (
        <ReadyModule
          module={module}
          elements={inventory.elements}
          titles={titles}
          filters={filters}
          filtering={filtering}
        />
      )}
    </section>
  );
}

function ReadyModule({
  module,
  elements,
  titles,
  filters,
  filtering,
}: {
  module: Parameters<typeof ModuleSection>[0]["module"];
  elements: Element[];
  titles: Map<string, string>;
  filters: Filters;
  filtering: boolean;
}) {
  const disagreement = inventoryDisagreement(module, elements);
  const { total, unique } = countLocatable(elements);
  const visible = applyFilters(elements, filters);
  const groups = groupByPage(visible);

  return (
    <>
      {disagreement && (
        <Alert data-testid="inventory-disagreement">
          <TriangleAlertIcon />
          <AlertTitle>This inventory may be incomplete</AlertTitle>
          <AlertDescription>{disagreement}</AlertDescription>
        </Alert>
      )}

      {total === 0 && (
        <p className="text-sm text-muted-foreground">
          This module has no elements in its inventory.
        </p>
      )}

      {total > 0 && unique === 0 && (
        <Alert data-testid="module-none-locatable">
          <TriangleAlertIcon />
          <AlertTitle>
            None of these elements can be uniquely located
          </AlertTitle>
          <AlertDescription>
            The engine could not tell any of them apart from another element on
            the page, which is why a test may not get generated for this module.
          </AlertDescription>
        </Alert>
      )}

      {filtering && total > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing {visible.length} of {total} elements in this module
          (filtered).
        </p>
      )}

      {groups.map((group) => (
        <div key={group.pageUrl} className="flex flex-col gap-2">
          <div className="flex flex-col">
            <h3
              className="truncate text-sm font-medium"
              title={titles.get(group.pageUrl)}
            >
              {titles.get(group.pageUrl) ?? "Untitled page"}
            </h3>
            <p
              className="truncate font-mono text-xs text-muted-foreground"
              title={group.pageUrl}
            >
              {group.pageUrl}
            </p>
          </div>
          <ElementTable
            caption={`Elements on ${group.pageUrl}`}
            elements={group.elements}
          />
        </div>
      ))}

      {filtering && total > 0 && groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No elements in this module match.
        </p>
      )}
    </>
  );
}
