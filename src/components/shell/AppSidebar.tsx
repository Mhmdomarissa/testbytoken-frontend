"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronsUpDownIcon, LogOutIcon, UserIcon } from "lucide-react";
import { clearMockSessionCookie } from "@/mocks/session-cookie-workaround";
import { Logomark } from "@/components/brand/Logomark";
import { ThemeRadioItems } from "@/components/theme/ThemeToggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EngineStatusCard } from "./EngineStatusCard";
import { accountNavItems, navItems, type NavItem } from "./nav-items";

const USER_EMAIL = "demo@testbytoken.example";

/**
 * The console sidebar (UI v2 V1): shadcn's Sidebar, inset variant, so the
 * sidebar sits on its own surface and the page is a raised panel beside
 * it - in the light theme too, where the sidebar and page tokens are close.
 * Collapses to a 68px icon rail (⌘B); a Sheet on phones.
 *
 * Not here, on purpose: a workspace name and nav counts. The contract has
 * neither (logged as additive gaps in docs/API_CONTRACT.md), and nothing
 * is shown that the server didn't send.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/auth/logout", { method: "POST" });
    // See src/mocks/session-cookie-workaround.ts.
    clearMockSessionCookie();
    router.push("/sign-in");
    router.refresh();
  }

  const isActive = (item: NavItem) =>
    pathname === item.href || pathname.startsWith(`${item.href}/`);

  const menu = (items: NavItem[]) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            render={<Link href={item.href} />}
            isActive={isActive(item)}
            tooltip={item.title}
            className="data-active:text-gold-text group-data-[collapsible=icon]:mx-auto data-active:[&>svg]:text-(--gold)"
          >
            <item.icon aria-hidden="true" />
            <span>{item.title}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="px-2 pt-3 pb-2">
        <Link
          href="/overview"
          className="flex items-center gap-2.5 rounded-md px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <Logomark className="size-7" />
          <span className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:sr-only">
            <span className="truncate font-heading text-lg">Test by Token</span>
            <span className="truncate text-[0.625rem] font-semibold tracking-[0.16em] text-(--ink-muted) uppercase">
              Testing as a service
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>{menu(navItems)}</SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>{menu(accountNavItems)}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 px-2 pb-3">
        <EngineStatusCard />
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    tooltip={USER_EMAIL}
                    className="group-data-[collapsible=icon]:mx-auto"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--surface-raised)">
                      <UserIcon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {USER_EMAIL}
                    </span>
                    <ChevronsUpDownIcon
                      aria-hidden="true"
                      className="ml-auto size-4 text-(--ink-muted)"
                    />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent side="top" align="start" className="w-60">
                {/* Base UI requires a menu label inside a group. */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="truncate">
                    {USER_EMAIL}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <ThemeRadioItems />
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOutIcon aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
