import {
  GlobeIcon,
  ListChecksIcon,
  LayersIcon,
  GaugeIcon,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Single source of truth for navigation - the sidebar and the command
 * palette both read from this instead of maintaining two lists.
 */
export const navItems: NavItem[] = [
  { title: "Targets", href: "/targets", icon: GlobeIcon },
  { title: "Runs", href: "/runs", icon: ListChecksIcon },
  { title: "Suites", href: "/suites", icon: LayersIcon },
  { title: "Usage", href: "/usage", icon: GaugeIcon },
];
