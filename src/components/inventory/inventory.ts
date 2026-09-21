import type { z } from "zod";
import type { ElementSchema } from "@/lib/contract";
import { isUnrecognised, type Tolerated } from "@/lib/api/tolerant";

export type Element = Tolerated<z.infer<typeof ElementSchema>>;

export interface PageGroup {
  pageUrl: string;
  /** Not-uniquely-locatable elements first: they are the point of the screen. */
  elements: Element[];
  notUnique: number;
}

/** Case-insensitive substring match over everything a person could reasonably search by. */
export function matchesQuery(element: Element, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  const strategy = isUnrecognised(element.locator_strategy)
    ? element.locator_strategy.raw
    : element.locator_strategy;
  return [
    element.label,
    element.role ?? "",
    element.locator,
    element.page_url,
    strategy,
    element.reason_not_locatable ?? "",
  ].some((field) => field.toLowerCase().includes(q));
}

export interface Filters {
  query: string;
  onlyNotUnique: boolean;
}

export function applyFilters(elements: Element[], filters: Filters): Element[] {
  return elements.filter(
    (e) =>
      (!filters.onlyNotUnique || !e.uniquely_locatable) &&
      matchesQuery(e, filters.query),
  );
}

/**
 * Groups by the page an element was found on, in first-seen order (the
 * order the engine reported), with the elements that can't be uniquely
 * located first within each group.
 */
export function groupByPage(elements: Element[]): PageGroup[] {
  const groups = new Map<string, Element[]>();
  for (const element of elements) {
    const list = groups.get(element.page_url);
    if (list) list.push(element);
    else groups.set(element.page_url, [element]);
  }
  return [...groups].map(([pageUrl, list]) => {
    const notUnique = list.filter((e) => !e.uniquely_locatable);
    const unique = list.filter((e) => e.uniquely_locatable);
    return {
      pageUrl,
      elements: [...notUnique, ...unique],
      notUnique: notUnique.length,
    };
  });
}

export function countLocatable(elements: Element[]) {
  const unique = elements.filter((e) => e.uniquely_locatable).length;
  return {
    total: elements.length,
    unique,
    notUnique: elements.length - unique,
  };
}

/**
 * The module's own header (`element_count`, `elements_uniquely_locatable_count`,
 * from the scan) and its inventory (from POST /inspect) are two answers to
 * the same question. When they disagree, the screen says so rather than
 * quietly trusting one - a list that is shorter than the count it claims
 * to list is a partial inventory, and the person must not read it as whole.
 */
export function inventoryDisagreement(
  module: { element_count: number; elements_uniquely_locatable_count: number },
  elements: Element[],
): string | null {
  const { total, unique } = countLocatable(elements);
  const problems: string[] = [];
  if (total !== module.element_count) {
    problems.push(
      `the scan reports ${module.element_count} elements for this module, but its inventory lists ${total}`,
    );
  }
  if (unique !== module.elements_uniquely_locatable_count) {
    problems.push(
      `the scan reports ${module.elements_uniquely_locatable_count} uniquely locatable, but the inventory marks ${unique}`,
    );
  }
  if (problems.length === 0) return null;
  const text = problems.join("; and ");
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

/** Unique elements shown per page before "Show more". Not-unique ones are never paged away. */
export const UNIQUE_PAGE_SIZE = 100;
