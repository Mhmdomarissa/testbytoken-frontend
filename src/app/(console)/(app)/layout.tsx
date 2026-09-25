import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { TopBar } from "@/components/shell/TopBar";
import { OfflineBanner } from "@/components/shell/OfflineBanner";
import { ShellMain } from "@/components/shell/ShellMain";
import { BreadcrumbProvider } from "@/components/shell/Breadcrumbs";

/**
 * The console shell (UI v2 V1). The inset sidebar variant adds 16px of
 * padding plus a 2px edge around the collapsed rail, so a 50px icon column
 * makes the rail 68px, as specified.
 */
export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider
      style={{ "--sidebar-width-icon": "50px" } as React.CSSProperties}
    >
      <BreadcrumbProvider>
        <AppSidebar />
        <SidebarInset className="md:peer-data-[variant=inset]:shadow-raised md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:border-border">
          <OfflineBanner />
          <TopBar />
          <ShellMain>{children}</ShellMain>
        </SidebarInset>
      </BreadcrumbProvider>
    </SidebarProvider>
  );
}
