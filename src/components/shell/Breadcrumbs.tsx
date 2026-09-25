"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";
import { sectionFor } from "./nav-items";

/**
 * Workspace › section › entity (UI v2 V1). The entity (a target's name, a
 * run's id) is handed up by the page that already has it - the top bar
 * fetches nothing of its own. The current crumb is text, never a link.
 */
type Setter = (label: string | null) => void;
const EntityContext = createContext<{ label: string | null; set: Setter }>({
  label: null,
  set: () => {},
});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [label, set] = useState<string | null>(null);
  return (
    <EntityContext.Provider value={{ label, set }}>
      {children}
    </EntityContext.Provider>
  );
}

/** Called by a detail page with the name it is showing; cleared on leave. */
export function useEntityCrumb(label: string | null | undefined) {
  const { set } = useContext(EntityContext);
  useEffect(() => {
    set(label ?? null);
    return () => set(null);
  }, [label, set]);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const { label: entity } = useContext(EntityContext);
  const section = sectionFor(pathname);
  const onSectionPage = section !== undefined && pathname === section.href;

  const crumbs: { label: string; href?: Route }[] = [
    { label: "Workspace", href: "/overview" },
  ];
  if (section) {
    crumbs.push(
      onSectionPage
        ? { label: section.title }
        : { label: section.title, href: section.href },
    );
  }
  if (!onSectionPage && entity) crumbs.push({ label: entity });

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li
              key={`${i}-${c.label}`}
              // Phones: only the current crumb. Wider: the whole trail.
              className={
                last
                  ? "flex min-w-0 items-center gap-1.5"
                  : "hidden shrink-0 items-center gap-1.5 sm:flex"
              }
            >
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className="text-(--ink-muted) transition-colors duration-(--duration-fast) hover:text-foreground"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className="truncate font-medium"
                  title={c.label}
                >
                  {c.label}
                </span>
              )}
              {!last && (
                <ChevronRightIcon
                  aria-hidden="true"
                  className="size-3.5 text-(--ink-faint)"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
