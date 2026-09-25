"use client";

import { useState } from "react";
import { CircleCheckIcon } from "lucide-react";
import { StatusBadge } from "@/components/status/StatusBadge";
import { enumLabel } from "@/lib/api/tolerant";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UNIQUE_PAGE_SIZE, type Element } from "./inventory";

/** `duplicate_locator` -> "duplicate locator". A code from the server, shown as text. */
function humanise(code: string): string {
  return code.replace(/_/g, " ");
}

/**
 * One page's elements. Everything a site handed us here is hostile text
 * (labels, locators, URLs): rendered as text, truncated to one line with
 * the full value in `title`, never a link. Elements that are NOT uniquely
 * locatable come first, carry a marker on the row edge AND a labelled chip
 * with the reason - shape and words, not colour alone - and are never
 * paged away: only the well-behaved elements get a "show more".
 */
export function ElementTable({
  caption,
  elements,
}: {
  caption: string;
  elements: Element[];
}) {
  const [showAll, setShowAll] = useState(false);
  const notUnique = elements.filter((e) => !e.uniquely_locatable);
  const unique = elements.filter((e) => e.uniquely_locatable);
  const shownUnique = showAll ? unique : unique.slice(0, UNIQUE_PAGE_SIZE);
  const hidden = unique.length - shownUnique.length;
  const rows = [...notUnique, ...shownUnique];

  return (
    <div className="flex flex-col gap-2">
      <Table className="table-fixed">
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col className="w-40" />
          <col className="w-28" />
          <col />
          <col />
          <col className="w-24" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>Locatable</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Locator</TableHead>
            <TableHead>Found by</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((element) => (
            <ElementRow key={element.id} element={element} />
          ))}
        </TableBody>
      </Table>
      {hidden > 0 && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            Showing {shownUnique.length} of {unique.length} uniquely locatable
            elements on this page. All {notUnique.length} that are not are
            listed above.
          </span>
          <Button size="sm" variant="outline" onClick={() => setShowAll(true)}>
            Show {hidden} more
          </Button>
        </div>
      )}
    </div>
  );
}

function ElementRow({ element }: { element: Element }) {
  const notUnique = !element.uniquely_locatable;
  return (
    <TableRow
      data-testid={`element-${element.id}`}
      data-locatable={notUnique ? "no" : "yes"}
      className={
        notUnique
          ? "shadow-[inset_4px_0_0_var(--status-warning-fg)]"
          : undefined
      }
    >
      <TableCell className="align-top">
        {notUnique ? (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge status="warning" label="Not unique" />
            <span className="text-xs text-muted-foreground">
              {element.reason_not_locatable === null
                ? "No reason given"
                : humanise(element.reason_not_locatable)}
            </span>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CircleCheckIcon className="size-3" aria-hidden="true" />
            Unique
          </span>
        )}
      </TableCell>
      <TableCell
        className="truncate align-top"
        title={element.role ?? undefined}
      >
        {element.role ?? <span className="text-muted-foreground">none</span>}
      </TableCell>
      <TableCell className="truncate align-top" title={element.label}>
        {element.label === "" ? (
          <span className="text-muted-foreground">(no label)</span>
        ) : (
          element.label
        )}
      </TableCell>
      <TableCell
        className="truncate align-top font-mono text-xs"
        title={element.locator}
      >
        {element.locator}
      </TableCell>
      <TableCell className="truncate align-top text-xs">
        {enumLabel(element.locator_strategy)}
      </TableCell>
    </TableRow>
  );
}
