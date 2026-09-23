"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LogOutIcon, UserIcon } from "lucide-react";
import { clearMockSessionCookie } from "@/mocks/session-cookie-workaround";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceStatusPill } from "./WorkspaceStatusPill";
import { navItems } from "./nav-items";

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

  return (
    <Sidebar>
      <SidebarHeader className="px-3 py-3">
        <Link href="/overview" className="font-heading text-lg font-light">
          Test by Token
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={
                      pathname === item.href ||
                      pathname.startsWith(`${item.href}/`)
                    }
                  >
                    <item.icon />
                    {item.title}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 px-3 py-3">
        <WorkspaceStatusPill />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton>
                <UserIcon />
                demo@testbytoken.example
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem onClick={signOut}>
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
