import {
  GaugeIcon,
  GlobeIcon,
  LayersIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";

export interface NavItem {
  title: string;
  href: Route;
  icon: LucideIcon;
}

/**
 * Single source of truth for navigation - the sidebar, the command palette
 * and the breadcrumbs all read from these instead of keeping their own lists.
 *
 * No "Proofs" item: the contract has no proofs list endpoint (logged as an
 * additive gap in docs/API_CONTRACT.md), and a nav item must not lead to a
 * page that can't exist yet.
 */
export const navItems: NavItem[] = [
  { title: "Overview", href: "/overview", icon: LayoutDashboardIcon },
  { title: "Targets", href: "/targets", icon: GlobeIcon },
  { title: "Runs", href: "/runs", icon: ListChecksIcon },
  { title: "Suites", href: "/suites", icon: LayersIcon },
];

/** Under the sidebar's "Account" label. */
export const accountNavItems: NavItem[] = [
  { title: "Usage", href: "/usage", icon: GaugeIcon },
];

export const allNavItems: NavItem[] = [...navItems, ...accountNavItems];

/** The section a path belongs to (e.g. /targets/tgt_1/compose -> Targets). */
export function sectionFor(pathname: string): NavItem | undefined {
  return allNavItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
